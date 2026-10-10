# Musique originale 15 s, 128 BPM, synthétisée de zéro (aucun sample externe).
import numpy as np, wave

SR = 44100
BPM = 96
BEAT = 60 / BPM
BAR = BEAT * 4
DUR = 15.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

def tt(n): return np.arange(n) / SR
def at(sec): return int(round(sec * SR))
def mtof(m): return 440 * 2 ** ((m - 69) / 12)

def onepole_lp(x, cutoff):
    """Passe-bas 1 pôle, cutoff scalaire ou tableau (Hz)."""
    c = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s += a[i] * (x[i] - s); y[i] = s
    return y

def hp(x, cutoff): return x - onepole_lp(x, cutoff)

def saw(freq, n, harm_max=9000):
    t = tt(n); out = np.zeros(n)
    k = 1
    while k * freq < harm_max and k < 60:
        out += np.sin(2 * np.pi * k * freq * t) / k; k += 1
    return out * (2 / np.pi)

def add(bus, sig, start):
    i = at(start); j = min(len(bus), i + len(sig))
    if i < len(bus): bus[i:j] += sig[:j - i]

L = np.zeros(N); R = np.zeros(N)
drums = np.zeros(N); bass = np.zeros(N); padL = np.zeros(N); padR = np.zeros(N)
arp = np.zeros(N); fx = np.zeros(N)


def kick(gain=1.0):
    n = at(0.45); t = tt(n)
    f = 45 + 140 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7.5)
    click = rng.standard_normal(n) * np.exp(-t * 300) * .35
    return np.tanh((body + click) * 1.6) * gain

def clap():
    n = at(0.3); t = tt(n); nz = rng.standard_normal(n)
    env = np.zeros(n)
    for d in (0, .011, .022): env += np.exp(-np.clip(t - d, 0, None) * 60) * (t >= d)
    env += np.exp(-t * 14) * .5
    return hp(onepole_lp(nz, 5000), 900) * env * .55

def hat(open_=False):
    n = at(0.25 if open_ else 0.06); t = tt(n)
    return hp(rng.standard_normal(n), 7000) * np.exp(-t * (18 if open_ else 80)) * (.22 if open_ else .16)

def snare_roll(start, end):
    t0 = start; k = 0
    while t0 < end:
        g = .15 + .5 * (t0 - start) / (end - start)
        add(drums, clap() * g, t0)
        step = BEAT / 4 if (t0 - start) < (end - start) / 2 else BEAT / 8
        t0 += step; k += 1


# ======== v2 : 96 BPM, 6 mesures de 2,5 s, ambiance posée ========
KICK = kick(.75); CLAP = clap() * .6; HAT = hat() * .7; OHAT = hat(True) * .6
kick_times = []
for bar in range(1, 6):
    for b in range(4):
        tk = bar * BAR + b * BEAT
        if bar == 5 and b > 0: continue          # fin : on laisse respirer
        add(drums, KICK, tk); kick_times.append(tk)
        if b in (1, 3) and bar in (2, 3, 4): add(drums, CLAP, tk)
        if bar in (2, 3, 4): add(drums, OHAT, tk + BEAT / 2)
        if bar in (3, 4):
            for s_ in (1, 3): add(drums, HAT, tk + s_ * BEAT / 4)
sc = np.ones(N)
for tk in kick_times:
    i = at(tk); n = at(BEAT * .9); t = tt(n)
    env = 1 - .55 * np.exp(-t * 7)
    j = min(N, i + n); sc[i:j] = np.minimum(sc[i:j], env[:j - i])

# C  G  Am  F  Dm7->G  Cmaj9
CH = [(48, [0, 4, 7]), (55, [0, 4, 7]), (57, [0, 3, 7]), (53, [0, 4, 7]), (50, [0, 3, 7, 10]), (48, [0, 4, 7, 11, 14])]
tN = tt(N)
for bar, (root, iv) in enumerate(CH):
    n = at(BAR + (2.5 if bar == 5 else .2)); t = tt(n)
    sigL = np.zeros(n); sigR = np.zeros(n)
    for semi in iv:
        f = mtof(root + 12 + semi)
        for d, pan in ((-0.08, 0), (0.0, .5), (0.08, 1)):
            v = saw(f * 2 ** (d / 12), n, 5000) * .05
            sigL += v * (1 - pan) + v * .3; sigR += v * pan + v * .3
    env = np.minimum(1, t / .25) * np.where(t > BAR, np.exp(-(t - BAR) * (1.2 if bar == 5 else 20)), 1)
    add(padL, sigL * env, bar * BAR); add(padR, sigR * env, bar * BAR)
cut = np.where(tN < BAR, 500 + 2000 * tN / BAR, 2800.0)
padL = onepole_lp(onepole_lp(padL, cut), cut); padR = onepole_lp(onepole_lp(padR, cut), cut)

for bar, (root, iv) in enumerate(CH[:5]):
    if bar == 0: continue
    for e in range(8):
        if e % 2 == 0: continue
        n = at(BEAT / 2 * .85); t = tt(n); f = mtof(root - 12)
        v = (saw(f, n, 1800) * .4 + np.sin(2 * np.pi * f / 2 * t) * .6) * np.exp(-t * 4)
        add(bass, v * .5, bar * BAR + e * BEAT / 2)
bass = onepole_lp(bass, 700)

# arpège doux en croches (piano-pluck)
for bar, (root, iv) in enumerate(CH):
    notes = [root + 24 + i for i in iv] + [root + 36]
    for e in range(8):
        if bar == 5 and e > 0: break
        n = at(.5); t = tt(n)
        f = mtof(notes[[0, 2, 1, 3, 2, 1, 3, 2][e] % len(notes)])
        v = (np.sin(2 * np.pi * f * t) + .25 * np.sin(2 * np.pi * 2 * f * t) + .1 * np.sin(2 * np.pi * 3 * f * t)) * np.exp(-t * 7)
        add(arp, v * .11, bar * BAR + e * BEAT / 2)

# carillons de rareté (scène 4) : 6 notes qui montent
for e in range(6):
    n = at(.5); t = tt(n); f = mtof(84 + [0, 2, 4, 7, 9, 12][e])
    add(fx, (np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t * 8) * .12, 3 * BAR + .45 + e * .26)
n = at(1.2); t = tt(n)
add(fx, sum(np.sin(2 * np.pi * mtof(96 + k) * t) for k in (0, 7, 12)) * np.exp(-t * 3) * .035, 3 * BAR + 1.75)
# petits pops : cartes du booster + lignes de fonctionnalités
for i in range(5):
    n = at(.1); t = tt(n); add(fx, np.sin(2 * np.pi * (900 + i * 120) * t) * np.exp(-t * 50) * .1, 2 * BAR + 1.45 + i * .07)
for i in range(4):
    n = at(.1); t = tt(n); add(fx, np.sin(2 * np.pi * (700 + i * 150) * t) * np.exp(-t * 45) * .1, 4 * BAR + .45 + i * .22)

def whoosh(start, dur=.45, g=.35, rev=True):
    n = at(dur); t = tt(n); nz = rng.standard_normal(n)
    env = (t / dur) ** 2 if rev else np.exp(-t * 8)
    sig = hp(onepole_lp(nz, 600 + 7000 * (t / dur if rev else 1 - t / dur)), 300)
    add(fx, sig * env * g, start - (dur if rev else 0))

def impact(start, g=1.0):
    n = at(1.6); t = tt(n)
    boom = np.sin(2 * np.pi * (38 + 60 * np.exp(-t * 18)) * t) * np.exp(-t * 2.4)
    nz = onepole_lp(rng.standard_normal(n), 2500) * np.exp(-t * 10) * .4
    add(fx, np.tanh((boom + nz) * 1.4) * .7 * g, start)

def riser(start, end, g=.25):
    n = at(end - start); t = tt(n); k = t / (end - start)
    nz = hp(onepole_lp(rng.standard_normal(n), 400 + 9000 * k ** 2), 200)
    tone = np.sin(2 * np.pi * np.cumsum(200 + 1400 * k ** 2) / SR) * .25
    add(fx, (nz + tone) * k ** 2 * g, start)


impact(0.0, .5)
for bar in range(1, 6): whoosh(bar * BAR, .5, .1)
riser(4 * BAR + 1.0, 5 * BAR, .12)
impact(5 * BAR, .55)
# ---------- mix ----------
L = drums * .9 + bass * sc + padL * sc * .9 + arp * sc + fx
R = drums * .9 + bass * sc + padR * sc * .9 + arp * sc * .85 + fx
# réverb très simple (échos décorrélés) sur pads/arp
def verb(x, taps=((.031, .35), (.047, .3), (.071, .25), (.113, .2), (.157, .15))):
    y = np.zeros_like(x)
    for d, g in taps:
        i = at(d); y[i:] += x[:-i] * g
    return onepole_lp(y, 4000)
L += verb(arp * sc + padL * .3 + fx * .3) * .6
R += verb(arp * sc + padR * .3 + fx * .3, ((.037, .35), (.053, .3), (.079, .25), (.109, .2), (.163, .15))) * .6

mixv = np.stack([L, R], 1)
mixv = np.tanh(mixv * 1.3) / np.tanh(1.3)            # glue / saturation douce
fade = np.ones(N); fn = at(.6); fade[-fn:] = np.linspace(1, 0, fn) ** 2
mixv *= fade[:, None]
mixv[:at(.004)] *= np.linspace(0, 1, at(.004))[:, None]
mixv /= np.max(np.abs(mixv)) / 0.97
pcm = (mixv * 32767).astype('<i2')
with wave.open('music2.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', mixv.shape)

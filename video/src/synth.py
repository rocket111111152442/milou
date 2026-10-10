# Musique originale 15 s, 128 BPM, synthétisée de zéro (aucun sample externe).
import numpy as np, wave

SR = 44100
BPM = 128
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

# ---------- percussions ----------
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

KICK, CLAP, HAT, OHAT = kick(), clap(), hat(), hat(True)
kick_times = []
for bar in range(1, 8):
    if bar == 6:
        beats = [0, 1]          # break avant le drop : roulement
    else:
        beats = [0, 1, 2, 3]
    for b in beats:
        tk = bar * BAR + b * BEAT
        add(drums, KICK, tk); kick_times.append(tk)
        if b in (1, 3): add(drums, CLAP, tk)
        add(drums, OHAT, tk + BEAT / 2)
        for s in (0, 1, 2, 3):
            if bar in (2, 3, 4, 5) and s != 2: add(drums, HAT * (.8 if s % 2 else 1.0), tk + s * BEAT / 4)
snare_roll(6 * BAR + 2 * BEAT, 7 * BAR)

# sidechain
sc = np.ones(N)
for tk in kick_times:
    i = at(tk); n = at(BEAT * .9); t = tt(n)
    env = 1 - .75 * np.exp(-t * 9)
    j = min(N, i + n); sc[i:j] = np.minimum(sc[i:j], env[:j - i])

# ---------- harmonie ----------
# Am F C G Am F G C (MIDI racines)
CH = [(57, [0, 3, 7]), (53, [0, 4, 7]), (48, [0, 4, 7]), (55, [0, 4, 7]),
      (57, [0, 3, 7]), (53, [0, 4, 7]), (55, [0, 5, 7]), (48, [0, 4, 7, 11])]

# pad supersaw (stéréo), à partir de la mesure 1, intro filtrée
for bar, (root, iv) in enumerate(CH):
    n = at(BAR + (1.2 if bar == 7 else 0)); t = tt(n)
    sigL = np.zeros(n); sigR = np.zeros(n)
    for semi in iv:
        f = mtof(root + 12 + semi)
        for d, pan in ((-0.12, 0), (-0.05, 1), (0.0, .5), (0.06, 0), (0.13, 1)):
            v = saw(f * 2 ** (d / 12), n, 7000) * .045
            sigL += v * (1 - pan) + v * .3; sigR += v * pan + v * .3
    env = np.minimum(1, t / .03) * (np.exp(-np.clip(t - BAR, 0, None) * 2.5) if bar == 7 else 1)
    add(padL, sigL * env, bar * BAR); add(padR, sigR * env, bar * BAR)
cut = np.full(N, 6000.0)
tN = tt(N)
cut[:at(BAR)] = 300 + 2500 * (tN[:at(BAR)] / BAR) ** 2           # intro : filtre qui s'ouvre
m = (tN >= 6 * BAR) & (tN < 7 * BAR); cut[m] = 1500 + 6000 * ((tN[m] - 6 * BAR) / BAR) ** 2
padL = onepole_lp(onepole_lp(padL, cut), cut); padR = onepole_lp(onepole_lp(padR, cut), cut)

# basse : croches décalées
for bar, (root, iv) in enumerate(CH):
    if bar == 0: continue
    for e in range(8):
        if e % 2 == 0 and bar != 7: continue
        n = at(BEAT / 2 * .9); t = tt(n)
        f = mtof(root - 12)
        v = (saw(f, n, 2500) * .5 + np.sin(2 * np.pi * f / 2 * t) * .6) * np.exp(-t * 5)
        add(bass, v * .55, bar * BAR + e * BEAT / 2)
bass = onepole_lp(bass, 900)

# arpège pluck en double-croches
for bar, (root, iv) in enumerate(CH):
    if bar == 7: continue
    notes = [root + 24 + i for i in iv] + [root + 36]
    for s in range(16):
        if bar == 0 and s < 4: continue
        n = at(.18); t = tt(n)
        f = mtof(notes[[0, 1, 2, 3, 2, 1, 2, 3][s % 8] % len(notes)])
        v = np.sign(np.sin(2 * np.pi * f * t)) * .5 + np.sin(2 * np.pi * f * 2 * t) * .3
        add(arp, v * np.exp(-t * 22) * .09, bar * BAR + s * BEAT / 4)
arp = onepole_lp(arp, np.where(tN < BAR, 1200 + 3000 * tN / BAR, 4200))

# montée de rareté (mesure 4) : blips qui montent à chaque croche
for e in range(6):
    n = at(.22); t = tt(n)
    f = mtof(81 + [0, 2, 4, 7, 9, 12][e])
    v = (np.sin(2 * np.pi * f * t) + .4 * np.sin(2 * np.pi * f * 2.01 * t)) * np.exp(-t * 14)
    add(fx, v * .16, 4 * BAR + e * BEAT / 2)
# scintillement "holo"
n = at(BEAT * 2); t = tt(n)
sh = sum(np.sin(2 * np.pi * mtof(93 + k) * t) * np.exp(-t * 3) for k in (0, 7, 12, 16)) * .04
add(fx, sh * (1 + np.sin(2 * np.pi * 16 * t)) * .5, 4 * BAR + 3 * BEAT)

# stabs features (mesure 5) sur chaque temps
for b in range(4):
    root, iv = CH[5]
    n = at(.28); t = tt(n); v = np.zeros(n)
    for semi in iv + [12]:
        v += saw(mtof(root + 24 + semi + (b == 3) * 2), n, 8000)
    add(fx, onepole_lp(v, 3500) * np.exp(-t * 9) * .06, 5 * BAR + b * BEAT)

# pop des cartes (mesure 6) : 12 double-croches
for i in range(12):
    n = at(.08); t = tt(n)
    f = 1400 + i * 90
    add(fx, np.sin(2 * np.pi * f * t) * np.exp(-t * 60) * .12, 6 * BAR + BEAT * .5 + i * BEAT / 4)

# ---------- FX de transition ----------
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

impact(0.0, .9)
riser(BAR * .45, BAR, .2)
for bar in range(1, 8):
    whoosh(bar * BAR, .35, .22)
    if bar in (1, 7): impact(bar * BAR, 1.0 if bar == 7 else .7)
riser(6 * BAR, 7 * BAR, .3)
# accord final
n = at(1.6); t = tt(n); v = np.zeros(n)
for semi in (0, 4, 7, 11, 14):
    v += np.sin(2 * np.pi * mtof(60 + semi) * t) + .3 * np.sin(2 * np.pi * mtof(72 + semi) * t)
add(fx, v * np.exp(-t * 1.8) * .05, 7 * BAR)

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
fade = np.ones(N); fn = at(.35); fade[-fn:] = np.linspace(1, 0, fn) ** 2
mixv *= fade[:, None]
mixv[:at(.004)] *= np.linspace(0, 1, at(.004))[:, None]
mixv /= np.max(np.abs(mixv)) / 0.97
pcm = (mixv * 32767).astype('<i2')
with wave.open('music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', mixv.shape)

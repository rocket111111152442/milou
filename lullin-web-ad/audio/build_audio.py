"""
Bande-son originale du film Lullin Web — 100 % synthétisée (numpy/scipy), aucun échantillon externe :
droits d'exploitation publicitaire sans ambiguïté.

- Musique : electronic / minimal techno cinématique, 128,57 BPM (1 temps = 28 images à 60 i/s), fa mineur → la bémol majeur.
- Effets : chaque son correspond à un repère déclaré par une scène (audio/cues.json, exporté depuis la composition).
- Sorties : assets/audio/music_stem.wav, sfx_stem.wav, lullin_ad_mix.wav (48 kHz, stéréo, float32).
Le niveau final (-14 LUFS, crête vraie -1 dBTP) est appliqué à l'encodage par FFmpeg (loudnorm).
"""
import json, math, os, sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, 'src', 'timeline.json')))
CUES = json.load(open(os.path.join(ROOT, 'audio', 'cues.json')))
SR = 48000
BEAT = TL['beatFrames'] / TL['fps']
DUR = (TL['totalBeats'] * TL['beatFrames'] + TL['tailFrames']) / TL['fps']
N = int(round(DUR * SR))
rng = np.random.default_rng(2026)
b = lambda beats: beats * BEAT

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def tt(n): return np.arange(n) / SR
def sec(n_s): return int(round(n_s * SR))

# ---------------------------------------------------------------- outils DSP
def sos(kind, f, order=2):
    if kind == 'bp':
        return signal.butter(order, [max(20, f[0]), min(SR / 2 - 100, f[1])], btype='bandpass', fs=SR, output='sos')
    return signal.butter(order, min(f, SR / 2 - 100), btype={'lp': 'lowpass', 'hp': 'highpass'}[kind], fs=SR, output='sos')

def filt(x, kind, f, order=2): return signal.sosfilt(sos(kind, f, order), x, axis=-1)

def svf(x, cutoff, q=0.7, mode='lp'):
    """Filtre à état variable (TPT) à fréquence de coupure variable par échantillon."""
    cutoff = np.broadcast_to(np.asarray(cutoff, dtype=np.float64), x.shape[-1:])
    g = np.tan(np.pi * np.clip(cutoff, 20, SR * 0.45) / SR)
    k = 1.0 / q
    a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2
    out = np.zeros_like(x)
    xs = np.atleast_2d(x); os_ = np.atleast_2d(out)
    for c in range(xs.shape[0]):
        ic1 = ic2 = 0.0
        v = xs[c]; o = os_[c]
        for i in range(v.shape[0]):
            v3 = v[i] - ic2
            v1 = a1[i] * ic1 + a2[i] * v3
            v2 = ic2 + a2[i] * ic1 + a3[i] * v3
            ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2
            o[i] = v2 if mode == 'lp' else (v1 if mode == 'bp' else v[i] - k * v1 - v2)
    return out

def polyblep(t, dt):
    dt = np.broadcast_to(dt, t.shape)
    y = np.zeros_like(t)
    m = t < dt; x = t[m] / dt[m]; y[m] = x + x - x * x - 1
    m = t > 1 - dt; x = (t[m] - 1) / dt[m]; y[m] = x * x + x + x + 1
    return y

def saw(freq, n, phase0=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
    ph = (phase0 + np.cumsum(f) / SR) % 1.0
    return (2 * ph - 1) - polyblep(ph, f / SR)

def sine(freq, n, phase0=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
    return np.sin(2 * np.pi * (phase0 + np.cumsum(f) / SR))

def noise(n): return rng.standard_normal(n)

def env(n, a=0.002, d=0.2, curve=1.0):
    t = tt(n)
    e = np.exp(-t / max(d, 1e-4)) ** curve
    na = max(1, sec(a)); e[:na] *= np.linspace(0, 1, na)
    return e

def pan(x, p=0.0):
    """Panoramique à puissance constante, p ∈ [-1, 1] (constant ou tableau)."""
    p = np.asarray(p)
    a = (p + 1) * np.pi / 4
    return np.vstack([x * np.cos(a), x * np.sin(a)])

def stereo(x, width=0.0):
    if x.ndim == 2: return x
    return pan(x, 0.0) * math.sqrt(2) if width == 0 else np.vstack([x, x])

class Bus:
    def __init__(self): self.x = np.zeros((2, N))
    def add(self, t0, sig, gain=1.0, p=0.0):
        s = sig if sig.ndim == 2 else pan(sig, p) * math.sqrt(2)
        i0 = sec(t0)
        if i0 < 0: s = s[:, -i0:]; i0 = 0
        n = min(s.shape[1], N - i0)
        if n > 0: self.x[:, i0:i0 + n] += s[:, :n] * gain

def make_reverb(seconds=2.4, damp=5500, seed=7):
    r = np.random.default_rng(seed)
    n = sec(seconds)
    e = np.exp(-tt(n) * 6.9 / seconds)
    ir = np.vstack([r.standard_normal(n) * e, r.standard_normal(n) * e])
    ir = filt(ir, 'lp', damp, 1); ir[:, :sec(0.012)] *= np.linspace(0, 1, sec(0.012))
    return ir / np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True)) * 0.9

IR = make_reverb()
def reverb(bus_x, ir=IR):
    out = np.vstack([signal.fftconvolve(bus_x[c], ir[c])[:N] for c in range(2)])
    return out

# ---------------------------------------------------------------- instruments
def kick(gain=1.0, punch=1.0, length=0.42):
    n = sec(length); t = tt(n)
    f = 46 + 110 * np.exp(-t / 0.035) * punch + 18 * np.exp(-t / 0.2)
    body = sine(f, n) * env(n, 0.001, length * 0.45)
    click = filt(noise(sec(0.006)), 'hp', 2500) * 0.35
    body[:click.size] += click
    return np.tanh(body * 1.6 * gain) * 0.9

def clap(gain=1.0):
    n = sec(0.28); x = np.zeros(n)
    for k, dt in enumerate([0, 0.011, 0.022]):
        i = sec(dt); m = sec(0.03); x[i:i + m] += noise(m) * np.exp(-tt(m) / 0.006)
    x += noise(n) * env(n, 0.001, 0.09) * 0.6
    return filt(filt(x, 'bp', [900, 4200], 2), 'hp', 500) * gain * 0.7

def hat(open_=False, gain=1.0):
    n = sec(0.18 if open_ else 0.05)
    x = filt(noise(n), 'hp', 7500, 2) * env(n, 0.0005, 0.06 if open_ else 0.012)
    return x * gain * 0.5

def pad_voice(freq, n, det=0.11):
    v = sum(saw(freq * 2 ** (c / 1200), n, rng.random()) for c in (-det * 60, 0, det * 60)) / 3
    return v

def tone_bell(freq, n, decay=0.8, ratio=3.5, index=2.2):
    t = tt(n); e = np.exp(-t / decay)
    mod = np.sin(2 * np.pi * freq * ratio * t) * index * np.exp(-t / (decay * 0.4))
    return np.sin(2 * np.pi * freq * t + mod) * e

def whoosh(dur, f0=400, f1=4000, q=1.6, p0=-0.6, p1=0.6, peak=0.6, gain=1.0):
    n = sec(dur); t = np.linspace(0, 1, n)
    cutoff = f0 * (f1 / f0) ** t
    x = svf(noise(n) * 0.6, cutoff, q, 'bp')
    a = np.where(t < peak, (t / peak) ** 2, ((1 - t) / (1 - peak)) ** 1.6)
    return pan(x * a * gain, p0 + (p1 - p0) * t) * math.sqrt(2)

def tick_s(freq=2400, gain=1.0, dec=0.018):
    n = sec(0.06)
    x = sine(freq, n) * env(n, 0.0003, dec) + filt(noise(n), 'hp', 3000) * env(n, 0.0002, 0.003) * 0.6
    return x * gain

def sub_boom(f0=58, f1=34, dur=1.4, gain=1.0):
    # Fondamentale grave + harmoniques (saturation, octave) pour rester perceptible sur un haut-parleur de smartphone.
    n = sec(dur); t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t / 0.25)
    e = env(n, 0.003, dur * 0.35)
    body = np.tanh(sine(f, n) * e * 2.4) * 0.75 + sine(f * 2, n) * e * 0.35 + sine(f * 3, n) * e ** 2 * 0.12
    return body * gain

# ---------------------------------------------------------------- harmonie (temps → accord, notes MIDI)
CH = {
    'Fm9': [53, 56, 60, 63, 67], 'Dbmaj7': [49, 53, 56, 60], 'Dbmaj9': [49, 53, 56, 60, 63],
    'Eb': [51, 55, 58, 62], 'Ebsus': [51, 56, 58, 63], 'Ab9': [56, 60, 63, 67, 70], 'Fm': [53, 56, 60, 65],
}
ROOTS = {'Fm9': 29, 'Dbmaj7': 25, 'Dbmaj9': 25, 'Eb': 27, 'Ebsus': 27, 'Ab9': 32, 'Fm': 29}
PROG = [(0, 'Fm9'), (8, 'Dbmaj7'), (12, 'Eb'), (18, 'Fm9'), (22, 'Dbmaj9'), (24, 'Ebsus'), (27, 'Fm'), (33, 'Dbmaj9'),
        (36, 'Ab9'), (40, 'Eb'), (44, 'Fm9'), (45, 'Dbmaj7'), (49.75, 'Eb'), (51, 'Fm9'), (53, 'Ab9')]
def chord_at(beat):
    c = PROG[0][1]
    for bb, name in PROG:
        if beat >= bb: c = name
    return c

music, drums, sfx, verb_send = Bus(), Bus(), Bus(), Bus()
T = tt(N)

# -------- pad (accords) avec filtre automatisé
pad = np.zeros(N)
seg = PROG + [(TL['totalBeats'] + 1, None)]
for (b0, name), (b1, _) in zip(seg[:-1], seg[1:]):
    i0, i1 = sec(b(b0)), min(N, sec(b(b1)) + sec(0.25))
    n = i1 - i0
    if n <= 0: continue
    v = sum(pad_voice(mtof(m), n) for m in CH[name]) / len(CH[name])
    e = np.ones(n); fa = min(n, sec(0.08)); e[:fa] = np.linspace(0, 1, fa); e[-sec(0.25):] *= np.linspace(1, 0, sec(0.25))
    pad[i0:i1] += v * e
cut = np.interp(T, [0, b(4), b(10), b(17), b(18), b(26.5), b(27), b(32.8), b(33), b(36), b(45), b(49.75), b(51), b(53), DUR],
                     [350, 700, 1400, 1700, 1800, 3200, 500, 2600, 4200, 2200, 1100, 1800, 900, 3000, 1400])
pad = svf(pad, cut, 0.9)
pad_gain = np.interp(T, [0, 0.6, b(4), b(18), b(27), b(33), b(36), b(45), b(51), b(53), DUR - 0.8, DUR],
                        [0.15, 0.32, 0.38, 0.40, 0.46, 0.55, 0.40, 0.48, 0.42, 0.58, 0.5, 0.0])
pad *= pad_gain
music.add(0, np.vstack([pad, np.roll(pad, sec(0.011))]) * 0.55)
verb_send.add(0, pan(pad, 0) * 0.35)

# -------- basse (sub + médium), croches décalées dans les sections rythmiques
bass = np.zeros(N); mid = np.zeros(N)
def bass_note(t0, dur, midi, g=1.0, mid_g=0.5):
    n = sec(dur); f = mtof(midi)
    e = env(n, 0.004, dur * 0.6) * np.minimum(1, np.linspace(6, 0, n))
    i0 = sec(t0); i1 = min(N, i0 + n)
    bass[i0:i1] += (sine(f, n) * e * g)[:i1 - i0]
    m = svf(saw(f * 2, n), 300 + 1600 * np.exp(-tt(n) / 0.05), 1.2) * e * mid_g
    mid[i0:i1] += m[:i1 - i0]
for beat_i in range(int(TL['totalBeats'] * 2)):
    beat = beat_i / 2
    root = ROOTS[chord_at(beat)]
    sect = None
    if 10 <= beat < 17: sect = 'drive'
    elif 18 <= beat < 26.5: sect = 'dense'
    elif 36 <= beat < 45: sect = 'drive'
    if sect and beat % 1 == 0.5:  # croches à contretemps
        bass_note(b(beat), BEAT * 0.48, root + 12, 0.8, 0.55 if sect == 'dense' else 0.35)
    if sect == 'dense' and beat % 1 == 0.0:
        bass_note(b(beat + 0.25), BEAT * 0.22, root + 24, 0.25, 0.4)
# notes tenues (tension / résolution)
bass_note(b(27), b(6), 41, 0.6, 0.3); bass_note(b(33), b(3), 37, 0.8, 0.4); bass_note(b(45), b(4.7), 37, 0.45, 0.25)
bass_note(b(53), DUR - b(53), 44, 0.6, 0.35)
music.add(0, pan(np.tanh(bass * 1.2) * 0.62, 0) + pan(mid * 0.36, 0))

# -------- arpèges (scène 4 dense, scène 6 plus léger)
arp = np.zeros(N)
def arp_run(b0, b1, step, octv, g):
    k = 0; beat = b0
    while beat < b1:
        notes = CH[chord_at(beat)]
        m = notes[[0, 2, 1, 3, 2, 4 % len(notes), 1, 3][k % 8] % len(notes)] + octv
        n = sec(BEAT * step * 1.6); f = mtof(m)
        x = svf(saw(f, n) * 0.6 + sine(f * 2, n) * 0.25, 900 + 4200 * np.exp(-tt(n) / 0.04), 1.0) * env(n, 0.002, 0.09)
        i0 = sec(b(beat)); i1 = min(N, i0 + n); arp[i0:i1] += x[:i1 - i0] * g
        beat += step; k += 1
arp_run(18, 26.5, 0.25, 12, 0.55); arp_run(36, 44.5, 0.5, 12, 0.32); arp_run(10, 17, 0.5, 12, 0.22)
arp_l = arp; arp_r = np.roll(arp, sec(BEAT * 0.75))  # écho pointé côté droit
music.add(0, np.vstack([arp_l, arp_r * 0.7]) * 0.42)
verb_send.add(0, pan(arp, 0.2) * 0.25)

# -------- batterie
kicks = []
def K(beat, g=1.0, punch=1.0): drums.add(b(beat), kick(g, punch), 1.0); kicks.append(b(beat))
for beat in range(4, 17): K(beat, 0.9 if beat < 10 else 1.0)
for beat in range(18, 27): K(beat)
for beat in (34, 35): K(beat, 0.9)
for beat in range(36, 45): K(beat, 0.85)
for beat in list(range(11, 17, 2)) + list(range(19, 27, 2)) + list(range(37, 45, 2)):
    drums.add(b(beat), clap(0.9), 1.0, 0.05); verb_send.add(b(beat), pan(clap(0.5), 0.05))
for k16 in range(int(6 * 4), int(27 * 4)):
    beat = k16 / 4
    if 17 <= beat < 18: continue
    acc = 1.0 if k16 % 4 == 2 else (0.55 if k16 % 2 else 0.35)
    drums.add(b(beat), hat(False, acc * (0.7 if beat < 10 else 0.9)), 1.0, 0.25 if k16 % 2 else -0.15)
for beat in [x + 0.5 for x in range(18, 26)] + [x + 0.5 for x in range(36, 44)]:
    drums.add(b(beat), hat(True, 0.6), 1.0, 0.3)
for k16 in range(36 * 2, 45 * 2):  # croches régulières en scène 6
    drums.add(b(k16 / 2), hat(False, 0.45), 1.0, -0.2)
# roulement de montée vers le verrouillage du logo (beats 30 → 33)
beat = 30.0
while beat < 33:
    step = 0.5 if beat < 31.5 else (0.25 if beat < 32.5 else 0.125)
    g = 0.25 + 0.6 * (beat - 30) / 3
    x = filt(noise(sec(0.12)), 'bp', [180, 900]) * env(sec(0.12), 0.001, 0.05) + sine(140 + 40 * (beat - 30), sec(0.12)) * env(sec(0.12), 0.001, 0.06)
    drums.add(b(beat), x * g, 1.0, 0.1 * math.sin(beat * 7))
    beat += step

# -------- sidechain : la musique s'efface brièvement sous chaque grosse caisse
duck = np.ones(N)
for tk in kicks:
    i0 = sec(tk); n = min(sec(0.3), N - i0)
    duck[i0:i0 + n] = np.minimum(duck[i0:i0 + n], 1 - 0.55 * np.exp(-tt(n) / 0.09))
music.x *= duck

# -------- silence rythmique juste avant la scène 4 (temps 17 → 18)
gate = np.ones(N)
g0, g1 = sec(b(17)), sec(b(18))
gate[g0:g1] = 0; gate[g0 - sec(0.01):g0] = np.linspace(1, 0, sec(0.01)); gate[g1:g1 + sec(0.005)] = np.linspace(0, 1, sec(0.005))
music.x *= gate; drums.x *= gate

# ---------------------------------------------------------------- effets sonores (repères des scènes)
PENTA = [65, 68, 70, 72, 75, 77, 80, 82, 84, 87, 89, 92, 94, 96, 99, 101, 104, 106, 108]
def motif(t0, notes, gain=1.0, spacing=0.09, decay=1.2):
    for k, m in enumerate(notes):
        x = tone_bell(mtof(m), sec(decay * 2), decay, 3.5 if k % 2 else 2.0, 1.6)
        sfx.add(t0 + k * spacing, x * gain * 0.45, 1.0, (-0.25, 0.25, 0.0, 0.1)[k % 4])
        verb_send.add(t0 + k * spacing, pan(x * gain * 0.4, 0))

def impact(t0, gain=1.0, bright=1.0, boom=(60, 32, 1.4)):
    sfx.add(t0, sub_boom(*boom, gain=0.9 * gain))
    sfx.add(t0, kick(1.0 * gain, 1.3))
    n = sec(0.5)
    crack = filt(noise(n), 'hp', 1200) * env(n, 0.0005, 0.07) * 0.5 * bright
    sfx.add(t0, pan(crack, -0.1) * 1.2 * gain + pan(np.roll(crack, 80), 0.1) * 0.3)
    verb_send.add(t0, pan(crack * gain * 0.8, 0))

for c in CUES:
    t0, typ = c['time'], c['type']; g = c.get('gain', 1.0); pitch = c.get('pitch', c.get('idx', 0)); dur = c.get('dur', 0.4)
    if typ == 'impact_open':
        impact(t0, 0.9, 1.0, (70, 34, 0.9))
        sfx.add(t0, tick_s(3200, 0.6))
    elif typ == 'word_tick':
        sfx.add(t0, filt(noise(sec(0.03)), 'bp', [2000, 6000]) * env(sec(0.03), 0.0003, 0.006) * 0.55 * g, 1.0, -0.15)
        sfx.add(t0, sine(180, sec(0.08)) * env(sec(0.08), 0.001, 0.03) * 0.35 * g)
    elif typ == 'click':
        x = np.zeros(sec(0.05)); x[:sec(0.004)] += filt(noise(sec(0.004)), 'hp', 2000) * 0.9
        i = sec(0.018); x[i:i + sec(0.004)] += filt(noise(sec(0.004)), 'hp', 3000) * 0.6
        sfx.add(t0, x + tick_s(2600, 0.25)[:x.size], 0.9, 0.1)
    elif typ == 'bass_hit':
        impact(t0, 1.0, 0.7, (55, 30, 1.1))
        sfx.add(t0, np.tanh(sine(mtof(29), sec(0.7)) * env(sec(0.7), 0.002, 0.3) * 3) * 0.5)
    elif typ == 'shatter':
        for k in range(12):
            f = 2200 * 2 ** (rng.random() * 1.6)
            sfx.add(t0 + k * 0.022 + rng.random() * 0.01, tick_s(f, 0.28, 0.012), 1.0, rng.uniform(-0.8, 0.8))
    elif typ == 'suck':
        n = sec(dur); t = np.linspace(0, 1, n)
        x = svf(noise(n), 300 * (20 ** t), 2.0, 'bp') * (t ** 2.2) * 0.9 + sine(120 * 4 ** t, n) * (t ** 3) * 0.25
        sfx.add(t0, x * 1.0)
    elif typ in ('whoosh', 'pullback', 'dolly_in', 'logo_slide', 'swish_soft'):
        d = dict(whoosh=(0.6, 300, 5000, -0.8, 0.8, 1.0), pullback=(dur, 2500, 250, 0.2, -0.2, 0.8), dolly_in=(0.35, 400, 3000, 0, 0, 0.7),
                 logo_slide=(0.32, 800, 2400, 0.3, -0.5, 0.45), swish_soft=(0.3, 900, 3000, 0.4, -0.4, 0.45))[typ]
        sfx.add(t0, whoosh(d[0], d[1], d[2], 1.4, d[3], d[4], 0.55, d[5]))
    elif typ == 'pan_whoosh':
        sfx.add(t0, whoosh(0.34, 500, 3600, 1.6, 0.7, -0.7, 0.62, 0.8))
    elif typ == 'lock':
        sfx.add(t0, tick_s(mtof(PENTA[min(pitch, len(PENTA) - 1)] - 12), 0.42, 0.03), 1.0, -0.3 + 0.6 * ((pitch * 0.37) % 1))
    elif typ == 'lock_panel':
        sfx.add(t0, sine(110, sec(0.25)) * env(sec(0.25), 0.002, 0.08) * 0.6); sfx.add(t0, tick_s(1400, 0.4))
    elif typ == 'wipe':
        sfx.add(t0, whoosh(dur, 1500, 7000, 1.2, -0.5, 0.5, 0.7, 0.35))
    elif typ == 'word_hit':
        impact(t0, 0.85 * g, 0.8, (52, 30, 0.9))
    elif typ == 'layers_lift':
        sfx.add(t0, whoosh(0.45, 600, 5000, 2.5, 0, 0, 0.4, 0.45)); motif(t0 + 0.05, [77, 84], 0.25, 0.06, 0.4)
    elif typ == 'tick':
        sfx.add(t0, tick_s(mtof(84 + [0, 3, 7, 10, 12, 15][pitch % 6]), 0.4, 0.04), 1.0, (pitch - 1) * 0.3)
    elif typ == 'zip':
        n = sec(0.12); t = np.linspace(0, 1, n)
        sfx.add(t0, sine(500 * 9 ** t, n) * np.sin(np.pi * t) * 0.28 + filt(noise(n), 'hp', 4000) * np.sin(np.pi * t) * 0.15, 1.0, 0.2)
    elif typ == 'swish_fast':
        sfx.add(t0, whoosh(0.2, 1200, 6000, 1.5, 0.2, -0.2, 0.4, 0.6))
    elif typ == 'pop':
        n = sec(0.09); f = (700 + pitch * 90) * np.exp(-tt(n) / 0.05) + 380
        sfx.add(t0, sine(f, n) * env(n, 0.001, 0.035) * 0.5, 1.0, -0.4 + pitch * 0.25)
    elif typ == 'ping':
        x = tone_bell(1760, sec(1.2), 0.5, 2.0, 0.6) * 0.3
        sfx.add(t0, x, 1.0, 0.35); sfx.add(t0 + 0.18, x * 0.4, 1.0, -0.35); sfx.add(t0 + 0.36, x * 0.18, 1.0, 0.35)
    elif typ == 'split':
        impact(t0, 0.7, 1.2, (80, 40, 0.6)); sfx.add(t0, tick_s(1800, 0.5))
    elif typ == 'lock_click':
        for dt in (0, 0.012): sfx.add(t0 + dt, tick_s(mtof(79 + pitch * 5), 0.35, 0.015), 1.0, -0.2 + pitch * 0.2)
    elif typ == 'flip':
        sfx.add(t0, whoosh(0.3, 3000, 700, 1.5, -0.3, 0.3, 0.5, 0.45))
    elif typ == 'typing':
        for k in range(int(c.get('n', 10))):
            sfx.add(t0 + k * dur / c.get('n', 10) + rng.random() * 0.012, filt(noise(sec(0.02)), 'bp', [1500, 5000]) * env(sec(0.02), 0.0003, 0.004) * 0.3, 1.0, rng.uniform(-0.2, 0.2))
    elif typ == 'reorder':
        sfx.add(t0, whoosh(0.3, 700, 2000, 2.0, -0.2, 0.2, 0.5, 0.35)); sfx.add(t0 + 0.27, tick_s(2100, 0.35))
    elif typ == 'swipe':
        sfx.add(t0, whoosh(0.16, 900, 5000, 1.3, 0.4, -0.4, 0.45, 0.45))
    elif typ == 'riser_short':
        n = sec(dur); t = np.linspace(0, 1, n)
        x = svf(noise(n), 500 * 16 ** t, 1.5, 'bp') * t ** 1.5 + saw(110 * 4 ** t, n) * t ** 2 * 0.12
        sfx.add(t0, x * 0.75)
    elif typ == 'flash_hit':
        impact(t0, 0.9, 1.4, (62, 33, 1.2)); motif(t0, [80, 87], 0.35, 0.0, 1.2)
        n = sec(1.0); sfx.add(t0, pan(filt(noise(n), 'hp', 6000) * env(n, 0.001, 0.3) * 0.18, 0))
    elif typ == 'drone':
        n = sec(2.7); x = (saw(mtof(41), n) + saw(mtof(41) * 1.004, n)) * 0.5
        x = svf(x, np.linspace(200, 1400, n), 1.2) * np.minimum(1, tt(n) / 0.4) * 0.22
        sfx.add(t0, x)
    elif typ == 'detach':
        f = mtof(84 + [0, 5, 3, 7][pitch % 4]); n = sec(0.6); t = tt(n)
        x = sum(np.sin(2 * np.pi * f * r * t) * np.exp(-t / (0.12 / r)) * a for r, a in ((1, 1), (2.76, 0.5), (5.4, 0.25)))
        sfx.add(t0, x * 0.2, 1.0, [-0.6, 0.6, -0.3, 0.3][pitch % 4]); verb_send.add(t0, pan(x * 0.15, 0))
    elif typ == 'flyby':
        n = sec(dur); t = np.linspace(0, 1, n); peak = (14.2 - t0) / dur
        a = np.exp(-((t - peak) / 0.22) ** 2)
        x = svf(noise(n), 900 + 2600 * a, 1.2, 'bp') * a * 0.9 + sine(330 * (1.25 - 0.5 * t), n) * a * 0.12
        sfx.add(t0, pan(x, -0.9 + 1.8 * t) * math.sqrt(2))
    elif typ == 'whoosh_rev':
        n = sec(dur); t = np.linspace(0, 1, n)
        x = svf(noise(n), 5000 * (0.05 ** t), 1.1, 'lp') * (1 - t) ** 1.5 * 0.8
        sfx.add(t0, x)
    elif typ == 'snap':
        sfx.add(t0, tick_s(mtof(72 + [0, 0, 3, 5, 7][pitch % 5]), 0.4, 0.025), 1.0, [-0.2, 0.2, -0.5, 0.5, 0][pitch % 5])
        sfx.add(t0, sine(160, sec(0.1)) * env(sec(0.1), 0.001, 0.03) * 0.35)
    elif typ == 'lock_impact':
        impact(t0, 1.1, 1.2, (58, 29, 1.8))
        motif(t0 + 0.02, [68, 75, 80], 0.75, 0.07, 1.4)  # signature courte (la♭ – mi♭ – la♭)
    elif typ == 'build':
        for k in range(6): sfx.add(t0 + k * 0.05, tick_s(mtof(84 + k * 2), 0.18, 0.02), 1.0, -0.4 + k * 0.16)
    elif typ == 'morph':
        n = sec(dur); t = np.linspace(0, 1, n)
        x = sine(mtof(68) * (1 + 0.5 * (3 * t ** 2 - 2 * t ** 3)), n) * np.sin(np.pi * t) * 0.12  # glissement d'une quinte
        sfx.add(t0, x, 1.0, 0.2); sfx.add(t0, whoosh(dur, 400, 1600, 2.5, -0.3, 0.4, 0.5, 0.3))
    elif typ == 'scroll_tick':
        k, tk = 0, 0.0
        while tk < dur:
            sfx.add(t0 + tk, tick_s(3000, 0.12 * (1 - tk / dur), 0.006), 1.0, 0.3); tk += 0.02 + 0.09 * (tk / dur) ** 1.5; k += 1
    elif typ == 'rule_draw':
        n = sec(dur); t = np.linspace(0, 1, n)
        sfx.add(t0, pan(sine(mtof(77) * (1 + 0.02 * t), n) * np.sin(np.pi * t) * 0.08 + filt(noise(n), 'hp', 5000) * np.sin(np.pi * t) * 0.06, -0.6 + 1.2 * t) * math.sqrt(2))
    elif typ == 'line_rise':
        sfx.add(t0, sine(90, sec(0.35)) * env(sec(0.35), 0.003, 0.12) * 0.45 * g)
        sfx.add(t0 - 0.12, whoosh(0.18, 600, 2400, 1.5, 0, 0, 0.85, 0.3 * g))
    elif typ == 'line_drop':
        sfx.add(t0, whoosh(0.22, 2400, 500, 1.5, 0, 0, 0.3, 0.3))
    elif typ == 'vie_hit':
        impact(t0, 0.8, 0.9, (55, 31, 1.4)); motif(t0, [75, 79, 82], 0.4, 0.0, 1.6)
    elif typ == 'mark_in':
        motif(t0, [80], 0.3, 0, 1.0); sfx.add(t0, whoosh(0.4, 300, 1200, 1.2, 0, 0, 0.4, 0.25))
    elif typ == 'final_hit':
        impact(t0, 1.0, 1.0, (56, 29, 2.0))
        motif(t0 + 0.02, [68, 75, 80, 84], 0.9, 0.085, 1.8)  # signature complète
    elif typ == 'underline':
        n = sec(dur); t = np.linspace(0, 1, n)
        sfx.add(t0, pan(sine(mtof(84) * (1 + 0.06 * t), n) * np.sin(np.pi * t) * 0.07, -0.4 + 0.8 * t) * math.sqrt(2))

# ---------------------------------------------------------------- mixage
wet = reverb(verb_send.x)
music_mix = music.x + drums.x * 0.85 + wet * 0.35
sfx_mix = sfx.x
mix = music_mix * 0.8 + sfx_mix * 0.95
# fondu final (queue de réverbération naturelle)
fade = np.ones(N); nf = sec(0.7); fade[-nf:] = np.linspace(1, 0, nf) ** 1.5
mix *= fade; music_mix *= fade; sfx_mix *= fade
# limiteur doux
def soft_limit(x, ceiling=0.89):
    peak = np.max(np.abs(x)); x = x / peak * 1.25 if peak > 0 else x
    return np.tanh(x) * ceiling / np.tanh(1.25)
def low_shelf(x, f0=75, gain_db=-3.5):
    A = 10 ** (gain_db / 40); w0 = 2 * np.pi * f0 / SR; al = np.sin(w0) / 2 * np.sqrt(2)
    cw = np.cos(w0); sa = 2 * np.sqrt(A) * al
    b_ = [A * ((A + 1) - (A - 1) * cw + sa), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sa)]
    a_ = [(A + 1) + (A - 1) * cw + sa, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sa]
    return signal.lfilter(np.array(b_) / a_[0], np.array(a_) / a_[0], x, axis=-1)
# Égalisation de diffusion mobile : coupe-bas 30 Hz + atténuation douce du grave profond.
mix = low_shelf(filt(mix, 'hp', 30, 2), 75, -3.5)
mix = soft_limit(mix)
os.makedirs(os.path.join(ROOT, 'assets', 'audio'), exist_ok=True)
for name, x in (('music_stem', music_mix), ('sfx_stem', sfx_mix), ('lullin_ad_mix', mix)):
    y = x / max(1e-9, np.max(np.abs(x))) * 0.89 if name != 'lullin_ad_mix' else x
    wavfile.write(os.path.join(ROOT, 'assets', 'audio', f'{name}.wav'), SR, y.T.astype(np.float32))
print(f'audio : {DUR:.3f} s, {N} échantillons, crête mix {np.max(np.abs(mix)):.3f}')

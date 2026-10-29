"""Render original '市巷慢游': D pentatonic, 80 BPM, 32 bars / 96 s.
No samples or third-party recordings. Requires numpy.
24 kHz stereo PCM keeps the soft timbres intact and loops sample-accurately.
"""
from pathlib import Path
import json, wave
import numpy as np

RATE, BPM, BARS = 24000, 80, 32
BEAT = 60 / BPM
DURATION = BARS * 4 * BEAT
N = int(DURATION * RATE)
rng = np.random.default_rng(20261029)
mix = np.zeros((N, 2), dtype=np.float64)

def hz(midi): return 440 * 2 ** ((midi - 69) / 12)

def add(at, midi, beats, amp, pan=0, voice='pluck'):
    duration = beats * BEAT
    t = np.arange(int(duration * RATE)) / RATE
    f = hz(midi)
    attack = 1 - np.exp(-t / (.085 if voice == 'flute' else .004))
    release = np.clip((duration - t) / (.18 if voice == 'flute' else .08), 0, 1)
    if voice == 'flute':
        phase = 2 * np.pi * f * t + .12 * np.sin(2 * np.pi * 4.7 * t) * (1 - np.exp(-t * 3))
        signal = np.sin(phase) + .19 * np.sin(2 * phase) + .055 * np.sin(3 * phase)
        breath = rng.standard_normal(len(t))
        breath = np.convolve(breath, np.ones(12) / 12, mode='same')
        signal = (signal + .035 * breath) * attack * release * (.88 + .12 * np.sin(np.pi * t / duration))
    elif voice == 'pad':
        signal = (np.sin(2 * np.pi * f * t) + .23 * np.sin(2 * np.pi * f * 2 * t)) * np.sin(np.pi * t / duration) ** 2
    else:
        signal = np.zeros(len(t))
        for h, level in [(1, 1), (2, .42), (3, .21), (4, .09), (5, .035)]:
            signal += level * np.sin(2 * np.pi * f * h * t * (1 + .00015 * h)) * np.exp(-t * (1.5 + h * .7))
        signal *= attack * release
    stereo = signal[:, None] * amp * np.array([np.sqrt((1-pan)/2), np.sqrt((1+pan)/2)])
    idx = (int(at * BEAT * RATE) + np.arange(len(t))) % N
    mix[idx] += stereo

# Eight four-bar phrases: invitation, answer, a brighter middle, then a quiet return.
phrases = [
 [(0,74,1.5),(2,78,1),(3.5,81,2),(6,78,1.5),(8,76,2),(11,74,2.5)],
 [(0,71,2),(3,74,1.5),(5,76,2),(8,78,2),(11,76,1),(13,74,2)],
 [(0,78,2),(3,81,1.5),(5,83,2),(8,81,2.5),(12,78,2)],
 [(0,76,1.5),(2,74,2),(5,71,2),(8,69,2),(11,71,1),(13,74,2)],
 [(0,81,2),(3,83,1),(5,86,2),(8,83,2),(11,81,2.5)],
 [(0,78,2),(3,76,1),(5,74,2.5),(9,76,1.5),(12,78,2)],
 [(0,76,2),(3,78,1.5),(6,81,2),(9,78,2),(12,76,2)],
 [(0,74,2),(3,71,1.5),(6,69,2),(9,71,1),(11,74,3)],
]
roots = [50, 50, 47, 47, 54, 54, 45, 50]
for bar in range(BARS):
    root = roots[(bar // 2) % len(roots)]
    # Open fifths and sparse plucks leave room for game feedback.
    add(bar*4, root, 3.8, .105, -.18)
    add(bar*4+.08, root+7, 3.8, .035, .3, 'pad')
    for beat, note, strength in [(1.5,root+19,.075),(2.5,root+12,.065),(3.25,root+7,.045)]:
        if bar % 4 == 3 and beat > 2: continue
        add(bar*4+beat, note, 2.5, strength, -.4 if beat < 2 else .42)
    if bar % 2 == 0:
        # Soft wood resonance, far below the melody.
        add(bar*4+2, 62, .18, .025, .15)
for phrase, notes in enumerate(phrases):
    for beat, midi, length in notes:
        add(phrase*16+beat+.14, midi, length, .10 if phrase < 4 else .09, .10, 'flute')
        if phrase in [1,3,6] and beat == 0:
            add(phrase*16+beat, midi-12, 3, .04, -.35)

# Circular room reflections preserve the tail at the loop boundary.
dry = mix.copy()
for delay, level in [(.113,.13),(.227,.10),(.389,.075),(.617,.055),(.941,.035),(1.331,.02)]:
    mix += np.roll(dry[:, ::-1], int(delay * RATE), axis=0) * level
mix -= mix.mean(axis=0)
mix *= .67 / np.max(np.abs(mix))
# Sub-millisecond smoothing removes any residual phase discontinuity.
edge = 32
mix[:edge] *= np.linspace(0,1,edge)[:,None]
mix[-edge:] *= np.linspace(1,0,edge)[:,None]
root = Path(__file__).resolve().parents[1]
output = root / 'assets/audio/market-stroll.wav'
output.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(output), 'wb') as wav:
    wav.setnchannels(2); wav.setsampwidth(2); wav.setframerate(RATE)
    wav.writeframes((mix * 32767).astype('<i2').tobytes())
print(json.dumps({'duration':DURATION,'peak':float(np.max(np.abs(mix))), 'rms':float(np.sqrt(np.mean(mix**2))), 'bytes':output.stat().st_size,'file':str(output)},ensure_ascii=False))

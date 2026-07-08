"""Generate small calming CC0-style UI + ambient WAV sounds bundled with the app.

Run once:
    python /app/scripts/generate_sounds.py

Sounds are placed into /app/frontend/assets/sounds/.
All content is procedurally synthesized here (no third-party samples) so it is
fully original / CC0-safe to bundle.
"""
import math
import struct
import wave
import random
from pathlib import Path

OUT_DIR = Path("/app/frontend/assets/sounds")
OUT_DIR.mkdir(parents=True, exist_ok=True)

SR = 22050  # sample rate (small file size, plenty for gentle UI sounds)


def write_wav(name: str, samples):
    """samples: iterable of floats in [-1, 1]"""
    path = OUT_DIR / name
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)  # 16-bit
        w.setframerate(SR)
        frames = b"".join(
            struct.pack("<h", max(-32768, min(32767, int(s * 32767)))) for s in samples
        )
        w.writeframes(frames)
    print(f"wrote {path} ({path.stat().st_size} bytes)")


def env(t, attack=0.005, decay=0.4):
    """Simple attack + exp decay envelope."""
    if t < attack:
        return t / attack
    return math.exp(-(t - attack) / decay)


def tone(freq, duration, amp=0.5, decay=0.4, attack=0.005, phase=0.0):
    n = int(SR * duration)
    for i in range(n):
        t = i / SR
        yield amp * env(t, attack=attack, decay=decay) * math.sin(2 * math.pi * freq * t + phase)


def mix(*generators):
    """Mix multiple sample generators of the same length by summing."""
    lists = [list(g) for g in generators]
    n = max(len(x) for x in lists)
    for i in range(n):
        s = 0.0
        for x in lists:
            if i < len(x):
                s += x[i]
        yield max(-1.0, min(1.0, s))


# ---------- 1. Soft tap (mood select / tab press) ----------
def make_tap():
    # Very short, warm click — 60ms
    dur = 0.09
    return list(mix(
        tone(880, dur, amp=0.25, decay=0.03, attack=0.002),
        tone(1320, dur, amp=0.15, decay=0.02, attack=0.002),
    ))


# ---------- 2. Chime (mood submit / task complete) ----------
def make_chime():
    # Two-note major-third bell, gentle bells + subtle harmonics
    dur = 0.9
    root, third = 880.0, 1108.7  # A5, C#6
    parts = [
        tone(root, dur, amp=0.35, decay=0.45),
        tone(third, dur, amp=0.28, decay=0.45),
        tone(root * 2, dur, amp=0.12, decay=0.35),   # 2nd harmonic
        tone(third * 2, dur, amp=0.08, decay=0.30),
    ]
    return list(mix(*parts))


# ---------- 3. Send whoosh (chat send) ----------
def make_send():
    # Rising short whoosh: filtered noise + upward sine sweep
    dur = 0.28
    n = int(SR * dur)
    samples = []
    prev = 0.0
    for i in range(n):
        t = i / SR
        # sine sweep 600 -> 1400 Hz
        f = 600 + (1400 - 600) * (t / dur)
        s = 0.35 * math.exp(-t / 0.15) * math.sin(2 * math.pi * f * t)
        # add lightly filtered noise
        noise = (random.random() * 2 - 1)
        # simple 1-pole lowpass to soften noise
        prev = prev * 0.85 + noise * 0.15
        s += 0.15 * math.exp(-t / 0.12) * prev
        samples.append(max(-1.0, min(1.0, s)))
    return samples


# ---------- 4. Pop (task complete alt / success sparkle) ----------
def make_pop():
    dur = 0.32
    return list(mix(
        tone(1174.7, dur, amp=0.32, decay=0.10),   # D6
        tone(1567.98, dur * 0.9, amp=0.22, decay=0.08),  # G6
        tone(1975.53, dur * 0.7, amp=0.12, decay=0.06),  # B6
    ))


# ---------- 5. Ambient loop (Lumi screen background) ----------
def make_ambient(duration=8.0):
    """A slow, calm pad — a few detuned sines gently sweeping in amplitude.
    Loopable: fades in the first ~0.4s and out the last ~0.4s so cross-fades
    when looped remain smooth.
    """
    n = int(SR * duration)
    # Layered frequencies: low root + a couple of soft overtones (calm major)
    voices = [
        (146.83, 0.10, 0.30),   # D3
        (220.00, 0.09, 0.42),   # A3
        (293.66, 0.08, 0.55),   # D4
        (369.99, 0.06, 0.70),   # F#4
        (554.37, 0.045, 0.85),  # C#5 (adds shimmer)
    ]
    # Very slow LFO per voice for shimmering amplitude
    lfo_rates = [0.09, 0.13, 0.11, 0.17, 0.23]
    samples = []
    for i in range(n):
        t = i / SR
        s = 0.0
        for (f, amp, phase), lfo in zip(voices, lfo_rates):
            lfo_env = 0.55 + 0.45 * (0.5 + 0.5 * math.sin(2 * math.pi * lfo * t + phase))
            s += amp * lfo_env * math.sin(2 * math.pi * f * t + phase)
        # Loop-friendly fade in/out
        fade = 0.4
        if t < fade:
            s *= t / fade
        elif t > duration - fade:
            s *= (duration - t) / fade
        samples.append(max(-1.0, min(1.0, s * 0.7)))
    return samples


if __name__ == "__main__":
    write_wav("tap.wav", make_tap())
    write_wav("chime.wav", make_chime())
    write_wav("send.wav", make_send())
    write_wav("pop.wav", make_pop())
    write_wav("ambient.wav", make_ambient(8.0))
    print("done")

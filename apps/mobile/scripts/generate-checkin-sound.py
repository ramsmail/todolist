#!/usr/bin/env python3
"""Generate apps/mobile/assets/sounds/checkin.wav — the daily check-in chime.

A bright rising major arpeggio (E5, G#5, B5, E6) with a soft bell timbre.
Deterministic (no randomness) so re-running produces an identical file.
Stdlib only. Output: 44.1 kHz, 16-bit, mono PCM WAV, ~1.25 s (iOS requires
custom notification sounds to be < 30 s and .wav/.caf/.aiff).

Usage: python3 apps/mobile/scripts/generate-checkin-sound.py
"""
import math
import struct
import wave
from pathlib import Path

RATE = 44100
OUT = Path(__file__).resolve().parent.parent / "assets" / "sounds" / "checkin.wav"

# (frequency Hz, start s, duration s)
NOTES = [
    (659.25, 0.00, 0.35),
    (830.61, 0.12, 0.35),
    (987.77, 0.24, 0.40),
    (1318.51, 0.40, 0.80),
]
TOTAL = 1.25


def bell(freq: float, t: float, dur: float) -> float:
    if t < 0 or t > dur:
        return 0.0
    attack = min(1.0, t / 0.005)          # 5 ms attack, avoids a click
    decay = math.exp(-4.5 * t / dur)      # bell-like exponential decay
    tone = (
        math.sin(2 * math.pi * freq * t)
        + 0.35 * math.sin(2 * math.pi * freq * 2 * t)
        + 0.12 * math.sin(2 * math.pi * freq * 3 * t)
    )
    return attack * decay * tone


def main() -> None:
    n = int(RATE * TOTAL)
    samples = []
    for i in range(n):
        t = i / RATE
        samples.append(sum(bell(f, t - start, dur) for f, start, dur in NOTES))
    peak = max(abs(s) for s in samples) or 1.0
    scale = 0.85 * 32767 / peak
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(s * scale)) for s in samples))
    print(f"wrote {OUT} ({TOTAL:.2f}s)")


if __name__ == "__main__":
    main()

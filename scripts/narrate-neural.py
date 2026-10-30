"""Local synthesis with measured phrase boundaries, not guessed word timings."""
import json
import sys
import wave
from pathlib import Path


def connected_speech(engine, job):
    if not engine.has_timings:
        raise ValueError("Connected narration requires model phoneme timings.")
    parts = [
        engine.tokenizer.known(
            " ".join(engine.tokenizer.phonemize(phrase, job["language"]).split())
        ).strip()
        for phrase in job["phrases"]
    ]
    if not parts or any(not part for part in parts):
        raise ValueError("A connected phrase produced no phonemes.")
    phonemes = " ".join(parts)
    samples, sample_rate, spoken = engine.create_timed(
        phonemes, voice=job["voice"], lang=job["language"], is_phonemes=True,
        speed=job["speed"], sentence_pause=job["sentencePause"],
        clause_pause=job["clausePause"], continuous=True)
    if "".join(item.phoneme for item in spoken) != phonemes:
        raise ValueError("Provider timings do not cover the complete narration.")
    cues, cursor, previous_end = [], 0, 0
    duration = len(samples) / sample_rate
    for phrase, part in zip(job["phrases"], parts):
        start, end = spoken[cursor].start, spoken[cursor + len(part) - 1].end
        # Native trimming can round the final waveform one sample below its timing.
        if duration < end <= duration + 1 / sample_rate + 1e-12:
            end = duration
        if start < previous_end or end <= start or end > duration:
            raise ValueError("Invalid model-aligned connected phrase.")
        cues.append({"text": phrase, "start": start, "end": end})
        previous_end = end
        cursor += len(part) + 1
    return samples, sample_rate, cues


def main():
    request = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
    if request["command"] == "fontcheck":
        from fontTools.ttLib import TTFont
        font = TTFont(request["font"])
        cmap = font.getBestCmap()
        missing = sorted({ord(c) for c in request["text"] if not c.isspace()
                          and c not in "\u200c\u200d" and ord(c) not in cmap})
        if missing:
            raise ValueError(f"Font is missing glyphs: {missing}")
        print("Font coverage passed.")
        return

    import numpy as np
    import onnxruntime as ort
    from kokoro_onnx import Kokoro

    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(request["model"], sess_options=options,
                                   providers=["CPUExecutionProvider"])
    engine = Kokoro.from_session(session, request["voices"])
    for job in request["jobs"]:
        audio, cues, cursor = [], [], 0
        mode = job.get("mode", "phrases")
        if mode == "connected":
            signal, sample_rate, cues = connected_speech(engine, job)
            alignment = "model-phoneme-sample-boundaries"
        elif mode == "phrases":
            for phrase in job["phrases"]:
                samples, sample_rate = engine.create(
                    phrase, voice=job["voice"], lang=job["language"], speed=1.0)
                samples = np.asarray(samples, dtype=np.float32)
                if not len(samples) or not np.isfinite(samples).all():
                    raise ValueError("Neural provider returned invalid audio.")
                cues.append({"text": phrase, "start": cursor / sample_rate,
                             "end": (cursor + len(samples)) / sample_rate})
                audio.append(samples)
                # Caption-free breathing room between complete utterances.
                pause = np.zeros(round(sample_rate * 0.15), dtype=np.float32)
                audio.append(pause)
                cursor += len(samples) + len(pause)
            signal = np.concatenate(audio)
            alignment = "synthesized-phrase-sample-boundaries"
        else:
            raise ValueError(f"Unknown narration mode: {mode}")
        signal = np.asarray(signal, dtype=np.float32)
        if not len(signal) or not np.isfinite(signal).all():
            raise ValueError("Neural provider returned invalid audio.")
        rms = float(np.sqrt(np.mean(signal ** 2)))
        peak = float(np.max(np.abs(signal)))
        if rms < 0.001:
            raise ValueError("Neural provider returned effectively silent audio.")
        gain = min(2.0, 0.10 / rms, 0.90 / peak)
        signal *= gain
        target = Path(job["wav"])
        target.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(target), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(sample_rate)
            output.writeframes((signal * 32767).astype("<i2").tobytes())
        Path(job["metadata"]).write_text(json.dumps({
            "duration": len(signal) / sample_rate, "sampleRate": sample_rate,
            "samples": len(signal), "cues": cues, "alignment": alignment,
            "rms": float(np.sqrt(np.mean(signal ** 2))),
            "peak": float(np.max(np.abs(signal))), "gain": gain,
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Synthesized {job['id']}: {len(signal) / sample_rate:.2f}s", flush=True)


if __name__ == "__main__":
    main()

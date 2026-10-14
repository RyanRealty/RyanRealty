#!/usr/bin/env python3
"""video:check check 17 ("Pixels"): run the ryan-studio render gate on the MP4
and also hand back the OCR text of every frame it sampled.

Usage: python3 pixel_gate.py <gate.py> <video.mp4> [--type T] [--silent] [--vo-start S --vo-end S]
Prints one JSON object: {"fails": [...], "info": {...}, "samples": [{"t": s, "text": "..."}]}
or {"error": "...", "missing": "opencv" | "tesseract" | null} with exit code 2.

The gate (.claude/skills/ryan-studio/tools/video_render_gate.py) is imported,
not copied, and its run() is called as is: no stamp file is written (that is
the gate's own main()). Its full-frame OCR samples are recorded by wrapping its
ocr() for the length of the sampling loop, which runs first, every 0.5 s from 0.
"""
import importlib.util
import json
import shutil
import sys

# Importing the gate must not leave a __pycache__ in the skill folder.
sys.dont_write_bytecode = True


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        print(json.dumps({"error": "usage: pixel_gate.py <gate.py> <video.mp4> [gate options]", "missing": None}))
        return 2
    gate_path, video = args[0], args[1]
    rest = args[2:]
    vtype, silent, vo_start, vo_end = "buyer_ad", False, None, None
    i = 0
    while i < len(rest):
        a = rest[i]
        if a == "--type":
            vtype = rest[i + 1]; i += 2
        elif a == "--silent":
            silent = True; i += 1
        elif a == "--vo-start":
            vo_start = float(rest[i + 1]); i += 2
        elif a == "--vo-end":
            vo_end = float(rest[i + 1]); i += 2
        else:
            print(json.dumps({"error": f"unknown option {a}", "missing": None}))
            return 2
    if shutil.which("tesseract") is None:
        print(json.dumps({"error": "tesseract is not on PATH", "missing": "tesseract"}))
        return 2
    try:
        import cv2  # noqa: F401
        import numpy  # noqa: F401
    except Exception as e:  # opencv or numpy missing
        print(json.dumps({"error": f"python opencv/numpy cannot be imported: {e}", "missing": "opencv"}))
        return 2
    spec = importlib.util.spec_from_file_location("video_render_gate", gate_path)
    gate = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gate)

    recorded = []
    state = {"end": False}
    real_ocr = gate.ocr
    real_endcard = gate.endcard_ocr

    def ocr(img):
        text = real_ocr(img)
        if not state["end"]:
            recorded.append(text)
        return text

    def endcard_ocr(img):
        state["end"] = True
        return real_endcard(img)

    gate.ocr = ocr
    gate.endcard_ocr = endcard_ocr
    fails, info = gate.run(video, vtype, silent, vo_start, vo_end)
    # The sampling loop's own times (video_render_gate.run: every 0.5 s while t < duration - 0.01).
    dur, _ = gate.probe(video)
    times = []
    t = 0.0
    while t < dur - 0.01:
        times.append(round(t, 2))
        t += 0.5
    if len(times) != len(recorded):
        print(json.dumps({"error": f"recorded {len(recorded)} OCR samples for {len(times)} sample times; the gate's sampling loop changed", "missing": None}))
        return 2
    samples = [{"t": tt, "text": tx} for tt, tx in zip(times, recorded)]
    print(json.dumps({"fails": fails, "info": info, "samples": samples}))
    return 0


if __name__ == "__main__":
    sys.exit(main())

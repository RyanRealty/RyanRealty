#!/usr/bin/env python3
"""Render-gate tests. Run: python3 tools/tests/test_video_render_gate.py
E2 v3 silent (ends on a 'We'll run your numbers.' off-white card with no 'Call now', hard cut to
the dark mountain) MUST fail on END CARD and LOOP. A 5 s synthetic clip MUST fail LENGTH.
--max-s is the brief's allowed ceiling (video_gate.mjs's Length block): a 35 s market_update (max_s 30,
hard_max_s 40) fails LENGTH without it, and passes LENGTH with it."""
import importlib.util, json, os, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); GATE = os.path.join(HERE, "..", "video_render_gate.py")
E2 = os.environ.get("E2_V3", "/workspace/creative-desk/buyer-pivot/concessions/e2/e2_v3_silent.mp4")
def gate(*a): r = subprocess.run([sys.executable, GATE, *a], capture_output=True, text=True); return r.returncode, r.stdout
ok = True
import re as _re
_src = open(GATE).read(); _m = _re.search(r'^CTA_WORDS = re\.compile\(r"(.*)", re\.I\)$', _src, _re.M)
_cta = _re.compile(_m.group(1), _re.I)
def check(c, m):
    global ok; print(("PASS " if c else "FAIL ") + m); ok &= bool(c)
check(not _cta.search("Ye Tag tape eee A Oe * Be Sg"), "junk OCR 'tape' is not a CTA")
check(bool(_cta.search("Tap to call")), "a real 'tap' is a CTA")
if os.path.exists(E2):
    rc, out = gate(E2, "--silent")
    check(rc == 1, "e2_v3 exits 1"); check("END CARD" in out, "e2_v3 fails END CARD"); check("LOOP" in out, "e2_v3 fails LOOP")
    rc, out = gate(E2)
    check(rc == 1 and "CAPTIONS" in out, "e2_v3 without --silent fails CAPTIONS (buyer_ad, no audio)")
else: print(f"skip e2_v3 (not found: {E2})")
with tempfile.TemporaryDirectory() as d:
    f = os.path.join(d, "short.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=c=0x102a43:s=540x960:d=5", "-pix_fmt", "yuv420p", f], check=True)
    rc, out = gate(f, "--silent"); check(rc == 1 and "LENGTH" in out and "HOOK" in out, "5 s blank clip fails LENGTH + HOOK")

# --max-s (the brief's allowed ceiling). Frames are blank and OCR is stubbed out: only LENGTH is judged,
# through the gate's own run(), so no tesseract time is spent.
spec = importlib.util.spec_from_file_location("video_render_gate", GATE)
G = importlib.util.module_from_spec(spec); sys.dont_write_bytecode = True; spec.loader.exec_module(G)
G.ocr = lambda img: ""; G.endcard_ocr = lambda img: ""
with tempfile.TemporaryDirectory() as d:
    f = os.path.join(d, "long.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=c=0x102a43:s=216x384:r=10:d=35", "-pix_fmt", "yuv420p", f], check=True)
    length = lambda **k: [x for x in G.run(f, "market_update", True, None, None, **k)[0] if x.startswith("LENGTH")]
    check(len(length()) == 1 and "15-30" in length()[0], "35 s market_update with no --max-s fails LENGTH against the type's own 30 s")
    check(length(max_s=30.0) != [], "--max-s 30 (no length_reason: the type's max_s) still fails a 35 s film")
    check(length(max_s=40.0) == [], "--max-s 40 (length_reason: the type's hard_max_s) lets a 35 s film through LENGTH")
    check(length(max_s=34.9) != [], "--max-s under the run still fails LENGTH")
    check(length(max_s=float("inf")) == [], "--max-s inf (a Matt length override: no ceiling) lets a 35 s film through LENGTH")
    info = G.run(f, "market_update", True, None, None, max_s=float("inf"))[1]
    check(info["length_window_s"] == [15.0, None], "the stamp records the window it judged: no ceiling is null, not Infinity")
    check(json.dumps(info, allow_nan=False) != "", "the stamp's info is strict JSON with no ceiling")
    check(G.run(f, "market_update", True, None, None, max_s=40.0)[1]["length_window_s"] == [15.0, 40.0], "the stamp records the window 15-40")
    rc, out = gate(f, "--silent", "--type", "market_update", "--max-s", "10")
    check(rc == 2 and "under the market_update minimum" in out, "--max-s under the type's min_s is a usage error (exit 2), not a pass")
check(G.length_window("story_teaser") == (7.0, 15.0), "the type's own window is the default")

# End-card pill OCR (2026-10-13): full-frame tesseract misses 'Call now' inside the navy EndCardV5 pill.
# The voiced E2 v4 candidate must PASS END CARD; the same video with the pill text blanked, or cut before
# the end card, must still FAIL END CARD.
E2V4 = os.environ.get("E2_V4", "/workspace/creative-desk/buyer-pivot/concessions/e2/e2_v4.mp4")
if os.path.exists(E2V4):
    rc, out = gate(E2V4); check(rc == 0 and "END CARD" not in out, "e2_v4 voiced passes (Call now read from the pill)")
    with tempfile.TemporaryDirectory() as d:
        blank = os.path.join(d, "blank.mp4"); cut = os.path.join(d, "cut.mp4")
        subprocess.run(["ffmpeg", "-v", "error", "-i", E2V4, "-vf", "drawbox=x=200:y=1135:w=680:h=160:color=0x102742:t=fill:enable='gte(t,21.5)'",
                        "-c:a", "copy", blank], check=True)
        rc, out = gate(blank); check(rc == 1 and "missing Call now" in out, "e2_v4 with the pill text blanked fails END CARD (Call now)")
        subprocess.run(["ffmpeg", "-v", "error", "-i", E2V4, "-t", "21.4", "-c:a", "copy", cut], check=True)
        rc, out = gate(cut); check(rc == 1 and "END CARD" in out, "e2_v4 cut before the end card fails END CARD")
else: print(f"skip e2_v4 (not found: {E2V4})")
sys.exit(0 if ok else 1)

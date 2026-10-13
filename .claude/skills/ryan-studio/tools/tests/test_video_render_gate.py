#!/usr/bin/env python3
"""Render-gate tests. Run: python3 tools/tests/test_video_render_gate.py
E2 v3 silent (ends on a 'We'll run your numbers.' off-white card with no 'Call now', hard cut to
the dark mountain) MUST fail on END CARD and LOOP. A 5 s synthetic clip MUST fail LENGTH."""
import os, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); GATE = os.path.join(HERE, "..", "video_render_gate.py")
E2 = os.environ.get("E2_V3", "/workspace/creative-desk/buyer-pivot/concessions/e2/e2_v3_silent.mp4")
def gate(*a): r = subprocess.run([sys.executable, GATE, *a], capture_output=True, text=True); return r.returncode, r.stdout
ok = True
def check(c, m):
    global ok; print(("PASS " if c else "FAIL ") + m); ok &= bool(c)
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

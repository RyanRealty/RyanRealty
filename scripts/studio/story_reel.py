#!/usr/bin/env python3
"""
scripts/studio/story_reel.py -- cut a story film into a finished 9:16 reel.

Reads what scripts/studio/story-film.ts produced in out/story/<piece>/
(manifest.json, plan.json, lab.json, payoff.json, assets/) plus an edit
decision list, edl.json, that a person owns: trims, zooms, which clip, where
the music sits. `edl` writes a first EDL from the plan so there is always one
to edit; `build` renders it.

  python3 scripts/studio/story_reel.py sign  --dir out/story/winter-1982 [--corners x1,y1,x2,y2,x3,y3,x4,y4]
  python3 scripts/studio/story_reel.py sign-clip --dir out/story/winter-1982 --role phone --corners ...  (tracked, for moving clips)
  python3 scripts/studio/story_reel.py edl   --dir out/story/winter-1982
  python3 scripts/studio/story_reel.py build --dir out/story/winter-1982 [--draft]
  python3 scripts/studio/story_reel.py build --dir out/story/winter-1982 --lab lab-cine16_1978.json --name reel-cine16_1978

What the reel is made of (docs/STORY_FILMS.md):
  film segments  each selected clip through scripts/studio/filmlab.py (one stock),
                 shown as a backlit film strip: the current frame lit, the
                 neighbouring frames dim, the perforation glowing cream
  the sign       a still, never a generated sign: our real sign art warped onto
                 the blank panel, lit to match, then moved by the lab (handheld +
                 an exact power zoom), because the brand never goes through a
                 generator
  the break      the present-day phone screen, full frame and sharp, the only
                 sharp frames in the film
  the end        the reel runs out: the image burns, clear leader floods cream,
                 the wordmark and the line land on the score's final chord
  sound          built here, not generated: the score cut at the break, a
                 projector that winds down when the phone appears and spins back
                 up, a US ringback, a pickup click, the tail of the film flapping
                 at run-out; loudness to -14 LUFS for social
"""
import argparse
import hashlib
import json
import math
import os
import re
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
FILMLAB = os.path.join(HERE, "filmlab.py")
W, H = 1080, 1920
FPS = 30
SR = 48000
CREAM = (250, 248, 244)
NAVY = (16, 39, 66)
BASE = (18, 15, 13)  # film base on a light table: near black, warm
AMBOQIA = os.path.join(ROOT, "public/fonts/Amboqia_Boriango.otf")
GEIST = os.path.join(ROOT, "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf")
GEIST_MED = os.path.join(ROOT, "node_modules/geist/dist/fonts/geist-sans/Geist-Medium.ttf")

# Strip layout. The frame sits in the upper-middle so the caption band above
# and the platform UI below both stay clear (safe zone: y 220..1500).
FRAME_W, FRAME_H = 984, 738
FRAME_X = 80
FRAME_CY = 860
FRAME_GAP = 34
PERF_W, PERF_H, PERF_X = 38, 54, 22


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def load_json(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path) as f:
        return json.load(f)


# ── sign composite ─────────────────────────────────────────────────────────

def detect_panel(img):
    """The blank sign panel: the largest bright, low-saturation convex quad that
    is not the ground (snow). Returns 4 corners TL,TR,BR,BL or None."""
    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
    v = hsv[..., 2].astype(np.float32)
    s = hsv[..., 1].astype(np.float32)
    thr = np.percentile(v, 90)
    mask = ((v >= thr * 0.92) & (s < 70)).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best, best_score = None, 0.0
    for c in contours:
        area = cv2.contourArea(c)
        if area < 0.004 * w * h or area > 0.25 * w * h:
            continue
        approx = cv2.approxPolyDP(c, 0.04 * cv2.arcLength(c, True), True)
        if len(approx) != 4 or not cv2.isContourConvex(approx):
            continue
        x, y, bw, bh = cv2.boundingRect(approx)
        ratio = bw / max(1, bh)
        if not 0.6 < ratio < 1.6:
            continue
        rect_fill = area / max(1, bw * bh)
        score = area * rect_fill
        if score > best_score:
            best, best_score = approx.reshape(4, 2).astype(np.float32), score
    if best is None:
        return None
    s_ = best.sum(1)
    d = np.diff(best, axis=1).ravel()
    return np.array([best[np.argmin(s_)], best[np.argmin(d)], best[np.argmax(s_)], best[np.argmax(d)]], np.float32)


def composite_sign(still_path, panel_path, out_path, corners=None, debug=None, upscale=2):
    """Composite at `upscale`x the plate: the amateur zoom lands on the sign, so the
    sign needs pixels the 1k plate does not have. Our art has them (2954px)."""
    base = Image.open(still_path).convert("RGB")
    img0 = np.array(base)
    quad = np.array(corners, np.float32).reshape(4, 2) if corners else detect_panel(img0)
    if quad is not None:
        quad = quad * upscale
    img = np.array(base.resize((base.width * upscale, base.height * upscale), Image.LANCZOS))
    if quad is None:
        sys.exit("sign: could not find the blank panel; pass --corners x1,y1,...,x4,y4 (TL,TR,BR,BL)")
    art = Image.open(panel_path).convert("RGBA")
    board = Image.new("RGBA", art.size, (244, 242, 236, 255))
    board.alpha_composite(art)
    board = np.array(board.convert("RGB")).astype(np.float32) / 255.0
    ah, aw = board.shape[:2]
    src = np.array([[0, 0], [aw - 1, 0], [aw - 1, ah - 1], [0, ah - 1]], np.float32)
    M = cv2.getPerspectiveTransform(src, quad)
    h, w = img.shape[:2]
    warped = cv2.warpPerspective(board, M, (w, h), flags=cv2.INTER_AREA)
    mask = cv2.warpPerspective(np.ones((ah, aw), np.float32), M, (w, h), flags=cv2.INTER_LINEAR)
    mask = cv2.GaussianBlur(mask, (0, 0), 0.8)[..., None]
    # Light the art with the plate: the blank panel's own shading and colour cast.
    plate = img.astype(np.float32) / 255.0
    panel_region = (mask[..., 0] > 0.9)
    shade = cv2.GaussianBlur(plate, (0, 0), 6 * upscale)
    ref = np.percentile(shade[panel_region], 92, axis=0) if panel_region.any() else np.ones(3)
    lit = warped * np.clip(shade / np.maximum(ref, 1e-3), 0.0, 1.2) * ref
    out = plate * (1 - mask) + lit * mask
    Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out_path, quality=95)
    center = quad.mean(0)
    info = {"quad": quad.tolist(), "center": [float(center[0] / w), float(center[1] / h)], "size": [w, h]}
    if debug:
        dbg = img.copy()
        cv2.polylines(dbg, [quad.astype(np.int32)], True, (255, 0, 0), 3)
        Image.fromarray(dbg).save(debug)
    return info


def track_sign(clip_path, panel_path, out_path, still_quad, still_size, debug=None):
    """Our sign art on the blank panel of a MOVING clip.

    Tracking: ECC homography of the sign's own neighbourhood (panel, post, arm,
    porch), frame 0 to frame k, warm-started from the previous frame. The
    template mask keeps only low-saturation pixels, so a brown jacket or a thumb
    crossing the region never drags the track.
    Occlusion: the art lands only where frame k still shows the blank panel's
    neutral colour, so a hand passing in front stays in front.
    Lighting: the blank panel's own per-frame shading is multiplied into the art.
    """
    w, h, fps, _ = probe_video(clip_path)
    sx, sy = w / still_size[0], h / still_size[1]
    q0 = np.array(still_quad, np.float32).reshape(4, 2) * np.array([sx, sy], np.float32)
    art = Image.open(panel_path).convert("RGBA")
    board = Image.new("RGBA", art.size, (244, 242, 236, 255))
    board.alpha_composite(art)
    board = np.array(board.convert("RGB")).astype(np.float32) / 255.0
    ah, aw = board.shape[:2]
    art_corners = np.array([[0, 0], [aw - 1, 0], [aw - 1, ah - 1], [0, ah - 1]], np.float32)

    pad = int(0.45 * max(np.ptp(q0[:, 0]), np.ptp(q0[:, 1])))
    x0, y0 = max(0, int(q0[:, 0].min()) - pad), max(0, int(q0[:, 1].min()) - pad)
    x1, y1 = min(w, int(q0[:, 0].max()) + pad), min(h, int(q0[:, 1].max()) + pad)
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", clip_path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                           stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
                            "-r", str(fps), "-i", "-", "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", out_path],
                           stdin=subprocess.PIPE)
    template = mask = None
    warp = np.eye(3, dtype=np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 80, 1e-5)
    quads = []
    k = 0
    while True:
        raw = dec.stdout.read(w * h * 3)
        if len(raw) < w * h * 3:
            break
        frame = np.frombuffer(raw, np.uint8).reshape(h, w, 3)
        gray = cv2.GaussianBlur(cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY), (0, 0), 1.2).astype(np.float32) / 255.0
        roi = gray[y0:y1, x0:x1]
        if template is None:
            template = roi.copy()
            sat = cv2.cvtColor(frame[y0:y1, x0:x1], cv2.COLOR_RGB2HSV)[..., 1]
            mask = (sat < 70).astype(np.uint8)
        else:
            try:
                _, warp = cv2.findTransformECC(template, roi, warp, cv2.MOTION_HOMOGRAPHY, criteria, mask, 5)
            except cv2.error:
                pass  # keep the previous warp for a frame ECC cannot settle
        local = (q0 - np.array([x0, y0], np.float32)).reshape(-1, 1, 2)
        qk = cv2.perspectiveTransform(local, warp).reshape(4, 2) + np.array([x0, y0], np.float32)
        quads.append(qk.tolist())
        M = cv2.getPerspectiveTransform(art_corners, qk)
        warped = cv2.warpPerspective(board, M, (w, h), flags=cv2.INTER_AREA)
        quad_mask = cv2.warpPerspective(np.ones((ah, aw), np.float32), M, (w, h), flags=cv2.INTER_LINEAR)
        plate = frame.astype(np.float32) / 255.0
        lab = cv2.cvtColor(frame, cv2.COLOR_RGB2LAB).astype(np.float32)
        chroma = np.sqrt((lab[..., 1] - 128) ** 2 + (lab[..., 2] - 128) ** 2)
        key = 1.0 - smoothstep_np(9.0, 16.0, chroma)
        alpha = cv2.GaussianBlur(quad_mask * key, (0, 0), 0.9)[..., None]
        shade = cv2.GaussianBlur(plate, (0, 0), 8)
        inside = (quad_mask > 0.9) & (key > 0.9)
        ref = np.percentile(shade[inside], 92, axis=0) if inside.sum() > 50 else np.ones(3, np.float32)
        lit = warped * np.clip(shade / np.maximum(ref, 1e-3), 0.0, 1.2) * ref
        out = plate * (1 - alpha) + lit * alpha
        enc.stdin.write((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes())
        if debug and k in (0, 70, 140):
            Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(f"{debug}-{k:03d}.jpg", quality=90)
        k += 1
    enc.stdin.close()
    enc.wait()
    dec.wait()
    drift = float(np.abs(np.array(quads[-1]) - np.array(quads[0])).max()) if quads else 0.0
    return {"frames": k, "fps": fps, "maxCornerTravelPx": round(drift, 1), "out": out_path}


def smoothstep_np(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def probe_video(path):
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                      "stream=width,height,r_frame_rate:format=duration", "-of", "json", path],
                                     capture_output=True, text=True, check=True).stdout)
    st = info["streams"][0]
    num, den = st["r_frame_rate"].split("/")
    return st["width"], st["height"], float(num) / float(den), float(info["format"]["duration"])


# ── edit decision list ─────────────────────────────────────────────────────

def default_edl(d):
    plan = load_json(os.path.join(d, "plan.json"))["plan"]
    manifest = load_json(os.path.join(d, "manifest.json"))
    piece = load_json(os.path.join(d, "plan.json"))["piece"]
    segments = []
    for shot in plan["shots"]:
        role = shot["role"]
        seg = {"role": role, "seconds": shot["seconds"]}
        if shot["kind"] == "generated":
            state = manifest["shots"].get(role, {})
            if role == "sign":
                seg.update({"still": "assets/sign-composite.jpg", "handheld": 5.0,
                            "zoom": [[0.0, 1.0, 0.5, 0.5], [0.55, 1.0, 0.5, 0.5], [1.25, 1.85, 0.5, 0.5]]})
            else:
                clip = state.get("selectedClip")
                seg.update({"clip": os.path.relpath(os.path.join(ROOT, clip), d) if clip else None,
                            "trim": [0.4, 0.4 + shot["seconds"]]})
        elif shot["kind"] == "phone_ui":
            seg.update({"tapAt": 1.9, "callAt": 2.3, "tap": [0.5, 0.905]})
        segments.append(seg)
    return {
        "music": {"file": "audio/music-take3.mp3", "offset": 0.0, "endChordAt": 36.9},
        "caption": {"text": piece["openCaption"], "from": 0.25, "to": 3.3},
        "end": {"lines": [piece["endLine"]], "sub": "ryan-realty.com  ·  541.703.3095", "disclosure": "Made with AI"},
        "segments": segments,
    }


# ── film lab per segment ───────────────────────────────────────────────────

def grade_segment(d, seg, lab_all, draft):
    role = seg["role"]
    params = dict(lab_all["lab"][role])
    if seg.get("handheld"):
        params["weave"] = dict(params["weave"])
    key = hashlib.sha1(json.dumps([seg, params], sort_keys=True).encode()).hexdigest()[:10]
    out = os.path.join(d, "graded", f"{role}-{key}.mp4")
    if os.path.exists(out):
        return out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    pfile = os.path.join(d, "graded", f"{role}-{key}.json")
    json.dump(params, open(pfile, "w"))
    if seg.get("still"):
        src = os.path.join(d, "graded", f"{role}-{key}-src.mp4")
        # Keep the still's own resolution (even dimensions): a zoomed still needs every pixel.
        run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", os.path.join(d, seg["still"]), "-t", str(seg["seconds"] + 0.2),
             "-r", "24", "-vf", "crop=trunc(iw/2)*2:trunc(ih/2)*2", "-crf", "12", "-pix_fmt", "yuv420p", src])
        trim = f"0,{seg['seconds']}"
    else:
        src = os.path.join(d, seg["clip"])
        trim = f"{seg['trim'][0]},{seg['trim'][1]}"
    cmd = [sys.executable, FILMLAB, "--in", src, "--out", out, "--params", pfile, "--trim", trim,
           "--seed", str(int(hashlib.sha1(role.encode()).hexdigest(), 16) % 10000)]
    if seg.get("zoom"):
        cmd += ["--zoom", json.dumps(seg["zoom"])]
    if seg.get("handheld"):
        cmd += ["--handheld", str(seg["handheld"])]
    if seg.get("noFlash"):
        cmd += ["--no-flash"]
    run(cmd, stdout=subprocess.DEVNULL)
    return out


def read_video(path):
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                      "stream=width,height,r_frame_rate", "-of", "json", path],
                                     capture_output=True, text=True, check=True).stdout)["streams"][0]
    w, h = info["width"], info["height"]
    num, den = info["r_frame_rate"].split("/")
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True, check=True).stdout
    n = len(raw) // (w * h * 3)
    return np.frombuffer(raw[: n * w * h * 3], np.uint8).reshape(n, h, w, 3), float(num) / float(den)


# ── canvas ─────────────────────────────────────────────────────────────────

def rounded_rect_mask(w, h, r):
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], r, fill=255)
    return np.array(m).astype(np.float32) / 255.0


PERF_MASK = rounded_rect_mask(PERF_W, PERF_H, 9)
_falloff = None


def falloff():
    """Light-table spot: full light on the current frame, dark toward the top and bottom."""
    global _falloff
    if _falloff is None:
        y = np.arange(H, dtype=np.float32)
        top = FRAME_CY - FRAME_H / 2
        bot = FRAME_CY + FRAME_H / 2
        dist = np.where(y < top, top - y, np.where(y > bot, y - bot, 0.0))
        f = np.exp(-(dist / 260.0) ** 1.6) * 0.82 + 0.18 * (dist == 0)
        f = np.where(dist == 0, 1.0, np.minimum(f, 0.26 * np.exp(-dist / 520.0) + 0.02))
        _falloff = f.reshape(H, 1, 1)
    return _falloff


def film_canvas(cur, prev, nxt):
    canvas = np.empty((H, W, 3), np.float32)
    canvas[:] = np.array(BASE, np.float32) / 255.0
    pitch = FRAME_H + FRAME_GAP
    for img, cy in ((prev, FRAME_CY - pitch), (cur, FRAME_CY), (nxt, FRAME_CY + pitch)):
        if img is None:
            continue
        f = cv2.resize(img, (FRAME_W, FRAME_H), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
        y0 = int(cy - FRAME_H / 2)
        ya, yb = max(0, y0), min(H, y0 + FRAME_H)
        if yb <= ya:
            continue
        canvas[ya:yb, FRAME_X:FRAME_X + FRAME_W] = np.maximum(canvas[ya:yb, FRAME_X:FRAME_X + FRAME_W], f[ya - y0:yb - y0])
        # Super 8: one perforation per frame, level with the middle of the frame.
        py = int(cy - PERF_H / 2)
        pa, pb = max(0, py), min(H, py + PERF_H)
        if pb > pa:
            region = canvas[pa:pb, PERF_X:PERF_X + PERF_W]
            m = PERF_MASK[pa - py:pb - py][..., None]
            canvas[pa:pb, PERF_X:PERF_X + PERF_W] = region * (1 - m) + (np.array(CREAM, np.float32) / 255.0) * m
    out = canvas * falloff()
    return out


_font_cache = {}


def font(path, size):
    key = (path, size)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(path, size)
    return _font_cache[key]


def draw_caption(frame_u8, text, alpha):
    if alpha <= 0:
        return frame_u8
    im = Image.fromarray(frame_u8)
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    dr = ImageDraw.Draw(layer)
    f = font(AMBOQIA, 62)
    bb = dr.textbbox((0, 0), text, font=f)
    x = FRAME_X + 6
    y = 300
    dr.text((x, y), text, font=f, fill=CREAM + (int(255 * alpha),))
    im = Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")
    return np.array(im)


def phone_frame(assets, t, seg):
    """The break: sharp, full frame. A little settle, a tap, the calling screen."""
    tap_at, call_at = seg["tapAt"], seg["callAt"]
    if t >= call_at:
        base = assets["calling"]
    elif t >= tap_at:
        base = assets["pressed"]
    else:
        base = assets["page"]
    img = base
    if t < call_at:
        settle = 18.0 * math.exp(-t / 0.18)  # the thumb just stopped scrolling
        M = np.float32([[1, 0, 0], [0, 1, settle]])
        img = cv2.warpAffine(base, M, (W, H), borderMode=cv2.BORDER_REPLICATE)
    if tap_at <= t < call_at:
        u = (t - tap_at) / max(0.05, call_at - tap_at)
        im = Image.fromarray(img).convert("RGBA")
        layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
        cx, cy = seg["tap"][0] * W, seg["tap"][1] * H
        r = 40 + 90 * u
        ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r], fill=(250, 248, 244, int(110 * (1 - u))))
        img = np.array(Image.alpha_composite(im, layer).convert("RGB"))
    return img


def end_card(t, seconds, cfg, last_film):
    """Run-out: the frame burns, clear leader floods cream, the card lands."""
    burn = 0.5
    if t < burn and last_film is not None:
        # The film stops in the gate and melts: a white-hot hole grows from one
        # spot with an amber rim, then the light takes the whole frame.
        u = t / burn
        f = last_film.astype(np.float32) / 255.0
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        cx, cy = FRAME_X + FRAME_W * 0.62, FRAME_CY - FRAME_H * 0.1
        theta = np.arctan2(yy - cy, xx - cx)
        # An organic edge: several incommensurate ripples, never a drawn star.
        wobble = (1.0 + 0.09 * np.sin(3 * theta + 0.7) + 0.06 * np.sin(7 * theta + 2.1)
                  + 0.035 * np.sin(13 * theta + 4.0) + 0.02 * np.sin(29 * theta + 1.1 + 6 * u))
        r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / wobble
        radius = 18 + (u ** 1.7) * 900
        hole = np.clip((radius - r) / 30.0, 0.0, 1.0)
        rim = np.exp(-((r - radius) / 38.0) ** 2)
        # The burn happens in the gate: confined to the lit frame until the light floods.
        gate = np.zeros((H, W), np.float32)
        gate[int(FRAME_CY - FRAME_H / 2):int(FRAME_CY + FRAME_H / 2), FRAME_X:FRAME_X + FRAME_W] = 1.0
        gate = cv2.GaussianBlur(gate, (0, 0), 3)
        hole, rim = (hole * gate)[..., None], (rim * gate)[..., None]
        light = np.array([1.0, 0.975, 0.93], np.float32)
        out = f * (1.0 + 0.6 * u) * (1 - hole) + light * hole
        out = out * (1 - rim * 0.75) + np.array([1.0, 0.52, 0.1], np.float32) * rim * 0.95
        flood = float(np.clip((u - 0.6) / 0.4, 0.0, 1.0)) ** 1.5
        out = out * (1 - flood) + light * flood
        return (np.clip(out, 0, 1) * 255).astype(np.uint8)
    card = Image.new("RGB", (W, H), CREAM)
    u = min(1.0, (t - burn) / 0.5)
    logo = Image.open(os.path.join(ROOT, "design_system/ryan-realty/assets/brand/ryan-realty-stacked-logo-blue.png")).convert("RGBA")
    lw = 620
    logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    a = np.array(logo)
    a[..., 3] = (a[..., 3] * u).astype(np.uint8)
    card.paste(Image.fromarray(a), ((W - lw) // 2, 520), Image.fromarray(a))
    dr = ImageDraw.Draw(card)
    v = min(1.0, max(0.0, (t - burn - 0.35) / 0.5))
    col = tuple(int(CREAM[i] + (NAVY[i] - CREAM[i]) * v) for i in range(3))
    y = 1000
    for n, line in enumerate(cfg["lines"]):
        f = font(AMBOQIA, 58) if n == 0 else font(GEIST_MED, 40)
        for chunk in balanced_wrap(dr, line, f, 900):
            bb = dr.textbbox((0, 0), chunk, font=f)
            dr.text(((W - (bb[2] - bb[0])) // 2, y), chunk, font=f, fill=col)
            y += 70 if n == 0 else 54
        sub_col = tuple(int(CREAM[i] + (NAVY[i] - CREAM[i]) * v * 0.72) for i in range(3))
    bb = dr.textbbox((0, 0), cfg["sub"], font=font(GEIST, 32))
    dr.text(((W - (bb[2] - bb[0])) // 2, y + 22), cfg["sub"], font=font(GEIST, 32), fill=sub_col)
    if cfg.get("disclosure"):
        dcol = tuple(int(CREAM[i] + (NAVY[i] - CREAM[i]) * v * 0.45) for i in range(3))
        bb = dr.textbbox((0, 0), cfg["disclosure"], font=font(GEIST, 22))
        dr.text(((W - (bb[2] - bb[0])) // 2, 1420), cfg["disclosure"], font=font(GEIST, 22), fill=dcol)
    out = np.array(card).astype(np.float32)
    # Clear leader is still film: a breath of flicker and a speck or two.
    rng = np.random.default_rng(int(t * 1000))
    out *= 1.0 + rng.normal(0, 0.006)
    if rng.random() < 0.3:
        cv2.circle(out, (int(rng.uniform(0, W)), int(rng.uniform(0, H))), int(rng.uniform(1, 3)), (60, 55, 50), -1)
    return np.clip(out, 0, 255).astype(np.uint8)


def balanced_wrap(dr, text, f, width):
    """One line if it fits; otherwise the two-line split with the most even widths (no orphans)."""
    if dr.textbbox((0, 0), text, font=f)[2] <= width:
        return [text]
    words = text.split()
    best, best_w = None, 1e9
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        wa, wb = dr.textbbox((0, 0), a, font=f)[2], dr.textbbox((0, 0), b, font=f)[2]
        if max(wa, wb) <= width and max(wa, wb) < best_w:
            best, best_w = [a, b], max(wa, wb)
    return best or wrap(dr, text, f, width)


def wrap(dr, text, f, width):
    words, lines, cur = text.split(), [], ""
    for wd in words:
        test = (cur + " " + wd).strip()
        if dr.textbbox((0, 0), test, font=f)[2] > width and cur:
            lines.append(cur)
            cur = wd
        else:
            cur = test
    if cur:
        lines.append(cur)
    return lines


# ── sound ──────────────────────────────────────────────────────────────────

def load_audio(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def projector(seconds, rng, fps=18.0, rate_curve=None):
    """Mechanical clatter at the frame rate, motor hum, a little wow. rate_curve(t)->0..1 winds it."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    rate = np.ones(n) if rate_curve is None else rate_curve(t)
    phase = np.cumsum(fps * rate / SR)
    clicks = np.zeros(n)
    idx = np.where(np.diff(np.floor(phase)) > 0)[0]
    burst = rng.normal(0, 1, 90) * np.exp(-np.arange(90) / 14.0)
    for i in idx:
        amp = 0.55 + 0.2 * rng.random()
        end = min(n, i + 90)
        clicks[i:end] += burst[: end - i] * amp
    b, a = butter_bandpass(900, 4200)
    clicks = lfilter(b, a, clicks)
    hum = 0.25 * np.sin(2 * np.pi * 60 * t) + 0.12 * np.sin(2 * np.pi * 120 * t)
    whir = lfilter(*butter_bandpass(180, 700), rng.normal(0, 1, n)) * 0.35
    sig = (clicks * 0.9 + (hum + whir) * rate) * 0.06
    return np.stack([sig, sig * 0.97], 1).astype(np.float32)


def butter_bandpass(lo, hi):
    from scipy.signal import butter
    return butter(2, [lo / (SR / 2), hi / (SR / 2)], btype="band")


def lfilter(b, a, x):
    from scipy.signal import lfilter as lf
    return lf(b, a, x)


def ringback(seconds):
    """North American ringback: 440 + 480 Hz, two seconds on."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    on = (t % 6.0) < 2.0
    tone = (np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 480 * t)) * 0.5 * on
    tone = lfilter(*butter_bandpass(300, 3400), tone) * 0.09  # through a phone earpiece
    env = np.minimum(1, np.minimum(t / 0.02, np.abs((t % 6.0) - 2.0) / 0.02 + (~on)))
    return np.stack([tone * env, tone * env], 1).astype(np.float32)


def click(level=0.25, length=0.012, tone=2600):
    n = int(length * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * tone * t) * np.exp(-t / (length / 4)) * level
    return np.stack([s, s], 1).astype(np.float32)


def flap(seconds, rng):
    """The tail of the film slapping the reel as it runs out, slowing down."""
    n = int(seconds * SR)
    out = np.zeros(n)
    t, rate = 0.0, 16.0
    while t < seconds:
        i = int(t * SR)
        burst = rng.normal(0, 1, 400) * np.exp(-np.arange(400) / 60.0)
        end = min(n, i + 400)
        out[i:end] += burst[: end - i] * (1 - t / seconds) * 0.8
        rate = max(4.0, rate * 0.93)
        t += 1.0 / rate
    out = lfilter(*butter_bandpass(250, 3000), out) * 0.12
    return np.stack([out, out], 1).astype(np.float32)


def room_tone(seconds, rng):
    """A winter evening outdoors, barely there: so the break is a hush, not dead air."""
    n = int(seconds * SR)
    air = lfilter(*butter_bandpass(120, 900), rng.normal(0, 1, n)) * 0.006
    gust = 0.6 + 0.4 * np.sin(2 * np.pi * np.arange(n) / SR * 0.35 + 0.8)
    env = np.minimum(1, np.minimum(np.arange(n) / (0.25 * SR), (n - np.arange(n)) / (0.2 * SR)))
    sig = air * gust * env
    return np.stack([sig, sig * 0.9], 1).astype(np.float32)


def mix_into(bus, clip, at):
    i = int(at * SR)
    if i >= len(bus):
        return
    end = min(len(bus), i + len(clip))
    bus[i:end] += clip[: end - i]


# ── build ──────────────────────────────────────────────────────────────────

def build(d, draft, lab_file="lab.json", name="reel"):
    edl = load_json(os.path.join(d, "edl.json"))
    lab_all = load_json(os.path.join(d, lab_file))
    segs = edl["segments"]
    starts, t = [], 0.0
    for s in segs:
        starts.append(t)
        t += s["seconds"]
    total = t
    print(f"reel: {len(segs)} segments, {total:.2f}s")

    graded = {}
    for s in segs:
        if s["role"] in ("break", "end"):
            continue
        if not s.get("clip") and not s.get("still"):
            sys.exit(f"segment {s['role']} has no clip or still in edl.json")
        graded[s["role"]] = read_video(grade_segment(d, s, lab_all, draft))
        print(f"  graded {s['role']}")

    assets = d + "/assets"
    phone = {k: np.array(Image.open(f"{assets}/phone-{k}.png").convert("RGB").resize((W, H), Image.LANCZOS))
             for k in ("page", "pressed", "calling")}

    out_video = os.path.join(d, "final", f"{name}-video.mp4")
    os.makedirs(os.path.dirname(out_video), exist_ok=True)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                            "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium" if draft else "slow",
                            "-crf", "18", "-pix_fmt", "yuv420p", out_video], stdin=subprocess.PIPE)
    n_frames = int(round(total * FPS))
    cap = edl.get("caption")
    last_film = None
    for k in range(n_frames):
        gt = k / FPS
        i = max(j for j in range(len(segs)) if starts[j] <= gt + 1e-9)
        s, lt = segs[i], gt - starts[i]
        if s["role"] == "break":
            frame = phone_frame(phone, lt, s)
        elif s["role"] == "end":
            frame = end_card(lt, s["seconds"], edl["end"], last_film)
        else:
            frames, gfps = graded[s["role"]]
            fi = min(len(frames) - 1, int(lt * gfps))
            prev = frames[fi - 1] if fi > 0 else None
            nxt = frames[fi + 1] if fi + 1 < len(frames) else None
            canvas = film_canvas(frames[fi], prev, nxt)
            frame = (np.clip(canvas, 0, 1) * 255 + 0.5).astype(np.uint8)
            if cap and cap["from"] <= gt <= cap["to"]:
                a = min(1.0, (gt - cap["from"]) / 0.3, (cap["to"] - gt) / 0.3)
                frame = draw_caption(frame, cap["text"], a)
            last_film = frame
        enc.stdin.write(frame.tobytes())
    enc.stdin.close()
    enc.wait()

    # Sound.
    rng = np.random.default_rng(1982)
    bus = np.zeros((int(total * SR) + SR, 2), np.float32)
    seg_at = {s["role"]: (starts[j], s) for j, s in enumerate(segs)}
    brk_t, brk = seg_at["break"]
    call_t, _ = seg_at["call"]
    end_t, _ = seg_at["end"]
    music = load_audio(os.path.join(d, edl["music"]["file"]))
    off = int(edl["music"].get("offset", 0.0) * SR)
    body = music[off: off + int(brk_t * SR)].copy()
    fade = int(0.08 * SR)
    body[-fade:] *= np.linspace(1, 0, fade)[:, None]
    mix_into(bus, body * 0.9, 0.0)
    chord_at = edl["music"]["endChordAt"]
    tail = music[int(chord_at * SR):].copy()
    tail[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
    mix_into(bus, tail * 0.95, end_t + float(edl["music"].get("chordAt", 0.5)))
    # Projector: runs, winds down into the break, spins back up for the call.
    wind = 0.45
    mix_into(bus, projector(brk_t, rng, rate_curve=lambda tt: np.clip((brk_t - tt) / wind, 0.0, 1.0) ** 0.7), 0.0)
    mix_into(bus, projector(end_t - call_t, rng, rate_curve=lambda tt: np.clip(tt / 0.3, 0.0, 1.0)), call_t)
    mix_into(bus, flap(1.3, rng), end_t)
    mix_into(bus, room_tone(call_t - brk_t + 0.6, rng), brk_t + 0.15)
    # The present: a tap, the ring, the pickup.
    mix_into(bus, click(0.22, 0.01, 3200), brk_t + brk["tapAt"])
    ring = ringback(2.0)
    mix_into(bus, ring, brk_t + brk["callAt"])
    mix_into(bus, click(0.3, 0.02, 900), brk_t + brk["callAt"] + 2.25)
    bus = bus[: int(total * SR)]
    wav = os.path.join(d, "final", f"{name}-audio.f32")
    bus.astype(np.float32).tofile(wav)

    final = os.path.join(d, "final", f"{name}.mp4")
    run(["ffmpeg", "-v", "error", "-y", "-i", out_video, "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", wav,
         "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
         "-movflags", "+faststart", "-shortest", final])
    print(json.dumps({"final": os.path.relpath(final, ROOT), "seconds": round(total, 2), "frames": n_frames}))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["sign", "sign-clip", "edl", "build"])
    ap.add_argument("--role", default=None)
    ap.add_argument("--dir", required=True)
    ap.add_argument("--corners", default=None)
    ap.add_argument("--draft", action="store_true")
    # A second look of the same edit: story-film.ts `look` writes lab-<era>.json.
    ap.add_argument("--lab", default="lab.json")
    ap.add_argument("--name", default="reel")
    a = ap.parse_args()
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", a.name):
        sys.exit("--name must be lower-case letters, digits, - or _")
    d = os.path.abspath(a.dir)
    if a.cmd == "sign":
        manifest = load_json(os.path.join(d, "manifest.json"))
        still = os.path.join(ROOT, manifest["shots"]["sign"]["selectedStill"])
        corners = [float(v) for v in a.corners.split(",")] if a.corners else None
        info = composite_sign(still, os.path.join(d, "assets/yard-sign-panel.png"),
                              os.path.join(d, "assets/sign-composite.jpg"), corners,
                              debug=os.path.join(d, "assets/sign-detect.jpg"))
        json.dump(info, open(os.path.join(d, "assets/sign.json"), "w"), indent=2)
        print(json.dumps(info))
    elif a.cmd == "sign-clip":
        manifest = load_json(os.path.join(d, "manifest.json"))
        state = manifest["shots"][a.role]
        clip = os.path.join(ROOT, state["selectedClip"])
        still = Image.open(os.path.join(ROOT, state["selectedStill"]))
        corners = [float(v) for v in a.corners.split(",")]
        out = os.path.join(d, "assets", f"{a.role}-signed.mp4")
        info = track_sign(clip, os.path.join(d, "assets/yard-sign-panel.png"), out, corners, still.size,
                          debug=os.path.join(d, "assets", f"{a.role}-signed"))
        print(json.dumps(info))
    elif a.cmd == "edl":
        path = os.path.join(d, "edl.json")
        if os.path.exists(path):
            sys.exit("edl.json exists; edit it (delete it to regenerate)")
        json.dump(default_edl(d), open(path, "w"), indent=2)
        print(f"wrote {os.path.relpath(path, ROOT)}")
    else:
        build(d, a.draft, a.lab, a.name)


if __name__ == "__main__":
    main()

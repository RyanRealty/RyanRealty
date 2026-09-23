#!/usr/bin/env python3
"""
scripts/studio/filmlab.py -- one film stock for every shot in a story film.

Ten generations from ten calls come back as ten different cameras. This lab is
what makes them one reel: every clip goes through the same stock model, grain,
weave, halation, flicker and gate, driven by the era pack in
lib/studio/story/eras.ts (LabParams). The generator is never asked for a
"vintage look"; the look lives here, where it is identical shot to shot and
exact to the frame (docs/STORY_FILMS.md).

Order of operations per output frame (each step names the artifact it models):
  cadence   pick the source frame at the era's projection rate (18 fps Super 8),
            nearest-frame, never interpolated: the judder is the format
  camera    zoom keyframes (a power zoom is exact here; asked of a generator it
            breathes) + band-limited gate weave, one affine warp
  optics    gaussian softness at gate resolution
  stock     tone curve and dye model per stock (Kodachrome 40, Kodachrome II,
            Plus-X, VHS), exposure variant for interiors and night
  halation  red-orange bloom where highlights sit on dark ground
  vignette  corner falloff that breathes slightly with the flicker
  flicker   frame-to-frame exposure wobble
  grain     per-frame, clumped, luminance-weighted, part luma part dye cloud
  dust      reversal-film dust (dark specks) and the odd hair
  flash     overexposed frames at the head of a shot (in-camera edit)
  gate      the camera gate: rounded corners, soft edge, black outside

Usage:
  python3 scripts/studio/filmlab.py --in clip.mp4 --out graded.mp4 --params lab.json \
      [--trim 0.4,3.2] [--zoom '[[0.6,1.0,0.5,0.5],[1.3,1.9,0.72,0.55]]'] [--seed 7] [--no-flash] [--handheld 5]

  --params  a JSON object holding one LabParams (plus "exposure"), or a lab.json
            written by story-film.ts together with --role to pick the shot
  --zoom    keyframes [t_seconds_into_trim, scale, center_x, center_y] (0..1)
"""
import argparse
import json
import math
import subprocess
import sys

import cv2
import numpy as np

WORK_SCALE = 1.25  # decode larger than the gate so zooms and weave never upscale much


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height,r_frame_rate,nb_frames:format=duration", "-of", "json", path],
        capture_output=True, text=True, check=True,
    ).stdout
    info = json.loads(out)
    s = info["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return int(s["width"]), int(s["height"]), float(num) / float(den), float(info["format"]["duration"])


def read_frames(path, width, height):
    """Decode every frame at working resolution as float32 RGB 0..1."""
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={width}:{height}:flags=lanczos",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True, check=True,
    )
    raw = np.frombuffer(proc.stdout, np.uint8)
    n = raw.size // (width * height * 3)
    return raw[: n * width * height * 3].reshape(n, height, width, 3)


def band_limited(rng, n, period):
    """Unit-std noise correlated over ~period frames: a gate drifts, it does not jitter."""
    pad = int(period * 4) + 2
    white = rng.normal(size=n + 2 * pad)
    if period <= 1:
        return white[pad:pad + n]
    k = np.arange(-pad, pad + 1)
    kernel = np.exp(-0.5 * (k / period) ** 2)
    smooth = np.convolve(white, kernel / kernel.sum(), mode="same")[pad:pad + n]
    std = smooth.std() or 1.0
    return smooth / std


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def luma(img):
    return img[..., 0] * 0.2126 + img[..., 1] * 0.7152 + img[..., 2] * 0.0722


def filmic(x, contrast=1.18, pivot=0.45, strength=0.85):
    """Normalized sigmoid S-curve: deeper blacks, rolled highlights, pivot near mid-grey.
    `contrast` 1.0 is gentle, 1.3 is punchy reversal stock; `strength` blends with identity."""
    x = np.clip(x, 0.0, 1.0)
    k = 4.0 * contrast
    lo = 1.0 / (1.0 + math.exp(k * pivot))
    hi = 1.0 / (1.0 + math.exp(-k * (1.0 - pivot)))
    y = (1.0 / (1.0 + np.exp(-k * (x - pivot))) - lo) / (hi - lo)
    return x + (y - x) * strength


def stock_kodachrome(img, sat, warm, fade):
    """Kodachrome 40: deep neutral blacks, rich reds and warm yellows, greens pulled
    toward olive, skies toward cyan-blue, highlights a touch warm. Aged boxes go
    faintly warm-yellow in the highlights and lift the blacks."""
    mix = np.array([
        [1.06, -0.03, -0.03],
        [-0.04, 1.02, 0.02],
        [-0.02, -0.06, 1.08],
    ], np.float32)
    img = img @ mix.T
    lum = luma(img)[..., None]
    mid = 1.0 - np.abs(lum - 0.5) * 1.6
    img = lum + (img - lum) * (1.0 + (sat - 1.0) * np.clip(mid, 0.2, 1.0))
    img = filmic(img)
    shadows = 1.0 - smoothstep(0.0, 0.45, lum)
    highlights = smoothstep(0.55, 1.0, lum)
    img = img + shadows * np.array([-0.008, 0.004, 0.014], np.float32)
    img = img + highlights * np.array([0.025 + warm, 0.012 + warm * 0.5, -0.02 - warm * 0.4], np.float32)
    if fade > 0:
        aged = img * (1 - 0.06 * fade) + np.array([0.035, 0.022, 0.012], np.float32) * fade
        img = img * (1 - fade) + aged * fade + fade * 0.02
    return np.clip(img, 0.0, 1.0)


def stock_kodachrome2(img, sat, warm, fade):
    img = stock_kodachrome(img, sat * 1.08, warm + 0.01, fade)
    return np.clip(img + np.array([0.01, 0.0, -0.01], np.float32), 0.0, 1.0)


def stock_plusx(img, sat, warm, fade):
    """Plus-X reversal: panchromatic (reds a touch darker than eye), long mid-scale."""
    l = img[..., 0] * 0.28 + img[..., 1] * 0.62 + img[..., 2] * 0.10
    l = filmic(l, contrast=1.22)
    tone = np.array([1.0 + fade * 0.04, 1.0, 1.0 - fade * 0.05], np.float32)
    return np.clip(l[..., None] * tone + fade * 0.03, 0.0, 1.0)


def stock_vhs(img, sat, warm, fade):
    img = filmic(img, contrast=1.08)
    lum = luma(img)[..., None]
    img = lum + (img - lum) * sat * 1.1
    ycc = cv2.cvtColor(np.clip(img, 0, 1).astype(np.float32), cv2.COLOR_RGB2YCrCb)
    h, w = ycc.shape[:2]
    for c in (1, 2):
        small = cv2.resize(ycc[..., c], (max(1, w // 6), h), interpolation=cv2.INTER_AREA)
        ycc[..., c] = cv2.resize(small, (w, h), interpolation=cv2.INTER_CUBIC)
    ycc[..., 1:] = np.roll(ycc[..., 1:], 3, axis=1)
    return np.clip(cv2.cvtColor(ycc, cv2.COLOR_YCrCb2RGB), 0.0, 1.0)


def stock_cine_pastel(img, sat, warm, fade):
    """16mm cinema, muted pastel (the Studio Shibuya reference, measured 2026-09-23):
    low saturation (median ~0.15) with one accent colour allowed to stay, a faint
    green-olive cast through every tone, warm mid-tones, highlights rolled off
    near 0.93 rather than clipped white, blacks lifted to ~0.04."""
    lum = luma(img)[..., None]
    mx, mn = img.max(axis=2, keepdims=True), img.min(axis=2, keepdims=True)
    chroma = mx - mn
    # Mute everything, but let a strong accent (a red scarf, a sign) keep more of itself.
    keep = 0.58 + 0.3 * smoothstep(0.35, 0.7, chroma)
    img = lum + (img - lum) * keep * (sat / 1.14)
    img = filmic(img, contrast=1.05, pivot=0.5, strength=0.6)
    mids = (1.0 - np.abs(lum - 0.5) * 2.0).clip(0, 1)
    img = img + np.array([0.0, 0.022, 0.0], np.float32) + mids * np.array([0.03 + warm, 0.012, -0.02], np.float32)
    img = 0.04 + img * (0.93 - 0.04)
    return np.clip(img, 0.0, 1.0)


STOCKS = {
    "kodachrome40": stock_kodachrome,
    "kodachrome2": stock_kodachrome2,
    "plusx": stock_plusx,
    "vhs": stock_vhs,
    "cine_pastel": stock_cine_pastel,
}


def gate_mask(w, h, corner, feather=2.5):
    mask = np.zeros((h, w), np.float32)
    r = int(corner)
    if r <= 0:
        mask[:] = 1.0
    else:
        cv2.rectangle(mask, (r, 0), (w - 1 - r, h - 1), 1.0, -1)
        cv2.rectangle(mask, (0, r), (w - 1, h - 1 - r), 1.0, -1)
        for cx, cy in ((r, r), (w - 1 - r, r), (r, h - 1 - r), (w - 1 - r, h - 1 - r)):
            cv2.circle(mask, (cx, cy), r, 1.0, -1, lineType=cv2.LINE_AA)
    return cv2.GaussianBlur(mask, (0, 0), feather)[..., None]


def radial(w, h):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx - w / 2) / (w / 2)
    ny = (yy - h / 2) / (h / 2)
    return np.sqrt(nx * nx * 0.85 + ny * ny)


def grain_field(rng, w, h, size, chroma):
    """Clumped grain: noise at 1/size resolution, bicubic up. Luma share + dye-cloud share."""
    gw, gh = max(2, int(w / size)), max(2, int(h / size))
    lum = cv2.resize(rng.normal(size=(gh, gw)).astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC)
    fine = rng.normal(size=(h, w)).astype(np.float32) * 0.35
    lum = (lum + fine) / 1.06
    field = np.repeat(lum[..., None], 3, axis=2) * (1.0 - chroma)
    if chroma > 0:
        dye = cv2.resize(rng.normal(size=(gh, gw, 3)).astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC)
        field = field + dye * chroma
    return field


def draw_dust(rng, img, count):
    h, w = img.shape[:2]
    n = rng.poisson(count)
    if n == 0:
        return img
    layer = np.zeros((h, w), np.float32)
    for _ in range(n):
        x, y = int(rng.uniform(0, w)), int(rng.uniform(0, h))
        if rng.random() < 0.18:
            pts = [(x, y)]
            ang = rng.uniform(0, math.pi)
            for _ in range(int(rng.uniform(6, 16))):
                ang += rng.normal(0, 0.35)
                x += int(4 * math.cos(ang))
                y += int(4 * math.sin(ang))
                pts.append((x, y))
            cv2.polylines(layer, [np.array(pts, np.int32)], False, float(rng.uniform(0.35, 0.8)), 1, lineType=cv2.LINE_AA)
        else:
            cv2.circle(layer, (x, y), int(rng.uniform(1, 3)), float(rng.uniform(0.3, 0.85)), -1, lineType=cv2.LINE_AA)
    layer = cv2.GaussianBlur(layer, (0, 0), 0.7)
    return img * (1.0 - layer[..., None] * 0.9)


def zoom_at(t, keys):
    """Piecewise zoom: [t, scale, cx, cy] keyframes, eased between keys."""
    if not keys:
        return 1.0, 0.5, 0.5
    if t <= keys[0][0]:
        return keys[0][1], keys[0][2], keys[0][3]
    for a, b in zip(keys, keys[1:]):
        if a[0] <= t <= b[0]:
            u = (t - a[0]) / max(1e-6, b[0] - a[0])
            u = u * u * (3 - 2 * u)
            s = a[1] * (b[1] / a[1]) ** u
            return s, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u
    return keys[-1][1], keys[-1][2], keys[-1][3]


def load_params(path, role):
    data = json.load(open(path))
    if "lab" in data and isinstance(data["lab"], dict) and role:
        return data["lab"][role]
    return data


def grade(args):
    p = load_params(args.params, args.role)
    rng = np.random.default_rng(args.seed)
    src_w, src_h, src_fps, duration = probe(args.inp)
    gw, gh = p["gate"]["width"], p["gate"]["height"]
    keys = json.loads(args.zoom) if args.zoom else []
    # Decode at the resolution the deepest zoom needs, never above the source.
    need = max([WORK_SCALE] + [k[1] * 1.05 for k in keys])
    scale = min(need, src_w / gw, src_h / gh) if need > WORK_SCALE else WORK_SCALE
    ww, wh = int(gw * scale) // 2 * 2, int(gh * scale) // 2 * 2
    frames = read_frames(args.inp, ww, wh)
    fps = float(p["fps"])
    t0, t1 = 0.0, len(frames) / src_fps
    if args.trim:
        a, b = [float(v) for v in args.trim.split(",")]
        t0, t1 = max(0.0, a), min(t1, b)
    n_out = max(1, int(round((t1 - t0) * fps)))

    exposure = p.get("exposure", "day")
    low = p["lowLight"]
    exp_mul = low["exposure"] if exposure != "day" else 1.0
    grain_mul = low["grainMul"] if exposure != "day" else 1.0
    sat = 1.14 * (low["satMul"] if exposure != "day" else 1.0)
    warm = low["warm"] if exposure != "day" else 0.0
    stock = STOCKS[p["stock"]]

    weave = p["weave"]
    wx = band_limited(rng, n_out, weave["period"]) * weave["px"]
    wy = band_limited(rng, n_out, weave["period"]) * weave["px"] * 0.7
    wr = band_limited(rng, n_out, weave["period"] * 1.5) * weave["rotDeg"]
    flick = band_limited(rng, n_out, 1.2) * p["flicker"]
    if args.handheld > 0:
        # An amateur holding still: slower, larger drift than the gate weave, for shots moved in code.
        wx = wx + band_limited(rng, n_out, 7) * args.handheld
        wy = wy + band_limited(rng, n_out, 9) * args.handheld * 0.8
        wr = wr + band_limited(rng, n_out, 11) * args.handheld * 0.06
    mask = gate_mask(gw, gh, p["gate"]["corner"])
    rad = radial(gw, gh)
    vign = p["vignette"]
    hal = p["halation"]
    g = p["grain"]
    flash = 0 if args.no_flash else int(p.get("startFlash", 0))

    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{gw}x{gh}",
         "-r", f"{fps}", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "14",
         "-pix_fmt", "yuv420p", "-r", f"{fps}", args.out],
        stdin=subprocess.PIPE,
    )
    for k in range(n_out):
        t = k / fps
        src_index = min(len(frames) - 1, int(round((t0 + t) * src_fps)))
        src = frames[src_index]
        scale, cx, cy = zoom_at(t, keys)
        # One affine: crop to (scale, center), fit to gate, then weave.
        view_w, view_h = ww / scale, wh / scale
        cxp = np.clip(cx * ww, view_w / 2, ww - view_w / 2)
        cyp = np.clip(cy * wh, view_h / 2, wh - view_h / 2)
        fit = gw / view_w * 1.03  # 3% overscan so weave never shows an edge
        ang = math.radians(wr[k])
        cos_a, sin_a = math.cos(ang) * fit, math.sin(ang) * fit
        M = np.array([
            [cos_a, -sin_a, gw / 2 + wx[k] - (cos_a * cxp - sin_a * cyp)],
            [sin_a, cos_a, gh / 2 + wy[k] - (sin_a * cxp + cos_a * cyp)],
        ], np.float32)
        img = cv2.warpAffine(src, M, (gw, gh), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)
        img = img.astype(np.float32) / 255.0
        img = img ** 1.0  # decoded sRGB is treated as the scene; stock curves are tuned for it
        res = float(p.get("resolve", 1.0))
        if res < 0.999:
            small = (max(8, int(gw * res)), max(6, int(gh * res)))
            img = cv2.resize(cv2.resize(img, small, interpolation=cv2.INTER_AREA), (gw, gh), interpolation=cv2.INTER_CUBIC)
        if p["softness"] > 0:
            img = cv2.GaussianBlur(img, (0, 0), p["softness"])
        bloom = float(p.get("bloom", 0.0))
        if bloom > 0:
            soft = cv2.GaussianBlur(img, (0, 0), 7.0)
            img = img + (np.maximum(soft, img) - img) * bloom + soft * bloom * 0.25 * smoothstep(0.55, 1.0, luma(soft))[..., None]
        img = np.clip(img * exp_mul * (1.0 + flick[k]), 0.0, 1.2)
        img = stock(np.clip(img, 0, 1), sat, warm, p["fade"])
        if p.get("monochrome"):
            l = luma(img)
            img = np.repeat(l[..., None], 3, axis=2)
        if hal["strength"] > 0:
            l = luma(img)
            bright = smoothstep(hal["threshold"] - 0.08, hal["threshold"] + 0.12, l)
            glow = cv2.GaussianBlur(bright, (0, 0), hal["radius"])
            ground = 1.0 - smoothstep(0.35, 0.8, l)
            tint = np.array([1.0, 0.36, 0.14], np.float32) if not p.get("monochrome") else np.array([0.8, 0.8, 0.8], np.float32)
            img = img + (glow * (0.45 + 0.55 * ground))[..., None] * tint * hal["strength"]
        breath = 1.0 + flick[k] * 1.5
        v = 1.0 - vign * breath * smoothstep(0.45, 1.25, rad)
        img = img * v[..., None]
        l = luma(np.clip(img, 0, 1))
        # Reversal stock: grain lives in the mid-tones and shadows; clear highlights carry little.
        amp = g["strength"] * grain_mul * (0.22 + 2.6 * l * (1.0 - l)) * (1.0 - 0.55 * smoothstep(0.75, 1.0, l))
        img = img + grain_field(rng, gw, gh, g["size"], g["chroma"]) * amp[..., None]
        img = draw_dust(rng, img, p["dust"])
        if k < flash:
            u = 1.0 - k / max(1, flash)
            img = img * (1.0 + 2.2 * u) + np.array([0.22, 0.12, 0.03], np.float32) * u
        img = np.clip(img, 0.0, 1.0) * mask
        enc.stdin.write((img * 255.0 + 0.5).astype(np.uint8).tobytes())
    enc.stdin.close()
    enc.wait()
    if enc.returncode != 0:
        sys.exit(f"encode failed for {args.out}")
    print(json.dumps({"out": args.out, "frames": n_out, "fps": fps, "trim": [t0, t1], "source_fps": src_fps}))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--params", required=True)
    ap.add_argument("--role", default=None)
    ap.add_argument("--trim", default=None)
    ap.add_argument("--zoom", default=None)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--no-flash", action="store_true")
    ap.add_argument("--handheld", type=float, default=0.0, help="extra handheld sway in px, for stills moved in code")
    grade(ap.parse_args())


if __name__ == "__main__":
    main()

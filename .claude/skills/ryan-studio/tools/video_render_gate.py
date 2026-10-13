#!/usr/bin/env python3
"""Ryan Studio RENDER gate. Runs on the finished mp4. Every check is a HARD FAIL (exit 1).
Nothing is delivered to Matt unless this exits 0. No warnings, no overrides.

Usage: python3 tools/video_render_gate.py <video.mp4> [--type buyer_ad] [--silent]
                 [--vo-start S --vo-end S] [--json]
On PASS writes <video>.gate.json {pass, sha256}; on FAIL deletes any old stamp.
Delivery (tools/deliver_video.sh) refuses any file whose sha256 has no passing stamp.
Exit 0 = PASS, 1 = FAIL (reasons printed), 2 = usage / tooling error (also blocks delivery).
Needs: ffprobe, tesseract (OCR), python3 opencv + numpy.

Checks (all hard-fail):
 1 END SEQUENCE  OCR on frames from the last 4 s (every 0.25 s). Must see, in order of first
                 appearance: the logo (OCR 'Realty' + 'Ryan' or the 'BEND, OREGON' lockup line), Quality, Local, Service, 'Call now',
                 541.703.3095. Any other CTA wording in that window fails ('We'll run your
                 numbers.' etc. are allowed only BEFORE the last 4 s).
 2 LOOP          First vs last frame: grayscale, 72x128 downscale, 5x5 blur. Fails if mean
                 absolute difference > 0.20 (0..1 scale) OR SSIM < 0.35. Calibrated so a solid
                 off-white card vs a dark photo (diff ~0.5+) fails, while a blurred/darkened
                 version of the opening photo behind the end card passes.
 3 LENGTH        15.0 <= duration <= 30.0 s.
 4 HOOK          OCR finds >= 2 words of on-screen text in a frame at or before 2.0 s.
 5 CAPTIONS      Voiced render: OCR text in >= 70% of frames sampled every 0.5 s across the VO
                 span (default 0.5 s .. duration-4 s, or --vo-start/--vo-end). buyer_ad with no
                 audio stream FAILS unless --silent is passed; --silent on a file that has an
                 audio stream also fails (mislabelled).
 6 TOP TEAM      'top team' (any case, any spacing) anywhere on screen fails.
 7 PRICE+CLOSED  Frames sampled every 0.5 s. A frame 'hits' when its OCR shows a price
                 ($ + digits, e.g. $612,000 / $1.2M / $612K) AND 'closed' or 'sold'. Consecutive
                 hits form a segment; any segment lasting <= 3.0 s (+0.5 s sampling slack) fails.
"""
import argparse, json, re, subprocess, sys, tempfile, os
import cv2, numpy as np

LOOP_MAX_DIFF = 0.20
LOOP_MIN_SSIM = 0.35
CTA_WORDS = re.compile(r"run your numbers|call (us|today)|text (us|now)|dm (us|me)|link in bio|book (a|now|your)|schedule|get started|contact us|learn more|visit|let'?s talk|reach out|tap|swipe", re.I)
PRICE = re.compile(r"\$\s?\d[\d,\.]*\s?[kmKM]?")
SOLD = re.compile(r"\b(closed|sold)\b", re.I)

def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type",
                          "-of", "json", path], capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    return float(j["format"]["duration"]), any(s.get("codec_type") == "audio" for s in j.get("streams", []))

class Video:
    def __init__(self, path):
        self.cap = cv2.VideoCapture(path)
        if not self.cap.isOpened(): raise RuntimeError(f"cannot open {path}")
        self.n = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT)); self.fps = self.cap.get(cv2.CAP_PROP_FPS) or 30
    def at(self, t):
        idx = max(0, min(self.n - 1, int(round(t * self.fps))))
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, idx); ok, f = self.cap.read()
        if not ok:  # some encoders under-report; walk back
            for back in range(1, 10):
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, idx - back); ok, f = self.cap.read()
                if ok: break
        return f
    def last(self):
        return self.at(self.n / self.fps)

_cache = {}
def ocr(img):
    key = img.tobytes()[:4096] + bytes(str(img.shape), 'ascii')
    texts = []
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    with tempfile.TemporaryDirectory() as d:
        for i, v in enumerate((g, 255 - g)):  # light-on-dark and dark-on-light
            p = os.path.join(d, f"{i}.png"); cv2.imwrite(p, v)
            r = subprocess.run(["tesseract", p, "-", "--psm", "11"], capture_output=True, text=True)
            texts.append(r.stdout)
    return " ".join(" ".join(texts).split())

def norm_phone(s): return re.sub(r"[^0-9]", "", s)

def run(path, vtype, silent, vo_start, vo_end):
    fails = []; info = {}
    dur, has_audio = probe(path); info["duration_s"] = round(dur, 2); info["audio"] = has_audio
    v = Video(path)
    # 3 length
    if not (15.0 <= dur <= 30.0): fails.append(f"LENGTH: runs {dur:.2f}s; must be 15-30 s.")
    # OCR every 0.5 s across the whole video
    samples = {}
    t = 0.0
    while t < dur - 0.01:
        samples[round(t, 2)] = ocr(v.at(t)); t += 0.5
    # end window: every 0.25 s in last 4 s + true last frame
    endw = {}
    t = max(0.0, dur - 4.0)
    while t < dur - 0.01:
        endw[round(t, 2)] = ocr(v.at(t)); t += 0.25
    endw[round(dur, 2)] = ocr(v.last())
    alltext = list(samples.items()) + list(endw.items())
    # 1 end sequence
    def first(pred):
        for tt, tx in sorted(endw.items()):
            if pred(tx): return tt
        return None
    marks = [
        ("Ryan Realty logo", first(lambda x: re.search(r"realty", x, re.I) and re.search(r"ryan|bend,?\s*oregon", x, re.I))),
        ("Quality", first(lambda x: re.search(r"quality", x, re.I))),
        ("Local", first(lambda x: re.search(r"\blocal\b", x, re.I))),
        ("Service", first(lambda x: re.search(r"service", x, re.I))),
        ("Call now", first(lambda x: re.search(r"call\s*now", x, re.I))),
        ("541.703.3095", first(lambda x: "5417033095" in norm_phone(x))),
    ]
    info["end_sequence_first_seen"] = {k: v_ for k, v_ in marks}
    missing = [k for k, tt in marks if tt is None]
    if missing: fails.append(f"END CARD: last 4 s is missing {', '.join(missing)} (locked: logo -> Quality/Local/Service -> 'Call now' + 541.703.3095).")
    else:
        ts = [tt for _, tt in marks]
        if any(b < a for a, b in zip(ts, ts[1:])): fails.append(f"END CARD: locked elements out of order: {info['end_sequence_first_seen']}.")
    bad = sorted({m.group(0) for _, tx in endw.items() for m in CTA_WORDS.finditer(tx)})
    if bad: fails.append(f"END CARD: other CTA text in the end sequence ({', '.join(bad)}); only 'Call now' + 541.703.3095 is allowed there. Topic CTA cards go before the last 4 s.")
    # 2 loop
    def prep(f):
        g = cv2.cvtColor(cv2.resize(f, (72, 128), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float64) / 255
        return cv2.GaussianBlur(g, (5, 5), 0)
    a, b = prep(v.at(0)), prep(v.last())
    diff = float(np.mean(np.abs(a - b)))
    mu_a, mu_b = a.mean(), b.mean(); va, vb = a.var(), b.var(); cov = ((a - mu_a) * (b - mu_b)).mean()
    c1, c2 = 0.01 ** 2, 0.03 ** 2
    ssim = float(((2 * mu_a * mu_b + c1) * (2 * cov + c2)) / ((mu_a ** 2 + mu_b ** 2 + c1) * (va + vb + c2)))
    info["loop"] = {"mean_abs_diff": round(diff, 3), "ssim": round(ssim, 3), "first_luma": round(mu_a, 3), "last_luma": round(mu_b, 3)}
    if diff > LOOP_MAX_DIFF or ssim < LOOP_MIN_SSIM:
        fails.append(f"LOOP: last frame hard-jumps from the first (mean diff {diff:.3f} > {LOOP_MAX_DIFF} or SSIM {ssim:.3f} < {LOOP_MIN_SSIM}; luma {mu_b:.2f} vs {mu_a:.2f}). Put the opening photo (blurred/darkened) behind the end card.")
    # 4 hook
    hook = [tt for tt, tx in samples.items() if tt <= 2.0 and len(re.findall(r"[A-Za-z]{2,}", tx)) >= 2]
    if not hook: fails.append("HOOK: no on-screen hook text found by OCR in the first 2 s.")
    # 5 captions
    if vtype == "buyer_ad" and not has_audio and not silent:
        fails.append("CAPTIONS: buyer_ad render has no audio. A silent cut passes only with --silent; a voiced cut needs VO + burned-in captions.")
    if silent and has_audio:
        fails.append("CAPTIONS: --silent passed but the file has an audio stream. Strip audio or gate it as voiced.")
    if not silent:
        s0 = vo_start if vo_start is not None else 0.5
        s1 = vo_end if vo_end is not None else dur - 4.0
        span = [(tt, tx) for tt, tx in samples.items() if s0 <= tt <= s1]
        cov_ = sum(1 for _, tx in span if len(re.findall(r"[A-Za-z]{2,}", tx)) >= 1) / max(1, len(span))
        info["caption_coverage"] = round(cov_, 2)
        if cov_ < 0.70: fails.append(f"CAPTIONS: burned-in text on only {cov_:.0%} of the VO span ({s0:.1f}-{s1:.1f}s); need >= 70%.")
    # 6 top team
    tt_hits = sorted({tt for tt, tx in alltext if re.search(r"top\s*team", tx, re.I)})
    if tt_hits: fails.append(f"TOP TEAM: 'top team' wording on screen at {tt_hits[:5]} s.")
    # 7 price + closed short clips
    hits = [tt for tt, tx in sorted(samples.items()) if PRICE.search(tx) and SOLD.search(tx)]
    segs = []
    for tt in hits:
        if segs and abs(tt - segs[-1][1] - 0.5) < 0.01: segs[-1][1] = tt
        else: segs.append([tt, tt])
    for s, e in segs:
        if (e - s + 0.5) <= 3.5: fails.append(f"PRICE+CLOSED: {s:.1f}-{e + 0.5:.1f}s shows a price with closed/sold for <= 3 s.")
    return fails, info

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("--type", default="buyer_ad"); ap.add_argument("--silent", action="store_true")
    ap.add_argument("--vo-start", type=float); ap.add_argument("--vo-end", type=float); ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    try: fails, info = run(a.video, a.type, a.silent, a.vo_start, a.vo_end)
    except Exception as e:
        print(f"RENDER GATE ERROR (blocks delivery): {e}"); sys.exit(2)
    if a.json: print(json.dumps({"fails": fails, "info": info}, indent=1))
    else:
        print(f"info: {json.dumps(info)}")
        for f in fails: print(f"FAIL  {f}")
    stamp = a.video + ".gate.json"
    if fails:
        if os.path.exists(stamp): os.remove(stamp)
        print(f"\nRENDER GATE FAILED ({len(fails)}). Do not deliver. Fix the render and run again."); sys.exit(1)
    import hashlib, datetime
    h = hashlib.sha256(open(a.video, "rb").read()).hexdigest()
    json.dump({"pass": True, "sha256": h, "silent": a.silent, "type": a.type, "info": info,
               "at": datetime.datetime.now().isoformat(timespec="seconds"), "gate": "video_render_gate.py"}, open(stamp, "w"), indent=1)
    print(f"stamp: {stamp} (sha256 {h[:12]})")
    print("RENDER GATE PASSED. All locked rules hold."); sys.exit(0)

if __name__ == "__main__": main()

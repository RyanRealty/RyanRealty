"""
Trace the mown turf of one golf course out of Oregon's own aerial imagery.

WHY. OSM fairway coverage in this region is partial (12 of Tetherow's 18), so a
course drawn from OSM alone is a scatter of floating greens. The fairway system
is visible from the air regardless of tagging, and OSIP 2018 is a public
statewide survey at half-foot resolution.

HOW THE THRESHOLD IS PICKED. Run with --sweep: the candidate bands come back as
red overlays on the aerial, side by side, and the choice is made by looking. A
threshold picked by reasoning about HSV produced 3 acres on one attempt and 425
on another. The band is per course, each choice recorded with its reason in
PER_COURSE_BAND, because what the threshold separates turf FROM differs: sage at
Tetherow, wet meadow at Crosswater.

The acreage printed here measures the imagery. It is not a published figure and
nothing on the site prints it; it exists to compare one run against the last.

    python3 scripts/golf/trace-turf.py <slug> [--osm PATH] [--out-dir DIR]
                                              [--cache DIR] [--sweep]

Reads the course boundary from the OSM cache written by fetch-osm-courses.py and
writes <out-dir>/turf-<slug>.json for scripts/golf/build-course-maps.mjs.
"""
import argparse
import json
import os
import urllib.request

import cv2
import numpy as np
from PIL import Image

# Oregon Statewide Imagery Program, 2018. Public, no key.
OSIP = (
    'https://imagery.oregonexplorer.info/arcgis/rest/services/OSIP_2018/'
    'OSIP_2018_WM/ImageServer/exportImage'
)
RENDER_W = 1900
# The ImageServer's own ceiling on either dimension.
MAX_RENDER_PX = 4000
# A blob smaller than this is a cart path shoulder or a lawn, not turf.
MIN_BLOB_PX = 6000

# hue 25-100 is the whole green band. The three that matter are saturation
# (desert sage is washed out), value (juniper is dark) and excess green.
BANDS = {
    'base': dict(sat=75, val=100, excess_green=8),
    'loose': dict(sat=50, val=90, excess_green=14),
    'looser': dict(sat=38, val=85, excess_green=10),
    'eg20': dict(sat=0, val=80, excess_green=20),
}
DEFAULT_BAND = 'base'

# One band per course. Each entry was chosen from that course's --sweep overlay
# and carries the reason.
#
#   tetherow  — high desert. base traces 51 acres of ribbon, loose 60 with the
#               same edges.
#   crosswater — the Deschutes floodplain. loose floods the wet meadow along the
#               river and reports 115 acres against base's 47; the extra 68 are
#               marsh.
#   sunriver-meadows — the same trap, plus the airfield grass beside it.
#   eagle-crest-ridge — desert. The neighbouring Resort course shows in the frame
#               and is excluded by the boundary, not by the band.
#   aspen-lakes — desert, with irrigated farm fields north of the property that
#               looser starts taking in.
#   juniper   — desert.
#
# Anything not listed gets DEFAULT_BAND, which under-traces rather than over-:
# a missing fairway shows less turf, an invented one shows ground that is not
# there.
PER_COURSE_BAND = {
    # High-desert courses. Sage is grey-green at low saturation, so the loose
    # band fills the fairway corridors and leaves the desert alone. Each one was
    # confirmed on its own sweep, not inherited from the one above it.
    'tetherow': 'loose',
    'eagle-crest-ridge': 'loose',
    'aspen-lakes': 'loose',
    'juniper': 'loose',
}


def bbox_of(rings, pad=0.03):
    xs = [p[0] for r in rings for p in r]
    ys = [p[1] for r in rings for p in r]
    mx = (max(xs) - min(xs)) * pad
    my = (max(ys) - min(ys)) * pad
    return min(xs) - mx, min(ys) - my, max(xs) + mx, max(ys) + my


def fetch_aerial(slug, box, cache_dir):
    x0, y0, x1, y1 = box
    mid = (y0 + y1) / 2
    width = RENDER_W
    height = int(round(width * ((y1 - y0) / ((x1 - x0) * np.cos(np.radians(mid))))))
    # The image server refuses anything over its own limit and answers with a
    # JSON error body, which lands on disk as a .png that PIL cannot open. A tall
    # property (Eagle Crest Ridge) hit it at the default width.
    if height > MAX_RENDER_PX:
        width = int(round(width * MAX_RENDER_PX / height))
        height = MAX_RENDER_PX
    path = os.path.join(cache_dir, f'aerial-{slug}.png')
    if not os.path.exists(path):
        url = (
            f'{OSIP}?bbox={x0},{y0},{x1},{y1}&bboxSR=4326&imageSR=4326'
            f'&size={width},{height}&format=png&f=image'
        )
        os.makedirs(cache_dir, exist_ok=True)
        with urllib.request.urlopen(url, timeout=180) as r:
            body = r.read()
        if body[:8] != b'\x89PNG\r\n\x1a\n':
            raise SystemExit(f'{slug}: image server did not return a PNG: {body[:200]!r}')
        with open(path, 'wb') as f:
            f.write(body)
    return path


def clip_mask(rings, box, size):
    x0, y0, x1, y1 = box
    w, h = size
    clip = np.zeros((h, w), np.uint8)
    for r in rings:
        pts = np.array(
            [[((lo - x0) / (x1 - x0)) * w, ((y1 - la) / (y1 - y0)) * h] for lo, la in r],
            np.int32,
        )
        cv2.fillPoly(clip, [pts], 1)
    return clip


def turf_mask(rgb, clip, band):
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue = hsv[..., 0].astype(int)
    sat = hsv[..., 1].astype(int)
    val = hsv[..., 2].astype(int)
    R = rgb[..., 0].astype(int)
    G = rgb[..., 1].astype(int)
    B = rgb[..., 2].astype(int)
    excess_green = G - (R + B) // 2

    m = (
        (hue >= 25)
        & (hue <= 100)
        & (sat >= band['sat'])
        & (val >= band['val'])
        & (excess_green >= band['excess_green'])
    ).astype(np.uint8)
    # Open drops speckle, close bridges the cart path that cuts a fairway in
    # half. One pass alone leaves one problem or the other.
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    m = m & clip

    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    keep = np.zeros_like(m)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= MIN_BLOB_PX:
            keep[lab == i] = 1
    return keep


def rings_of(mask, box, size):
    x0, y0, x1, y1 = box
    w, h = size
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    for c in contours:
        if cv2.contourArea(c) < MIN_BLOB_PX:
            continue
        c = cv2.approxPolyDP(c, 1.4, True)
        if len(c) < 4:
            continue
        ring = [
            [x0 + (float(q[0][0]) / w) * (x1 - x0), y1 - (float(q[0][1]) / h) * (y1 - y0)]
            for q in c
        ]
        ring.append(ring[0])
        out.append(ring)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('slug')
    ap.add_argument('--osm', default='/tmp/osm-courses.json')
    ap.add_argument('--out-dir', default='/tmp')
    ap.add_argument('--cache', default='/tmp/golf-aerials')
    ap.add_argument('--band', default=None, choices=sorted(BANDS))
    ap.add_argument('--sweep', action='store_true', help='write a side-by-side overlay of every band')
    args = ap.parse_args()

    band = args.band or PER_COURSE_BAND.get(args.slug, DEFAULT_BAND)
    db = json.load(open(args.osm))
    course = db[args.slug]
    rings = course['rings']
    box = bbox_of(rings)
    path = fetch_aerial(args.slug, box, args.cache)

    img = Image.open(path).convert('RGB')
    size = img.size
    rgb = np.asarray(img)
    clip = clip_mask(rings, box, size)

    x0, y0, x1, y1 = box
    mid = (y0 + y1) / 2
    m_per_px_x = (x1 - x0) * 111320 * np.cos(np.radians(mid)) / size[0]
    m_per_px_y = (y1 - y0) * 111320 / size[1]

    if args.sweep:
        panels = []
        for name in sorted(BANDS):
            m = turf_mask(rgb, clip, BANDS[name])
            acres = m.sum() * m_per_px_x * m_per_px_y / 4046.8564224
            ov = rgb.copy()
            ov[m == 1] = (ov[m == 1] * 0.35 + np.array([255, 60, 60]) * 0.65).astype(np.uint8)
            ov = cv2.putText(
                ov.copy(), f'{name} {acres:.0f}ac', (20, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 1.8, (255, 255, 0), 4,
            )
            panels.append(cv2.resize(ov, (size[0] // 3, size[1] // 3)))
            print(f'{name:8} {acres:6.1f} acres')
        out = os.path.join(args.cache, f'sweep-{args.slug}.png')
        Image.fromarray(np.hstack(panels)).save(out)
        print('wrote', out)
        return

    mask = turf_mask(rgb, clip, BANDS[band])
    polys = rings_of(mask, box, size)
    acres = mask.sum() * m_per_px_x * m_per_px_y / 4046.8564224
    out = os.path.join(args.out_dir, f'turf-{args.slug}.json')
    json.dump(
        {'slug': args.slug, 'band': band, 'acres': round(float(acres), 1), 'polys': polys},
        open(out, 'w'),
    )
    print(f'{course["name"]}: band {band}, {len(polys)} turf shapes, {acres:.1f} acres -> {out}')


if __name__ == '__main__':
    main()

"""
Pull every Central Oregon golf course out of OpenStreetMap, one course at a time,
clipped to a boundary that belongs to that course.

TWO BOUNDARY PROVENANCES, one clipping rule. Most courses are clipped to their
own named `leisure=golf_course` polygon in OSM. Four are not, because OSM has no
such polygon for them: Pronghorn, Broken Top, Brasada Canyons and Awbrey Glen.
For a long time the pipeline read that as 'OpenStreetMap has no data for these
courses'. It does — each carries a complete eighteen `golf=hole` ways. They just
sit inside no golf_course polygon, so a fetch that clips to one could never see
them, and the absence was a fact about the query rather than about the world.
For those four the neighborhood polygon in public.boundaries IDENTIFIES the
course and the course's own holes DELIMIT it. Neither half works alone. The
neighborhood polygon is not a course extent — Pronghorn's covers four of the
twenty-one holes on the property and Broken Top's covers the whole residential
community — so clipping to it directly loses most of one course and floods the
other with everything green inside a subdivision. And a bare hole cluster has no
name. So: cluster the region's `golf=hole` ways, ask which cluster falls inside
the neighborhood we already own a polygon for, and take that cluster's own
bounding extent as the boundary. It is not a radius around a clubhouse — a radius
around Crosswater also returns Caldera Links a kilometre away, which is what
started the boundary rule.

WHY THE BOUNDARY AND NOT A RADIUS. The first version queried a radius around
each clubhouse. Crosswater's radius also returns Caldera Links a kilometre away
and the map then numbers 36 holes 1 to 18 twice; Sunriver returned 28 'holes'
for an 18-hole course. Every feature kept here has its centroid inside the named
`leisure=golf_course` polygon for that course, which is what separates two
courses sharing a resort.

The public Overpass endpoint rate-limits and 504s on a run this size, so this
alternates mirrors, backs off, and saves after every course; a killed run resumes
where it stopped.

    python3 scripts/golf/fetch-osm-courses.py [--out PATH] [--polys PATH]

--polys is the cached list of named golf_course polygons for the region:

    [out:json][timeout:180];
    (way["leisure"="golf_course"](43.2,-122.2,44.9,-120.8);
     relation["leisure"="golf_course"](43.2,-122.2,44.9,-120.8););
    out tags center;

Writes {slug: {name, rings, features, holes}} for scripts/golf/build-course-maps.mjs.
"""
import argparse
import collections
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

HOSTS = [
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
]
UA = {'User-Agent': 'RyanRealty course map (matt@ryan-realty.com)'}

# Our slug -> the course's OSM `name`. The OSM name is not our display name and
# not our registry slug, so the join is written out rather than guessed.
COURSES = [
    ('tetherow', 'Tetherow Golf Club'),
    ('crosswater', 'Crosswater Golf Course'),
    ('sunriver-meadows', 'Meadows Golf Course'),
    ('sunriver-woodlands', 'Woodlands Golf Course'),
    ('caldera-links', 'Caldera Links Golf Course'),
    ('widgi-creek', 'Widgi Creek Golf Course'),
    ('black-butte-big-meadow', 'Big Meadow Golf Course'),
    ('black-butte-glaze-meadow', 'Glaze Meadow Golf Course'),
    ('eagle-crest-resort', 'The Resort Course At Eagle Crest'),
    ('eagle-crest-ridge', 'Eagle Crest Ridge Course'),
    ('aspen-lakes', 'Aspen Lakes Golf Course'),
    ('juniper', 'Juniper Golf Course'),
    ('lost-tracks', 'Lost Tracks Golf Course'),
    ('quail-run', 'Quail Run Golf Course'),
    ('rivers-edge', "River's Edge Golf Course"),
    ('bend-golf-country-club', 'Bend Golf & Country Club'),
    ('meadow-lakes', 'Meadow Lakes Golf Course'),
    ('crooked-river-ranch', 'Crooked River Ranch Golf Course'),
    ('old-back-nine', 'Old Back Nine Golf Club'),
]

# Courses with no `leisure=golf_course` polygon in OSM, identified by our own
# neighborhood boundary. The value is the boundary's geo_slug, which is NOT
# always the course slug: Awbrey Glen has a neighborhood row of its own, but
# the golf course sits on Awbrey Butte, so its holes fall inside
# `bend-awbrey-butte`. Written out for the same reason the OSM name join is.
#
# The neighborhood polygon IDENTIFIES the cluster. It does not always DELIMIT
# it. Pronghorn's covers 4 of 21 holes on the property, so clipping to the hood
# ring would throw the other fourteen away. Broken Top's covers the whole
# residential community, so a duplicate-ref cluster (Broken Top chained into
# Tetherow) is narrowed to the hood. Same join, two clipping rules — see
# `narrow_cluster`.
NEIGHBORHOOD_COURSES = [
    ('pronghorn', 'pronghorn', 'Pronghorn Nicklaus'),
    ('broken-top', 'broken-top', 'Broken Top Club'),
    ('brasada-canyons', 'brasada-ranch', 'Brasada Canyons'),
    # Eighteen routings, 24 greens, 79 tees, 48 bunkers, and one tag on every one
    # of them: `golf`. No ref anywhere, so the course is drawn and not numbered.
    ('awbrey-glen', 'bend-awbrey-butte', 'Awbrey Glen'),
]

# Found by the same sweep, not written, and why. These are here so the next run
# does not rediscover them and reach a different conclusion.
#
#   pronghorn-fazio — leftovers on the same property as the Nicklaus routing:
#       an untagged duplicate `ref=17` farther west and two unnumbered ways.
#       Nothing in the tags names them Fazio. Numbering them would invent a
#       course, so they stay dropped. The Nicklaus eighteen is the cluster
#       whose par sequence 4-5-3-4-4-4-3-5-4-4-4-4-4-3-5-5-3-4 matches the
#       operator scorecard (PRH-SC.pdf, titled NICKLAUS COURSE, TIPS 7,379)
#       and USGA CourseID 5779.
#   quail-run — eighteen routings inside its own OSM polygon and almost nothing
#       else: one fairway, four water hazards, no greens, no tees, no bunkers,
#       and no `ref` on any of it. It is drawn unnumbered like Awbrey Glen; the
#       body of that drawing is the aerial turf trace, not OSM.

# Two holes on neighbouring courses can lie closer together than two holes on the
# same course, so the link distance is the one number that decides whether a
# cluster is one course or two. 700 m holds: the widest gap between consecutive
# holes measured on the sixteen courses already built is under 500 m, and the
# nearest pair of holes on DIFFERENT courses in this region (Crosswater and
# Caldera Links) is 800 m apart. A cluster is verified after the fact anyway —
# it has to produce a complete ref set for the published hole count.
CLUSTER_LINK_M = 700
# How far past the outermost hole the course extent reaches. A green sits at the
# end of its routing and the bunkers guarding it sit past that; 150 m covers the
# putting complex without reaching the next property.
EXTENT_MARGIN_M = 150

FEATURE_KINDS = (
    'hole', 'fairway', 'green', 'tee', 'bunker',
    'water_hazard', 'lateral_water_hazard', 'rough', 'driving_range', 'clubhouse',
)


def ask(query, tries=4, timeout=90):
    last = ''
    for i in range(tries):
        host = HOSTS[i % len(HOSTS)]
        try:
            req = urllib.request.Request(
                host, data=urllib.parse.urlencode({'data': query}).encode(), headers=UA
            )
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read())
        except Exception as e:  # noqa: BLE001 - any transport failure is a retry
            last = str(e)[:80]
            time.sleep(4)
    print(f'   overpass gave up: {last}')
    return None


def ring_of(el):
    g = el.get('geometry')
    return [[p['lon'], p['lat']] for p in g] if g else None


def rings_of_relation(el):
    out = []
    for m in el.get('members', []):
        if m.get('type') == 'way' and m.get('geometry') and m.get('role') in ('outer', '', None):
            out.append([[p['lon'], p['lat']] for p in m['geometry']])
    return out


def inside(pt, ring):
    """Ray cast. The rings are course boundaries, so a few hundred vertices."""
    c = False
    n = len(ring)
    for i in range(n):
        j = (i - 1) % n
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > pt[1]) != (yj > pt[1])) and (
            pt[0] < (xj - xi) * (pt[1] - yi) / ((yj - yi) or 1e-12) + xi
        ):
            c = not c
    return c


def harvest(rings):
    """Every golf feature whose centroid lies inside `rings`.

    Both boundary provenances run through this, so 'inside the boundary' means
    exactly one thing whether the boundary came from OSM or from our own
    boundaries table.
    """
    xs = [p[0] for r in rings for p in r]
    ys = [p[1] for r in rings for p in r]
    bbox = (min(ys), min(xs), max(ys), max(xs))
    time.sleep(1)
    d = ask(
        f'[out:json][timeout:90];'
        f'(way["golf"]({bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}););out tags geom;',
        tries=2,
        timeout=90,
    )
    if d is None:
        return None, None
    keep = []
    for e in d.get('elements', []):
        g = e.get('geometry')
        if not g:
            continue
        cx = sum(p['lon'] for p in g) / len(g)
        cy = sum(p['lat'] for p in g) / len(g)
        if any(inside([cx, cy], r) for r in rings):
            keep.append(e)
    holes = sorted(
        {(e.get('tags') or {}).get('ref') for e in keep
         if (e.get('tags') or {}).get('golf') == 'hole'} - {None}
    )
    return keep, holes


def hole_clusters(cache=None):
    """Every golf=hole way in the region, single-link clustered at CLUSTER_LINK_M.

    One query, cached to disk. Per-course bbox queries time out on the public
    mirrors often enough that a run rarely finishes; the region-wide one is a
    single request, and caching it means a re-run after a code change does not
    have to win that race again.
    """
    if cache and os.path.exists(cache):
        d = json.load(open(cache))
        print(f'holes: {len(d.get("elements", []))} from cache {cache}')
    else:
        d = ask('[out:json][timeout:540];(way["golf"="hole"](43.2,-122.2,44.9,-120.8););out tags geom;')
        if d is not None and cache:
            json.dump(d, open(cache, 'w'))
    if d is None:
        return None
    pts = []
    for e in d.get('elements', []):
        g = e.get('geometry')
        if not g:
            continue
        tags = e.get('tags') or {}
        pts.append({
            'ref': tags.get('ref'),
            'par': tags.get('par'),
            'lon': sum(p['lon'] for p in g) / len(g),
            'lat': sum(p['lat'] for p in g) / len(g),
            'geometry': g,
            'element': e,
        })
    groups = []
    for h in pts:
        for g in groups:
            if any(hav(h, o) < CLUSTER_LINK_M for o in g):
                g.append(h)
                break
        else:
            groups.append([h])
    merged = True
    while merged:
        merged = False
        for i in range(len(groups)):
            for j in range(i + 1, len(groups)):
                if any(hav(a, b) < CLUSTER_LINK_M for a in groups[i] for b in groups[j]):
                    groups[i] += groups[j]
                    del groups[j]
                    merged = True
                    break
            if merged:
                break
    return groups


def hav(a, b):
    k = math.cos(math.radians((a['lat'] + b['lat']) / 2))
    return math.hypot((a['lon'] - b['lon']) * k, a['lat'] - b['lat']) * 111320


def pick_cluster(clusters, hood_rings):
    """The cluster with the most holes inside `hood_rings`.

    Most, not any: a neighborhood polygon can clip the corner of the course next
    door, and a single stray hole must not outvote eighteen.
    """
    best, best_n = None, 0
    for g in clusters:
        n = sum(1 for h in g if any(inside([h['lon'], h['lat']], r) for r in hood_rings))
        if n > best_n:
            best, best_n = g, n
    return best


def seg_dist(pt, line):
    """Metres from `pt` to the nearest point on polyline `line`.

    To the SEGMENTS, not the vertices: a three-point routing leaves 200 m gaps
    between vertices, and a nearest-vertex rule hands the middle of one fairway
    to the hole next door.
    """
    k = math.cos(math.radians(pt[1]))
    best = float('inf')
    for i in range(1, len(line)):
        ax, ay = line[i - 1]
        bx, by = line[i]
        dx, dy = (bx - ax) * k, by - ay
        d2 = dx * dx + dy * dy
        t = 0.0 if d2 == 0 else max(0.0, min(1.0, (((pt[0] - ax) * k) * dx + (pt[1] - ay) * dy) / d2))
        ex, ey = (pt[0] - (ax + t * (bx - ax))) * k, pt[1] - (ay + t * (by - ay))
        best = min(best, math.hypot(ex, ey))
    return best * 111320


def own_features(keep, cluster):
    """Split a rectangle harvest into this course's features and the neighbours'."""
    mine = [[[p['lon'], p['lat']] for p in h['geometry']] for h in cluster]
    mine_ids = {id(h) for h in cluster}
    mine_keys = {
        (round(sum(p[0] for p in line) / len(line), 7), round(sum(p[1] for p in line) / len(line), 7))
        for line in mine
    }
    foreign = []
    out = []
    for e in keep:
        if (e.get('tags') or {}).get('golf') != 'hole':
            continue
        g = e.get('geometry') or []
        if not g:
            continue
        key = (
            round(sum(p['lon'] for p in g) / len(g), 7),
            round(sum(p['lat'] for p in g) / len(g), 7),
        )
        (out if key in mine_keys else foreign).append(e)
    del mine_ids
    foreign_lines = [[[p['lon'], p['lat']] for p in e['geometry']] for e in foreign]
    dropped = len(foreign)
    for e in keep:
        if (e.get('tags') or {}).get('golf') == 'hole':
            continue
        g = e.get('geometry') or []
        if not g:
            continue
        c = [sum(p['lon'] for p in g) / len(g), sum(p['lat'] for p in g) / len(g)]
        near_mine = min(seg_dist(c, line) for line in mine) if mine else float('inf')
        near_theirs = min((seg_dist(c, line) for line in foreign_lines), default=float('inf'))
        if near_mine <= near_theirs:
            out.append(e)
        else:
            dropped += 1
    holes = sorted(
        {(e.get('tags') or {}).get('ref') for e in out
         if (e.get('tags') or {}).get('golf') == 'hole'} - {None}
    )
    return out, holes, dropped


def duplicate_refs(cluster):
    """True when one hole number appears on more than one way in `cluster`."""
    refs = [h['ref'] for h in cluster if h.get('ref')]
    return len(refs) != len(set(refs))


def walked(h):
    g = h.get('geometry') or []
    n = 0.0
    for i in range(1, len(g)):
        n += hav(
            {'lon': g[i - 1]['lon'], 'lat': g[i - 1]['lat']},
            {'lon': g[i]['lon'], 'lat': g[i]['lat']},
        )
    return n


def collapse_duplicate_refs(cluster):
    """One numbered routing per ref. Unnumbered leftovers are dropped.

    Prefers a tagged par, then the longer way. Pronghorn's cluster is a complete
    1..18 with par summing to 72, plus an untagged duplicate 17 farther west and
    two unnumbered ways. Those leftovers are not a second course.
    """
    by_ref = {}
    for h in cluster:
        ref = h.get('ref')
        if not ref:
            continue
        prev = by_ref.get(ref)
        if prev is None:
            by_ref[ref] = h
            continue
        h_par = bool(h.get('par'))
        p_par = bool(prev.get('par'))
        if h_par and not p_par:
            by_ref[ref] = h
        elif h_par == p_par and walked(h) > walked(prev):
            by_ref[ref] = h
    return list(by_ref.values())


# Same quarter-missing floor as build-course-maps.mjs: 18 - floor(18 * 0.25).
# A hood clip that keeps fewer unique refs than this is not a course extent
# (Pronghorn's neighborhood polygon keeps four holes).
MIN_HOOD_REFS = 14


def narrow_cluster(pick, hood, label):
    """Separate a mixed cluster without inventing a second course.

    Broken Top chains into Tetherow 700 m away and comes back as 1..18 twice;
    the neighborhood polygon covers Broken Top's eighteen and not Tetherow's,
    so clipping to the hood is the split. Pronghorn's hood covers 4 of 21
    holes, so the same clip would throw the course away. There the split is
    one way per ref, and the leftovers stay unnamed.
    """
    if not duplicate_refs(pick):
        return pick
    hood_clip = [h for h in pick if any(inside([h['lon'], h['lat']], r) for r in hood)]
    hood_refs = {h['ref'] for h in hood_clip if h.get('ref')}
    if hood_clip and not duplicate_refs(hood_clip) and len(hood_refs) >= MIN_HOOD_REFS:
        return hood_clip
    collapsed = collapse_duplicate_refs(pick)
    dropped = len(pick) - len(collapsed)
    if dropped:
        print(f'{label:36} dropped {dropped} leftover hole(s), not a second course')
    return collapsed


def extent_ring(cluster):
    """A rectangle around every vertex of the cluster's routings, plus a margin."""
    xs = [p['lon'] for h in cluster for p in h['geometry']]
    ys = [p['lat'] for h in cluster for p in h['geometry']]
    lat = sum(ys) / len(ys)
    dy = EXTENT_MARGIN_M / 111320
    dx = dy / max(math.cos(math.radians(lat)), 1e-6)
    x0, x1 = min(xs) - dx, max(xs) + dx
    y0, y1 = min(ys) - dy, max(ys) + dy
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='/tmp/osm-courses.json')
    ap.add_argument('--polys', default='/tmp/course-polys.json')
    ap.add_argument('--hood-polys', default='/tmp/course-neighborhood-polys.json')
    ap.add_argument('--hole-cache', default='/tmp/region-golf-holes.json')
    ap.add_argument('--only', default=None, help='fetch this slug only')
    args = ap.parse_args()

    polys = json.load(open(args.polys))
    by_name = {}
    for e in polys:
        name = (e.get('tags') or {}).get('name')
        if name:
            by_name.setdefault(name, []).append(e)

    out = json.load(open(args.out)) if os.path.exists(args.out) else {}

    for slug, name in COURSES:
        if args.only and slug != args.only:
            continue
        if slug in out:
            continue
        hit = by_name.get(name)
        if not hit:
            print(f'{name:36} no OSM boundary')
            continue
        el = hit[0]
        kind = el['type']
        query = (
            f'[out:json][timeout:180];{kind}({el["id"]});out geom;'
        )
        d = ask(query)
        if not d or not d.get('elements'):
            print(f'{name:36} boundary fetch failed')
            continue
        b = d['elements'][0]
        rings = [ring_of(b)] if kind == 'way' else rings_of_relation(b)
        rings = [r for r in rings if r and len(r) > 3]
        if not rings:
            print(f'{name:36} boundary had no ring')
            continue

        keep, holes = harvest(rings)
        if keep is None:
            print(f'{name:36} feature fetch failed')
            continue

        counts = collections.Counter((e.get('tags') or {}).get('golf') for e in keep)
        out[slug] = {
            'name': name,
            'rings': rings,
            'features': keep,
            'holes': holes,
            'boundarySource': f'OSM {el["type"]}/{el["id"]} leisure=golf_course',
        }
        # Save per course: a killed run resumes instead of re-fetching everything.
        json.dump(out, open(args.out, 'w'))
        parts = ' · '.join(f'{k} {counts[k]}' for k in FEATURE_KINDS if counts.get(k))
        print(f'{name:36} holes {len(holes):2}  {parts}')
        sys.stdout.flush()
        time.sleep(4)

    # Second provenance: courses clipped to our own neighborhood boundary.
    hoods = {}
    if os.path.exists(args.hood_polys):
        hoods = json.load(open(args.hood_polys)).get('polys', {})
    elif NEIGHBORHOOD_COURSES:
        print(f'\n{args.hood_polys} missing — run scripts/golf/export-neighborhood-polys.mjs first')

    clusters = None
    for slug, hood_slug, label in NEIGHBORHOOD_COURSES:
        if args.only and slug != args.only:
            continue
        if slug in out:
            continue
        poly = hoods.get(hood_slug)
        if not poly:
            print(f'{label:36} no neighborhood boundary for {hood_slug}')
            continue
        hood = [r for r in poly['rings'] if r and len(r) > 3]
        if not hood:
            print(f'{label:36} neighborhood boundary had no ring')
            continue
        if clusters is None:
            clusters = hole_clusters(args.hole_cache)
            if clusters is None:
                print('region-wide hole fetch failed — neighborhood courses skipped')
                break
            print(f'\n{len(clusters)} hole clusters in the region\n')
        pick = pick_cluster(clusters, hood)
        if not pick:
            print(f'{label:36} no hole cluster inside {hood_slug}')
            continue
        pick = narrow_cluster(pick, hood, label)
        if duplicate_refs(pick):
            print(f'{label:36} cluster still repeats a hole number — skipped')
            continue
        if not pick:
            print(f'{label:36} no holes after narrowing {hood_slug}')
            continue
        rings = [extent_ring(pick)]
        keep, holes = harvest(rings)
        if keep is None:
            # The public mirrors 504 on the region query; a tight bbox
            # sometimes still dies. The hole cache is enough to number the
            # course. Turf fills the body the same way it does for Quail Run.
            keep = [h['element'] for h in pick if h.get('element')]
            holes = sorted({h['ref'] for h in pick if h.get('ref')})
            print(f'{label:36} feature fetch failed — using hole cache only')
            if not keep:
                continue
        # The extent is a rectangle, so it also catches the corner of whatever
        # lies next door: Broken Top's box takes in five of Tetherow's holes.
        # Drop those, then keep a non-hole feature only if it sits nearer to one
        # of THIS course's routings than to any foreign one — a green belongs to
        # the course it is on, not to the course whose bounding box reached it.
        keep, holes, dropped = own_features(keep, pick)
        if dropped:
            print(f'{label:36} dropped {dropped} feature(s) nearer a neighbouring course')
        out[slug] = {
            'name': label,
            'rings': rings,
            'features': keep,
            'holes': holes,
            'boundarySource': (
                f'{len(pick)}-hole cluster inside public.boundaries '
                f'neighborhood/{hood_slug}, extent + {EXTENT_MARGIN_M} m'
            ),
        }
        json.dump(out, open(args.out, 'w'))
        counts = collections.Counter((e.get('tags') or {}).get('golf') for e in keep)
        parts = ' · '.join(f'{k} {counts[k]}' for k in FEATURE_KINDS if counts.get(k))
        print(f'{label:36} holes {len(holes):2}  {parts}   [neighborhood boundary]')
        sys.stdout.flush()
        time.sleep(4)

    print(f'\nsaved {len(out)} courses to {args.out}')


if __name__ == '__main__':
    main()

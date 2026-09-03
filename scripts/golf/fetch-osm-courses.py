"""
Pull every Central Oregon golf course out of OpenStreetMap, one course at a time,
clipped to that course's OWN named boundary.

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
import os
import sys
import time
import urllib.parse
import urllib.request

HOSTS = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
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

FEATURE_KINDS = (
    'hole', 'fairway', 'green', 'tee', 'bunker',
    'water_hazard', 'lateral_water_hazard', 'rough', 'driving_range', 'clubhouse',
)


def ask(query, tries=4):
    last = ''
    for i in range(tries):
        host = HOSTS[i % len(HOSTS)]
        try:
            req = urllib.request.Request(
                host, data=urllib.parse.urlencode({'data': query}).encode(), headers=UA
            )
            with urllib.request.urlopen(req, timeout=240) as r:
                return json.loads(r.read())
        except Exception as e:  # noqa: BLE001 - any transport failure is a retry
            last = str(e)[:80]
            time.sleep(10)
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='/tmp/osm-courses.json')
    ap.add_argument('--polys', default='/tmp/course-polys.json')
    args = ap.parse_args()

    polys = json.load(open(args.polys))
    by_name = {}
    for e in polys:
        name = (e.get('tags') or {}).get('name')
        if name:
            by_name.setdefault(name, []).append(e)

    out = json.load(open(args.out)) if os.path.exists(args.out) else {}

    for slug, name in COURSES:
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

        xs = [p[0] for r in rings for p in r]
        ys = [p[1] for r in rings for p in r]
        bbox = (min(ys), min(xs), max(ys), max(xs))
        time.sleep(3)
        d2 = ask(
            f'[out:json][timeout:180];'
            f'(way["golf"]({bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}););out tags geom;'
        )
        keep = []
        for e in (d2 or {}).get('elements', []):
            g = e.get('geometry')
            if not g:
                continue
            cx = sum(p['lon'] for p in g) / len(g)
            cy = sum(p['lat'] for p in g) / len(g)
            if any(inside([cx, cy], r) for r in rings):
                keep.append(e)

        counts = collections.Counter((e.get('tags') or {}).get('golf') for e in keep)
        holes = sorted(
            {(e.get('tags') or {}).get('ref') for e in keep
             if (e.get('tags') or {}).get('golf') == 'hole'} - {None}
        )
        out[slug] = {'name': name, 'rings': rings, 'features': keep, 'holes': holes}
        # Save per course: a killed run resumes instead of re-fetching everything.
        json.dump(out, open(args.out, 'w'))
        parts = ' · '.join(f'{k} {counts[k]}' for k in FEATURE_KINDS if counts.get(k))
        print(f'{name:36} holes {len(holes):2}  {parts}')
        sys.stdout.flush()
        time.sleep(4)

    print(f'\nsaved {len(out)} courses to {args.out}')


if __name__ == '__main__':
    main()

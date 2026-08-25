#!/usr/bin/env python3
"""Reassemble the Ryan Realty prototype bundle from editable parts.

  pages/<key>.html   one file per prototype screen (27)
  data/imgs.json     keyed base64 images, injected at runtime as ximg:<key>
  data/meta.json     names / concepts / groups / font
  shell.html         chrome + router, with <!--DATA:d-*--> injection markers

Usage: python3 build.py [out.html]
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'prototypes.html')


def die(msg):
    sys.stderr.write(f'build: {msg}\n')
    sys.exit(1)


meta = json.load(open(f'{HERE}/data/meta.json'))
imgs = json.load(open(f'{HERE}/data/imgs.json'))

pages = {}
for fn in sorted(os.listdir(f'{HERE}/pages')):
    if fn.endswith('.html'):
        pages[fn[:-5]] = open(f'{HERE}/pages/{fn}', encoding='utf8').read()

# Every page named in meta must exist, and vice versa - a silent mismatch
# renders a blank iframe with no error.
named = set(meta.get('names', {}))
if named - set(pages):
    die(f'meta names a page with no file: {sorted(named - set(pages))}')
if set(pages) - named:
    die(f'page file not named in meta: {sorted(set(pages) - named)}')

# Every ximg: reference must resolve, or the screen renders a broken image.
missing = set()
for key, html in pages.items():
    for ref in re.findall(r'ximg:([a-zA-Z0-9_]+)', html):
        if ref not in imgs:
            missing.add(f'{key} -> ximg:{ref}')
if missing:
    die(f'unresolved image refs: {sorted(missing)}')

shell = open(f'{HERE}/shell.html', encoding='utf8').read()


def encode(obj):
    # Six pages carry inline <script> blocks. A raw </script> inside a
    # <script type="application/json"> body closes the block early and the
    # whole bundle fails to parse at load. JSON treats \/ as /, so escaping
    # here changes nothing the parser sees.
    return json.dumps(obj, separators=(',', ':')).replace('</', '<\\/')


def inject(bid, payload):
    global shell
    marker = f'<!--DATA:{bid}-->'
    if marker not in shell:
        die(f'shell is missing marker {marker}')
    if '</script' in payload:
        die(f'{bid} payload would close its own script block')
    tag = f'<script type="application/json" id="{bid}">{payload}</script>'
    shell = shell.replace(marker, tag, 1)


inject('d-pages', encode(pages))
inject('d-imgs', encode(imgs))
inject('d-meta', encode(meta))
shell = shell.replace('<!--DATA:d-font-->', '', 1)

open(OUT, 'w', encoding='utf8').write(shell)
mb = os.path.getsize(OUT) / 1024 / 1024
print(f'built {OUT}  {mb:.2f} MB  ({len(pages)} pages, {len(imgs)} images)')
if mb > 15.5:
    die(f'{mb:.2f} MB exceeds the 16 MB artifact ceiling')

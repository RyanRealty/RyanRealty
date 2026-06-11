#!/usr/bin/env python3
"""
Generate a transparent-background team photo for ad use.
Source: public/images/team.png (1024x600, black studio bg).
Output: design_system/ryan-realty/assets/team/team-transparent.png
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "images" / "team.png"
OUT = ROOT / "design_system" / "ryan-realty" / "assets" / "team" / "team-transparent.png"

OUT.parent.mkdir(parents=True, exist_ok=True)

from rembg import remove
from PIL import Image

print(f"Reading {SRC}...")
with open(SRC, "rb") as f:
    src_bytes = f.read()

print("Running rembg...")
out_bytes = remove(src_bytes)

print(f"Writing {OUT}...")
with open(OUT, "wb") as f:
    f.write(out_bytes)

img = Image.open(OUT)
print(f"Output: {img.size}, mode={img.mode}, has alpha={img.mode == 'RGBA'}")

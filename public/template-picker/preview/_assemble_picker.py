#!/usr/bin/env python3
"""
Concatenate the three section pages (flyers / videos / carousels) into one
long single-column master picker page. Strips each file's <html>/<head>/<body>
wrapper and inlines its content under a single shared CSS block.
"""
from pathlib import Path
import re

PREVIEW = Path(__file__).resolve().parent
SECTIONS = [
    ("Flyers", "picker-flyers.html"),
    ("Videos", "picker-videos.html"),
    ("Carousels", "picker-carousels.html"),
]

all_styles = []
all_bodies = []

for section_name, filename in SECTIONS:
    path = PREVIEW / filename
    html = path.read_text(encoding="utf-8")
    # Extract all <style> blocks
    styles = re.findall(r"<style[^>]*>(.*?)</style>", html, flags=re.DOTALL)
    all_styles.extend(styles)
    # Extract body content
    m = re.search(r"<body[^>]*>(.*?)</body>", html, flags=re.DOTALL)
    body = m.group(1) if m else html
    # Each section's body content (its own header acts as the divider)
    wrapped = f'\n<!-- ===== {section_name} ===== -->\n{body}\n'
    all_bodies.append(wrapped)

combined_css = "\n/* ===== merged section CSS ===== */\n".join(all_styles)

master = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ryan Realty Template Picker — 19496 Tumalo Reservoir</title>
<style>
/* Page reset / base */
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; padding: 0; background: #faf8f4; scroll-behavior: smooth; }}
/* Jump-anchor offset so clicking nav lands below the sticky bar, not behind it */
a[id] {{ display: block; height: 0; scroll-margin-top: 70px; }}

/* Sticky top nav for jumping between sections */
.master-nav {{
  position: sticky; top: 0; z-index: 100;
  background: rgba(250, 248, 244, 0.95);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid #e8e2d4;
  padding: 12px 32px;
  display: flex;
  gap: 32px;
  justify-content: center;
  font-family: 'Geist', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
}}
.master-nav a {{
  color: #102742;
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 150ms ease-out;
}}
.master-nav a:hover {{ opacity: 1; text-decoration: underline; }}
.master-nav .sep {{ opacity: 0.35; }}

{combined_css}
</style>
</head>
<body>

<nav class="master-nav">
  <a href="#flyers">↓ Flyers</a>
  <span class="sep">·</span>
  <a href="#videos">↓ Videos</a>
  <span class="sep">·</span>
  <a href="#carousels">↓ Carousels</a>
</nav>

<a id="flyers"></a>
{all_bodies[0]}

<a id="videos"></a>
{all_bodies[1]}

<a id="carousels"></a>
{all_bodies[2]}

</body>
</html>
"""

out_path = PREVIEW / "templates-picker.html"
out_path.write_text(master, encoding="utf-8")
print(f"Wrote {out_path} ({len(master):,} bytes)")

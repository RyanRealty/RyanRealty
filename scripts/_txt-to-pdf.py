#!/usr/bin/env python3
"""Convert a transaction-summary.txt to a print-ready PDF for SkySlope upload.

Layout: single-column, monospaced, 80-char wrap, page numbers in footer.

Usage: _txt-to-pdf.py <input.txt> <output.pdf>
"""
import sys
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

if len(sys.argv) < 3:
    print("usage: _txt-to-pdf.py <input.txt> <output.pdf>", file=sys.stderr)
    sys.exit(1)

src, dst = sys.argv[1], sys.argv[2]
with open(src, "r", encoding="utf-8") as f:
    text = f.read()

# 80-char monospaced wrap
lines = []
for raw in text.split("\n"):
    if not raw:
        lines.append("")
        continue
    # Don't hard-wrap markdown rules / underlines
    if all(c == "=" for c in raw) or all(c == "-" for c in raw):
        lines.append(raw[:80])
        continue
    # Soft wrap at 80
    while len(raw) > 80:
        cut = raw.rfind(" ", 0, 80)
        if cut <= 0:
            cut = 80
        lines.append(raw[:cut])
        raw = raw[cut:].lstrip()
    lines.append(raw)

c = canvas.Canvas(dst, pagesize=LETTER)
width, height = LETTER
font_name = "Courier"
font_size = 9
leading = 11
left = 0.6 * inch
top = height - 0.6 * inch
bottom = 0.6 * inch
usable_h = top - bottom
lines_per_page = int(usable_h // leading)

page = 1
i = 0
while i < len(lines):
    c.setFont(font_name, font_size)
    y = top
    for _ in range(lines_per_page):
        if i >= len(lines):
            break
        line = lines[i]
        # Headings (start with #) -> bold
        if line.startswith("# ") or line.startswith("## ") or line.startswith("### "):
            c.setFont("Courier-Bold", font_size + 1)
        c.drawString(left, y, line)
        if line.startswith("#"):
            c.setFont(font_name, font_size)
        y -= leading
        i += 1
    # Footer
    c.setFont("Helvetica-Oblique", 8)
    c.drawCentredString(width / 2, 0.3 * inch, f"— Page {page} —")
    c.drawString(left, 0.3 * inch, "Ryan Realty / Transaction Audit")
    c.showPage()
    page += 1

c.save()
print(dst)

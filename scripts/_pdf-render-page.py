#!/usr/bin/env python3
"""Render a single PDF page to PNG so the agent can Read() it visually.

Usage: _pdf-render-page.py <pdf_path> <page_number> [out.png]
"""
import sys

try:
    import fitz  # PyMuPDF
except ImportError:
    print("PyMuPDF not installed. Install with: pip3 install pymupdf", file=sys.stderr)
    sys.exit(2)

if len(sys.argv) < 3:
    print("usage: _pdf-render-page.py <pdf> <page#> [out.png]", file=sys.stderr)
    sys.exit(1)

pdf, page_no = sys.argv[1], int(sys.argv[2])
out = sys.argv[3] if len(sys.argv) > 3 else f"/tmp/_pdf_p{page_no}.png"

doc = fitz.open(pdf)
if page_no < 1 or page_no > doc.page_count:
    print(f"page out of range (1..{doc.page_count})", file=sys.stderr)
    sys.exit(1)

# 1.5x matrix balances clarity vs file size (under Read's image limit)
pix = doc[page_no - 1].get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
pix.save(out)
print(out)

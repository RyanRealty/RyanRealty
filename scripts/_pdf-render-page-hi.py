#!/usr/bin/env python3
"""Render a PDF page to PNG at higher resolution (2.5x for legibility)."""
import sys
try:
    import fitz
except ImportError:
    print("PyMuPDF not installed", file=sys.stderr)
    sys.exit(2)

if len(sys.argv) < 3:
    print("usage: _pdf-render-page-hi.py <pdf> <page#> [out.png]", file=sys.stderr)
    sys.exit(1)
pdf, page_no = sys.argv[1], int(sys.argv[2])
out = sys.argv[3] if len(sys.argv) > 3 else f"/tmp/_pdf_p{page_no}_hi.png"

doc = fitz.open(pdf)
pix = doc[page_no - 1].get_pixmap(matrix=fitz.Matrix(2.5, 2.5))
pix.save(out)
print(out)

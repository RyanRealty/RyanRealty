#!/usr/bin/env python3
"""Render multiple PDF pages at once for quick visual scan."""
import sys, fitz
pdf = sys.argv[1]
pages = [int(p) for p in sys.argv[2].split(',')]
out_prefix = sys.argv[3] if len(sys.argv) > 3 else '/tmp/_pdf'
doc = fitz.open(pdf)
for p in pages:
    if 1 <= p <= doc.page_count:
        pix = doc[p-1].get_pixmap(matrix=fitz.Matrix(1.5,1.5))
        out = f"{out_prefix}_p{p}.png"
        pix.save(out)
        print(out)

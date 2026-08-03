/**
 * Inline stylesheet for the deterministic CMA renderer — cloned from the
 * canonical exemplar (public/drafts/cma-21042-robin/cma.html): brutalist navy
 * #102742 on cream #faf8f4 editorial, letter-size pages, print-safe.
 *
 * The Amboqia display font and brand assets load from absolute site URLs so
 * the stored HTML is self-contained in the browser, the admin iframe, and the
 * puppeteer PDF render.
 */

import { cmaSectionStyles } from '@/lib/cma/render-css-sections'

export function cmaStylesheet(siteUrl: string): string {
  return `
  @font-face {
    font-family: 'Amboqia Boriango';
    src: url('${siteUrl}/fonts/Amboqia_Boriango.otf') format('opentype');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }

  :root {
    --navy: #102742;
    --cream: #faf8f4;
    --navy-line: rgba(16, 39, 66, 0.18);
    --navy-fill: rgba(16, 39, 66, 0.06);
    --muted: rgba(16, 39, 66, 0.62);
  }

  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  html, body {
    margin: 0;
    padding: 0;
    background: #e8e3d8;
    font-family: 'Geist', system-ui, -apple-system, sans-serif;
    color: var(--navy);
    font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased;
  }

  /* One .page element is one physical sheet. The padding IS the margin — the
     PDF is rendered full-bleed (puppeteer margin 0), so nothing else reserves
     the bands. Keep the bottom padding well clear of .pg-footer below.

     min-height and NOT height, and overflow visible and NOT hidden:
     a fixed height plus overflow:hidden clips whatever does not fit, and the
     clipped rows are simply gone from the PDF — no error, no ellipsis, no way
     for a reader to know a comp went missing. Measured on a delivered CMA:
     9px of a comparable's stat line destroyed at the page boundary. Letting the
     box grow turns that into an extra sheet, which is ugly, visible, and caught
     by ci:pdf-page-safety instead of silently wrong. §0 — a document may not
     drop a number it claims to be showing. */
  .page {
    width: 8.5in;
    min-height: 11in;
    margin: 0.4in auto;
    background: var(--cream);
    padding: 0.4in 0.6in 0.85in 0.6in;
    box-shadow: 0 6px 24px rgba(16, 39, 66, 0.18);
    position: relative;
    page-break-after: always;
    overflow: visible;
  }
  .page:last-child { page-break-after: auto; }
  @media print {
    /* The screen view floats sheets on a desk with a drop shadow. On paper the
       sheet IS the page — any outer margin here shifts every sheet down and
       pushes the last band off the bottom edge. */
    .page { margin: 0; box-shadow: none; }
  }

  .pg-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--navy-line);
    padding-bottom: 9px;
    margin-bottom: 16px;
  }
  .pg-header img.logo { height: 34px; }
  .pg-header .pg-meta {
    font-size: 10px;
    color: var(--muted);
    text-align: right;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .pg-footer {
    position: absolute;
    bottom: 0.32in;
    left: 0.6in;
    right: 0.6in;
    border-top: 1px solid var(--navy-line);
    padding-top: 7px;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: var(--muted);
    letter-spacing: 0.04em;
    background: var(--cream);
  }

  h2.section {
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--navy);
    margin: 0 0 10px 0;
    padding-bottom: 6px;
    border-bottom: 2px solid var(--navy);
    display: inline-block;
  }
  h3.subhead {
    font-weight: 600;
    font-size: 12px;
    color: var(--navy);
    margin: 12px 0 5px 0;
  }
  p { font-size: 11px; line-height: 1.45; margin: 0 0 6px 0; }
  .small { font-size: 10px; color: var(--muted); line-height: 1.45; }

  .cover-label {
    font-size: 10px;
    letter-spacing: 0.20em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 12px;
  }
  .cover-title {
    font-family: 'Amboqia Boriango', Georgia, serif;
    font-size: 52px;
    line-height: 0.95;
    color: var(--navy);
    margin: 0 0 6px 0;
  }
  .cover-sub {
    font-size: 16px;
    color: var(--navy);
    font-weight: 400;
    margin-bottom: 18px;
  }

  .hero-photo {
    width: 100%;
    height: 280px;
    object-fit: cover;
    object-position: center;
    border-radius: 8px;
    background: var(--navy-fill);
    margin-bottom: 6px;
    display: block;
  }
  .hero-caption {
    font-size: 9.5px;
    color: var(--muted);
    letter-spacing: 0.06em;
    margin-bottom: 16px;
  }

  .value-block {
    background: var(--navy);
    color: var(--cream);
    padding: 24px 28px;
    margin: 0 0 18px 0;
    border-radius: 10px;
  }
  .value-block .vb-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 18px;
  }
  .value-block .vb-label {
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(250, 248, 244, 0.72);
    margin-bottom: 6px;
  }
  /* The answer. A seller opens this document for one number, so it is the
     largest element on the page. */
  .value-block .vb-price {
    font-family: 'Amboqia Boriango', Georgia, serif;
    font-size: 58px;
    line-height: 0.92;
    color: var(--cream);
    margin: 0;
  }
  .value-block .vb-pill {
    flex-shrink: 0;
    border: 1px solid rgba(250, 248, 244, 0.45);
    border-radius: 999px;
    padding: 5px 13px;
    font-size: 9.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--cream);
    white-space: nowrap;
  }
  .value-block .vb-range {
    margin-top: 12px;
    padding-top: 11px;
    border-top: 1px solid rgba(250, 248, 244, 0.20);
    font-size: 13px;
    color: var(--cream);
  }
  .value-block .vb-detail {
    font-size: 10.5px;
    color: rgba(250, 248, 244, 0.80);
    margin-top: 6px;
    line-height: 1.5;
  }

  .stat-strip {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0;
    margin: 14px 0 18px 0;
    border-top: 1px solid var(--navy-line);
    border-bottom: 1px solid var(--navy-line);
  }
  .stat-strip .stat {
    padding: 12px 8px;
    text-align: center;
    border-right: 1px solid var(--navy-line);
  }
  .stat-strip .stat:last-child { border-right: 0; }
  .stat-strip .stat .lbl {
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 3px;
  }
  .stat-strip .stat .val {
    font-size: 16px;
    font-weight: 500;
    color: var(--navy);
  }

  .presented-by {
    position: absolute;
    left: 0.6in;
    right: 0.6in;
    bottom: 0.72in;
    padding-top: 14px;
    border-top: 1px solid var(--navy-line);
    font-size: 10.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    text-align: center;
  }
  .presented-by strong { color: var(--navy); font-weight: 500; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

  table.comps {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
    margin-top: 4px;
  }
  table.comps thead th {
    text-align: left;
    font-weight: 600;
    font-size: 8.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--navy);
    padding: 5px 5px;
    border-bottom: 2px solid var(--navy);
  }
  table.comps tbody td {
    padding: 4px 5px;
    border-bottom: 1px solid var(--navy-line);
    vertical-align: middle;
  }
  table.comps tbody tr.subject td {
    background: var(--navy);
    color: var(--cream);
    font-weight: 500;
  }
  table.comps .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }

  .comp-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin: 4px 0 10px 0;
  }
  .comp-card {
    border: 1px solid var(--navy-line);
    border-radius: 6px;
    overflow: hidden;
    background: white;
  }
  .comp-card .ph-wrap { position: relative; }
  .comp-card .ph {
    width: 100%;
    height: 92px;
    object-fit: cover;
    display: block;
    background: var(--navy-fill);
  }
  /* Proximity is the answer to "why these comps" — it reads on the card, not
     buried in a run-on stats line (comp rework 2026-07-30). */
  .comp-card .num-chip {
    position: absolute;
    top: 5px;
    left: 5px;
    width: 17px;
    height: 17px;
    border-radius: 50%;
    background: var(--navy);
    color: var(--cream);
    font-size: 9px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .comp-card .prox-chip {
    position: absolute;
    bottom: 5px;
    right: 5px;
    background: var(--navy);
    color: var(--cream);
    font-size: 7.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 999px;
  }
  .comp-card .area-tag {
    margin-top: 3px;
    font-size: 7.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--navy);
    background: var(--navy-fill);
    border-radius: 3px;
    padding: 2px 5px;
    display: inline-block;
  }
  .comp-card .ph-missing {
    width: 100%;
    height: 92px;
    background: var(--navy-fill);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: center;
    padding: 0 10px;
  }
  .comp-card .body { padding: 5px 7px 6px; }
  .comp-card .addr {
    font-size: 9.5px;
    font-weight: 500;
    color: var(--navy);
    line-height: 1.2;
    margin-bottom: 2px;
  }
  .comp-card .stats { font-size: 8.5px; color: var(--muted); line-height: 1.3; }
  .comp-card .price {
    font-size: 11px;
    font-weight: 600;
    color: var(--navy);
    margin-top: 2px;
    font-variant-numeric: tabular-nums;
  }
  .comp-card .when {
    font-size: 8px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    line-height: 1.3;
  }

  .tier-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 14px;
  }
  .tier {
    border: 1px solid var(--navy-line);
    border-radius: 10px;
    padding: 16px 14px;
    background: white;
  }
  .tier.featured { background: var(--navy); color: var(--cream); border-color: var(--navy); }
  .tier .t-lbl {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--muted);
    margin-bottom: 5px;
  }
  .tier.featured .t-lbl { color: rgba(250, 248, 244, 0.72); }
  .tier .t-val {
    font-family: 'Amboqia Boriango', Georgia, serif;
    font-size: 24px;
    line-height: 1;
    color: var(--navy);
    margin: 0 0 7px 0;
  }
  .tier.featured .t-val { color: var(--cream); }
  .tier .t-note { font-size: 10px; color: var(--muted); line-height: 1.4; }
  .tier.featured .t-note { color: rgba(250, 248, 244, 0.80); }

  .signature-page {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 36px;
    align-items: end;
    margin-top: 22px;
    padding-top: 22px;
    border-top: 1px solid var(--navy-line);
  }
  .signature-page .portrait { width: 100%; height: auto; display: block; }
  .signature-page .sig-content { padding-bottom: 6px; }
  .signature-page .sig-name {
    font-family: 'Caveat', cursive;
    font-size: 44px;
    color: var(--navy);
    line-height: 1;
    border-bottom: 1px solid var(--navy);
    padding-bottom: 4px;
    margin-bottom: 8px;
    width: 260px;
  }
  .signature-page .sig-printed {
    font-family: 'Amboqia Boriango', Georgia, serif;
    font-size: 22px;
    line-height: 1;
    color: var(--navy);
    margin: 0 0 4px 0;
  }
  .signature-page .sig-title { font-size: 11px; color: var(--navy); margin-bottom: 14px; line-height: 1.45; }
  .signature-page .sig-contact { font-size: 11px; line-height: 1.7; color: var(--navy); }
  .signature-page .sig-contact strong { font-weight: 500; }
  .signature-page .sig-contact a { color: inherit; text-decoration: none; }

  /* Closing next-step page (conversion-audit 2026-07-15 #5): the document
     used to end on disclaimers with zero tappable contact. */
  .cta-lead { font-size: 14px; line-height: 1.75; color: var(--navy); max-width: 62ch; }
  .cta-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 22px; }
  .cta-actions a {
    display: inline-block;
    background: var(--navy);
    color: var(--cream);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-decoration: none;
    padding: 13px 22px;
    border: 1px solid var(--navy);
    border-radius: 10px;
  }
  .cta-actions a.ghost { background: transparent; color: var(--navy); }
  .cta-reply-note { margin-top: 16px; font-size: 12px; color: var(--muted); line-height: 1.6; }
  .signature-page .sig-license {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--navy-line);
    font-size: 9.5px;
    color: var(--muted);
    letter-spacing: 0.08em;
  }

  .trace {
    background: var(--navy-fill);
    border-left: 3px solid var(--navy);
    padding: 12px 14px;
    margin-top: 14px;
    font-size: 9.5px;
    line-height: 1.55;
    color: var(--navy);
  }
  .trace .t-hd {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .trace code {
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 9px;
    background: rgba(16,39,66,0.10);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .note-list { margin: 5px 0 8px 16px; padding: 0; }
  .note-list li { font-size: 10.5px; line-height: 1.4; margin-bottom: 3px; }

  /* Full-bleed page box: one .page element IS one sheet and supplies its own
     margins as padding, so @page reserves nothing. Do not add margins here
     without removing the padding above — the two would stack and push the
     footer band off the bottom of the paper. */
  @page { size: Letter; margin: 0; }
  @media print {
    body { background: white; margin: 0; padding: 0; }
    .page {
      box-shadow: none;
      margin: 0;
      width: 8.5in;
      min-height: 11in;
      page-break-after: always;
      break-after: page;
    }
    /* NO max-height and NO overflow:hidden here.

       This block is the one that governs the PDF (the renderer prints under
       print media), and it used to carry max-height 11in plus overflow hidden.
       That is what silently deleted content from delivered CMAs: a sheet
       holding one row more than fits rendered without error, and the row was
       simply absent from the file. Nothing downstream could detect it, because
       a clipped row leaves no trace in the PDF to measure.

       Overflow must stay visible so that too much content becomes a visible,
       measurable defect. assertPageFit() then refuses to produce the PDF at
       all, naming the sheet. A CMA that cannot fit is a build failure Matt can
       see, never a document a client receives with a comp missing. §0. */
    .page:last-child { page-break-after: auto; break-after: auto; }
    a { text-decoration: none; color: inherit; }
  }
`+ cmaSectionStyles()
}

/**
 * Inline stylesheet for the deterministic CMA renderer. Client chapters:
 * docs/plans/CMA_SUNSTONE_CONTRACT.md. Navy #102742 on cream #faf8f4,
 * letter-size pages, print-safe. Do not clone Robin or Tumalo HTML.
 *
 * The Amboqia display font and brand assets load from absolute site URLs so
 * the stored HTML is self-contained in the browser, the admin iframe, and the
 * puppeteer PDF render.
 *
 * Letter register: cream stock, navy type, hairline rules. No capsules.
 */

import { cmaSectionStyles } from '@/lib/cma/render-css-sections'
import { pageContractCss, CMA_MARGIN_IN } from '@/lib/pdf/page-contract'

export function cmaStylesheet(siteUrl: string): string {
  return `
  ${pageContractCss(CMA_MARGIN_IN)}

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

  /* A .page is a logical SECTION, not a physical sheet.

     It used to be a fixed 11in box with overflow:hidden, which deleted whatever
     did not fit — silently, because a clipped row is never drawn and leaves no
     trace in the PDF. 77 delivered-library CMAs were losing up to 2.6in of the
     description block that way.

     Now each section starts on fresh paper and flows for as many sheets as its
     content needs. The reserved bands come from @page (see the contract above),
     so a section that spills gets a properly margined continuation sheet
     instead of running off the edge. No height, no padding, no overflow rule —
     all three belong to @page now. */
  .page {
    background: var(--cream);
    position: relative;
    break-before: auto;
    page-break-before: auto;
  }
  .page-cover { break-after: page; page-break-after: always; }
  .page-flyer { break-before: page; page-break-before: always; }

  @media screen {
    /* Screen only: show sheets on a desk. Print takes its box from @page. */
    .page {
      width: 8.5in;
      min-height: 0;
      margin: 0.4in auto;
      padding: 0.4in 0.6in 0.7in 0.6in;
      box-shadow: 0 6px 24px rgba(16, 39, 66, 0.18);
    }
    .page.page-cover { padding: 0; }
    .cover-stage { min-height: 11in; }
  }

  @media screen and (max-width: 700px) {
    html, body { background: var(--cream); }
    .page {
      width: 100%;
      min-height: 0;
      margin: 0;
      padding: 20px 16px 32px;
      box-shadow: none;
    }
    .page.page-cover { padding: 0; }
    .cover-stage { min-height: 100svh; }
    .cover-title { font-size: 36px; }
    .cover-mast { top: 20px; left: 18px; right: 18px; }
    .page-cover .value-block { padding: 20px 18px 24px; }
    .value-block .vb-price { font-size: 44px; }
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
  /* Group caption inside a chunked table run (the side-by-side matrix). */
  h4.subhead {
    font-weight: 600;
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 10px 0 3px 0;
  }
  p { font-size: 11px; line-height: 1.45; margin: 0 0 6px 0; }
  .small { font-size: 10px; color: var(--muted); line-height: 1.45; }

  /* Magazine cover: the house is the page. The number sits on the photo. */
  .page.page-cover {
    padding: 0;
  }
  .cover-stage {
    position: relative;
    min-height: 9.9in;
    background: var(--navy);
    overflow: hidden;
  }
  .cover-veil {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: linear-gradient(
      180deg,
      rgba(16, 39, 66, 0.58) 0%,
      rgba(16, 39, 66, 0.12) 38%,
      rgba(16, 39, 66, 0.82) 100%
    );
  }
  .cover-mast {
    position: absolute;
    top: 32px;
    left: 36px;
    right: 36px;
    z-index: 2;
  }
  .cover-label {
    font-size: 11px;
    letter-spacing: 0.20em;
    text-transform: uppercase;
    color: rgba(250, 248, 244, 0.78);
    margin-bottom: 12px;
  }
  .cover-title {
    font-family: 'Amboqia Boriango', Georgia, serif;
    font-size: 52px;
    line-height: 0.95;
    color: var(--cream);
    margin: 0 0 8px 0;
  }
  .cover-sub {
    font-size: 16px;
    color: rgba(250, 248, 244, 0.88);
    font-weight: 400;
    margin: 0;
  }

  .hero-photo {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 40%;
    border-radius: 0;
    background: var(--navy);
    margin: 0;
    display: block;
  }
  .hero-caption {
    font-size: 9px;
    color: rgba(250, 248, 244, 0.52);
    letter-spacing: 0.06em;
    margin: 10px 0 0 0;
  }

  .page-cover .value-block {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    margin: 0;
    background: transparent;
    padding: 28px 36px 32px;
    border-radius: 0;
  }
  .page-cover .vb-detail { display: none; }
  /* The product bar is a cream slab with inline colors. On the photo cover that
     reads as a white box over the house. Keep the facts, drop the slab. */
  .page-cover .cma-product-bar {
    background: transparent !important;
    color: rgba(250, 248, 244, 0.86) !important;
    border-top: 1px solid rgba(250, 248, 244, 0.28) !important;
    margin: 12px 0 0;
    padding: 10px 0 0;
  }
  .page-cover .cma-product-bar a { color: var(--cream); }
  .cma-product-bar { font-size: 11px; line-height: 1.45; }
  .product-bar-item { margin: 0 0 3px; }
  .product-bar-k { font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; font-size: 9px; margin-right: 8px; opacity: 0.7; }
  .page-cover .vb-range {
    max-width: 36em;
  }
  .cover-specs {
    margin: 14px 0 0 0;
    font-size: 12px;
    letter-spacing: 0.04em;
    color: rgba(250, 248, 244, 0.78);
  }
  .cover-presented {
    margin: 8px 0 0 0;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(250, 248, 244, 0.62);
  }

  .value-block {
    background: var(--navy);
    color: var(--cream);
    padding: 24px 28px;
    margin: 0 0 18px 0;
    border-radius: 0;
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
    font-size: 72px;
    line-height: 0.92;
    color: var(--cream);
    margin: 0;
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
  .stat-strip.is-3 { grid-template-columns: repeat(3, 1fr); }
  .stat-strip.is-4 { grid-template-columns: repeat(4, 1fr); }
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
    margin-top: 28px;
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
    table-layout: fixed;
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
    border-radius: 0;
    overflow: hidden;
    background: var(--cream);
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
  .comp-card .area-tag {
    margin-top: 3px;
    font-size: 7.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
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
    border-radius: 0;
    padding: 16px 14px;
    background: var(--cream);
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
    /* The sign-off is one object. Split, its rule and padding stay on the
       previous sheet and the 44px signature starts flush against the top of
       the content box, where the ascender crosses into the reserved band —
       measured at +6.3pt on a real 34-page CMA for 833 Maple. Keeping the
       block whole means the padding above the name always comes with it. */
    break-inside: avoid;
    page-break-inside: avoid;
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
    border-radius: 0;
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

  /* The page box now comes from @page in the contract at the top of this
     stylesheet (CMA_MARGIN_IN: 0.4in top for the in-body section header, 0.7in
     bottom for the running footer Chrome draws into the margin strip).

     There is deliberately NO @page rule here. An 0-margin @page plus .page
     padding was the old model, and it could not give a spilled section a
     margin — the padding lands once at the top of the box and once at the
     bottom, never at an interior sheet boundary. */
  /* ONE artifact, two media (Matt 2026-08-05): the per-page header (and the
     running footer Chrome draws in the print margin) are PRINT chrome. The
     web view is the same document without them. */
  @media screen {
    .pg-header, .pg-footer { display: none; }
    ol.toc li .p { display: none; }
  }

  @media print {
    body { background: white; margin: 0; padding: 0; }
    .page {
      box-shadow: none;
      margin: 0;
      width: auto;
      /* Content-box height = 11in - 0.4in top - 0.7in bottom. */
      min-height: 9.9in;
      padding: 0;
    }
    /* NO height, NO max-height, NO overflow:hidden — all three delete content.
       A clipped row is never drawn, so it leaves no trace in the PDF for any
       downstream check to find. That is how 77 CMAs in the library were losing
       up to 2.6in of the description block with no error. Overflow stays
       visible; @page gives the spill a properly margined sheet. §0. */
    a { text-decoration: none; color: inherit; }
  }
`+ cmaSectionStyles()
}

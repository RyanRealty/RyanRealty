/**
 * Second half of the valuation-document stylesheet: the per-comp flyer, the
 * comp map, and the capability sections added 2026-07-30 (contents, marketing
 * highlights, status marks, key/value fact tables) plus the print-fidelity
 * rules. Split out of render-css.ts to keep both files inside the file-size
 * budget (ci:file-size-budget); it is concatenated by cmaStylesheet(), so the
 * cascade order is identical to one file.
 */

export function cmaSectionStyles(): string {
  return `
  .flyer-kicker {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 8px 0;
  }
  .flyer-title {
    font-family: 'Amboqia Boriango', Georgia, serif;
    font-size: 32px;
    line-height: 1;
    color: var(--navy);
    margin: 0 0 3px 0;
  }
  .flyer-sub { font-size: 11px; color: var(--muted); letter-spacing: 0.06em; margin-bottom: 9px; }
  .flyer-hero {
    width: 100%;
    height: 3.4in;
    object-fit: cover;
    object-position: center;
    border-radius: 0;
    overflow: hidden;
    background: var(--navy-fill);
    display: block;
    margin-bottom: 9px;
  }
  .flyer-hero.is-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: center;
    padding: 0 24px;
  }
  .flyer-stats {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    border-top: 1px solid var(--navy-line);
    border-bottom: 1px solid var(--navy-line);
    margin-bottom: 9px;
  }
  .flyer-stats .s { padding: 7px 6px; text-align: center; border-right: 1px solid var(--navy-line); }
  .flyer-stats .s:last-child { border-right: 0; }
  .flyer-stats .s .l {
    font-size: 8px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 1px;
  }
  .flyer-stats .s .v { font-size: 13px; font-weight: 500; color: var(--navy); }
  .flyer-stats .s.featured .v { font-weight: 600; }
  .flyer-desc { font-size: 9.5px; line-height: 1.45; color: var(--navy); margin: 0 0 9px 0; }
  .flyer-features {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
    margin-bottom: 9px;
    font-size: 9px;
  }
  .flyer-features .f { background: transparent; padding: 4px 0; border-top: 1px solid var(--navy-line); color: var(--navy); }
  .flyer-features .f .fl {
    font-size: 7.5px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .flyer-features .f .fv { font-size: 9px; line-height: 1.2; }

  .map-img {
    width: 100%;
    height: auto;
    border-radius: 0;
    overflow: hidden;
    background: var(--navy-fill);
    display: block;
    margin-bottom: 14px;
  }
  .comp-strip { display: flex; flex-direction: column; gap: 10px; margin: 8px 0 4px; }
  .comp-row {
    display: grid;
    grid-template-columns: 1.15in 1fr;
    gap: 12px;
    border: 1px solid var(--navy-line);
    background: var(--cream);
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .comp-media { position: relative; }
  .comp-ph {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    display: block;
    border-radius: 0;
    background: var(--navy-fill);
  }
  .comp-ph.is-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--cream);
    background: var(--navy);
    font-size: 22px;
  }
  .comp-pin {
    position: absolute;
    top: 5px;
    left: 5px;
    width: 18px;
    height: 18px;
    border-radius: 0;
    background: var(--navy);
    color: var(--cream);
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .comp-body { padding: 7px 9px 8px; }
  .comp-addr { font-size: 12px; font-weight: 600; color: var(--navy); line-height: 1.25; }
  .comp-sold-when { font-size: 10px; color: var(--navy); margin: 2px 0 4px; font-variant-numeric: tabular-nums; }
  .comp-nums { display: flex; flex-wrap: wrap; gap: 10px; margin: 6px 0 4px; }
  .comp-nl { display: block; font-size: 7.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .comp-nv { font-size: 12px; font-weight: 600; color: var(--navy); font-variant-numeric: tabular-nums; }
  .comp-facts { font-size: 9px; color: var(--muted); line-height: 1.35; font-variant-numeric: tabular-nums; }
  .comp-why { font-size: 9.5px; line-height: 1.4; color: var(--navy); margin: 6px 0 0; }

  .map-key { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .map-key .k {
    background: var(--navy-fill);
    padding: 8px 10px;
    border-radius: 0;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .map-key .k .pin {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--navy);
    color: var(--cream);
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
  }
  .map-key .k .pin.subject { background: #b3261e; }
  .map-key .k .txt { font-size: 10px; line-height: 1.3; }

  /* ── Contents ─────────────────────────────────────────────────────────── */
  ol.toc { list-style: none; margin: 10px 0 0 0; padding: 0; }
  ol.toc li {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 11.5px;
    padding: 6px 0;
    border-bottom: 1px solid var(--navy-line);
  }
  ol.toc li .t { color: var(--navy); }
  ol.toc li .d { flex: 1; border-bottom: 1px dotted var(--navy-line); }
  ol.toc li .p { color: var(--muted); font-size: 10px; letter-spacing: 0.08em; }

  /* ── Marketing highlights ─────────────────────────────────────────────── */
  .hl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 12px; }
  .hl {
    border: 1px solid var(--navy-line);
    border-left: 3px solid var(--navy);
    border-radius: 0;
    padding: 11px 13px;
    background: var(--cream);
  }
  .hl .hl-head { font-size: 12px; font-weight: 600; line-height: 1.3; color: var(--navy); }
  .hl .hl-basis { margin-top: 5px; font-size: 9.5px; line-height: 1.45; color: var(--muted); }

  .status-mark {
    display: inline;
    margin-left: 8px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--navy);
  }
  .status-mark.is-no { color: var(--muted); font-weight: 500; }
  .use-list {
    margin: 4px 0 8px 1.1em;
    padding: 0;
  }
  .use-list li {
    font-size: 10.5px;
    line-height: 1.4;
    margin-bottom: 3px;
    color: var(--navy);
  }
  .zone-line { font-size: 14px; margin-bottom: 6px; }
  .src { font-size: 9px; color: var(--muted); margin: 3px 0 10px 0; line-height: 1.4; }
  .src a { color: inherit; }

  /* ── Key/value fact tables ────────────────────────────────────────────── */
  table.kv { width: 100%; border-collapse: collapse; font-size: 10px; margin: 4px 0 8px 0; }
  table.kv th {
    text-align: left;
    font-weight: 500;
    color: var(--muted);
    padding: 4px 8px 4px 0;
    border-bottom: 1px solid var(--navy-line);
    width: 40%;
    vertical-align: top;
  }
  table.kv td { padding: 4px 0; border-bottom: 1px solid var(--navy-line); vertical-align: top; }
  table.kv.is-wide th { width: 26%; }
  table.kv.is-wide td.v { width: 22%; font-weight: 600; color: var(--navy); font-variant-numeric: tabular-nums; }
  table.kv.compare-board th.v, table.kv.compare-board td.v { width: 18%; text-align: right; }
  /* The net at list is a LEDGER: a reader adds the column and lands on the
     last row. Each deduction carries the source it came from on its own line
     under the label, because a cost line with no source is exactly the figure
     round four found headed "what you keep" (class A). */
  table.kv.netsheet { font-size: 11px; margin-top: 8px; }
  table.kv.netsheet th { width: 62%; color: var(--navy); font-weight: 500; padding: 6px 8px 6px 0; }
  table.kv.netsheet td.v {
    text-align: right;
    font-weight: 600;
    color: var(--navy);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    padding: 6px 0;
  }
  table.kv.netsheet .ln-src { display: block; font-size: 9px; color: var(--muted); font-weight: 400; margin-top: 2px; }
  table.kv.netsheet tr.is-net th,
  table.kv.netsheet tr.is-net td.v {
    border-top: 2px solid var(--navy);
    border-bottom: 0;
    font-weight: 700;
    padding-top: 8px;
  }
  /* The side-by-side matrix is chunked to at most four sales per table
     (lib/cma/comp-matrix.ts) and carries a colgroup. Fixed layout reads its
     widths from that colgroup, so the table is exactly the content box wide
     whatever an address or a subdivision is called, and no cell can push a
     column off the right margin.

     overflow-x:auto is a SCREEN affordance and nothing else. On paper it is a
     clipper: it is what removed sales 4 through 12 from a twelve-comp CMA with
     no error and no visible truncation. In print the box stays visible, so any
     future overflow is loud instead of silent. */
    /* F2, Matt 2026-09-07: ONE matrix with thumbnails is the comps view. At
       reading width the letter shows the same side-by-side table the PDF
       prints — a reviewer opening ?print=1 sees what the client gets. Only
       below 700px, where a seven-column table cannot hold, does it fall back
       to the stacked cards. Never both visible at once. */
  /* Restore (Matt 2026-09-12): desktop/screen matrix visible; below 700px stack.
     Tip Ready C4 hid matrix on all screen — Review looked empty. */
  .comp-stack { display: none; margin: 8px 0 14px; max-width: 100%; min-width: 0; }
  .comp-matrix-wrap { display: block; margin: 8px 0 14px; overflow-x: auto; }
  @media screen and (max-width: 700px) {
    .comp-stack { display: block; }
    /* The group heading belongs to the table, so it goes when the table does.
       Both headings rendered back to back at 375 with nothing between them. */
    .comp-matrix-wrap, .matrix-group-h { display: none; }
  }
  .comp-stack-card {
    border: 1px solid var(--navy-line);
    padding: 12px;
    margin: 0 0 12px;
    background: #fff;
    max-width: 100%;
    min-width: 0;
    overflow-wrap: anywhere;
    box-sizing: border-box;
  }
  .comp-stack-addr { font-weight: 600; margin: 0 0 6px; color: var(--navy); font-size: 14px; line-height: 1.25; }
  .comp-stack-sold { font-size: 12px; margin: 0 0 8px; font-variant-numeric: tabular-nums; }
  .comp-stack-nums { display: flex; flex-wrap: wrap; gap: 8px 14px; margin: 0 0 6px; font-variant-numeric: tabular-nums; }
  .comp-stack-n { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .comp-stack-n .k { font-size: 9px; letter-spacing: .06em; text-transform: uppercase; opacity: .6; color: var(--muted); }
  .comp-stack-n .v { font-size: 16px; font-weight: 600; color: var(--navy); line-height: 1.1; }
  .comp-stack-facts { font-size: 11px; opacity: .8; margin-top: 3px; line-height: 1.35; overflow-wrap: anywhere; }
  .comp-stack-card .matrix-thumb { width: 100%; max-width: 100%; aspect-ratio: 16 / 10; object-fit: cover; display: block; margin: 0 0 8px; }
  @media print {
    .comp-stack { display: none !important; }
    .comp-matrix-wrap { display: block !important; overflow-x: visible; }
    .matrix-group-h { display: block !important; }
  }
  /* Chapter 3's title IS the number, so it is set as the answer rather than as
     a section label. Every other chapter title is a sentence and keeps the
     tracked-caps register. */
  h2.section.is-answer {
    font-family: 'Amboqia Boriango', Georgia, serif;
    font-size: 42px;
    line-height: 1;
    letter-spacing: 0;
    text-transform: none;
    font-weight: 400;
    padding-bottom: 10px;
  }
  /* The map is an exhibit, not a page. Without a basemap the fallback SVG is a
     tall empty field, and even with one a half-page map pushes the sales table
     off the sheet a seller is reading. */
  .pin-map { max-height: 3.4in; object-fit: cover; }
  /* The same DOM pins on paper. Print keeps them: they are the numbers the
     grid above refers to, and a bitmap with no numbers on it is a decoration. */
  /* A cropped tile and a percentage-positioned pin cannot both be right. */
  .pin-map-frame { position: relative; margin: 8px 0 4px; line-height: 0; }
  .pin-map-frame .pin-map { max-height: none; object-fit: fill; aspect-ratio: 16 / 9; }
  .pin-hit {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
  .pin-dot {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--navy);
    color: var(--cream);
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    /* A cream ring, so two pins that still touch after the dodge read as two.
       Opening a bigger gap would move a pin off the house it names. */
    box-shadow: 0 0 0 2px var(--cream);
  }
  .pin-hit.is-subject { z-index: 2; }
  /* The lit pin comes to the front, whatever it was sitting under. */
  .pin-hit.is-on, .pin-hit:focus-visible { z-index: 3; }
  .pin-hit.is-subject .pin-dot { border-radius: 2px; }
  /* THREE FAMILIES, THREE GLYPHS (Delta 3). Filled navy for a sale that
     closed, hollow for a home on the market, hollow with a bar across it for a
     listing that came off unsold — one look per set, so a reader never has to
     consult the legend twice. */
  .pin-hit.is-active .pin-dot,
  .pin-hit.is-unsold .pin-dot {
    background: var(--cream);
    color: var(--navy);
    box-shadow: 0 0 0 2px var(--navy);
  }
  .pin-hit.is-unsold .pin-dot { position: relative; }
  .pin-hit.is-unsold .pin-dot::after {
    content: '';
    position: absolute;
    left: -4px;
    right: -4px;
    top: 50%;
    height: 1.5px;
    background: var(--navy);
  }
  /* Every pin tells the tale on tap: days on market, price changes, outcome.
     Print has no hover, so the sheet shows nothing until a pin is lit — the
     matrix under it carries the same three facts as columns. */
  .pin-note { display: none; }
  .pin-hit.is-on .pin-note {
    display: block;
    position: absolute;
    left: 50%;
    top: 100%;
    transform: translate(-50%, 6px);
    width: 168px;
    padding: 6px 8px;
    background: var(--cream);
    border: 1px solid var(--navy);
    color: var(--navy);
    font-size: 9px;
    line-height: 1.35;
    text-align: left;
    z-index: 4;
  }
  .pin-note .pn-a { display: block; font-weight: 700; }
  .pin-note .pn-o, .pin-note .pn-d { display: block; }
  /* The legend, keyed to the three matrices below it. */
  .pin-legend {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    font-size: 9.5px;
    color: var(--muted);
  }
  .pin-legend .pl-i { display: flex; align-items: center; gap: 5px; }
  .pin-legend .pl-k {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--navy);
    color: var(--cream);
    font-size: 8px;
    font-weight: 700;
  }
  .pin-legend .is-active .pl-k, .pin-legend .is-unsold .pl-k {
    background: var(--cream);
    color: var(--navy);
    box-shadow: inset 0 0 0 1.5px var(--navy);
  }
  .pin-legend .is-subject .pl-k { background: transparent; color: var(--navy); }
  /* Each unsold peer's dollars-a-foot story, keyed to its pin. */
  .peer-stories { list-style: none; margin: 8px 0 0; padding: 0; }
  .peer-stories li { display: flex; align-items: baseline; gap: 6px; margin: 0 0 5px; font-size: 10.5px; line-height: 1.45; }
  .peer-stories .ps-a { font-weight: 600; white-space: nowrap; }
  .peer-stories .ps-r { min-width: 0; }
  /* Chapter 3's lead line, under the number that is the chapter title. */
  .worth-lead { font-size: 13.5px; line-height: 1.5; margin: 0 0 12px; }
  .worth-lead-note { font-size: 13px; line-height: 1.5; margin: 0 0 12px; border-left: 2px solid var(--navy); padding-left: 9px; }
  /* The seller's own listed price and size, under "Your home" in the head. */
  table.comp-matrix .matrix-sub {
    display: block;
    margin-top: 3px;
    font-size: 9px;
    font-weight: 400;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
  table.comp-matrix a.matrix-addr,
  .comp-stack-card a.comp-stack-addr {
    display: block;
    color: var(--navy);
    text-decoration: none;
    border-bottom: 1px solid var(--navy-line);
  }

  /* Chapter 3's method, stated before the evidence for it. */
  .method { margin: 6px 0 10px; }
  .method-line { font-size: 11.5px; line-height: 1.55; margin: 0 0 5px; }
  /* Each sale's own price path, numbered to the columns above it. */
  .pp-spark { display: block; width: 100%; min-width: 0; }
  .pp-spark svg { width: 100%; height: auto; display: block; }
  table.comp-matrix td.is-draw { padding: 4px 6px; vertical-align: middle; }
  .comp-stack-card.is-yours { border-color: var(--navy); border-width: 2px; }
  .sale-paths { margin: 10px 0 4px; break-inside: avoid; }
  .sale-path { margin: 0 0 4px; break-inside: avoid; }
  /* The line is a strip, not a figure: capped so five of them do not become a
     page of their own under the grid they belong to. */
  .sale-paths .pp svg { max-width: 460px; }
  .sale-paths .pp-wrap { margin: 2px 0 0; }
  .sale-path-name { font-size: 11px; font-weight: 600; color: var(--navy); }
  .sale-paths-h { font-size: 11px; font-weight: 600; letter-spacing: 0.02em; margin: 10px 0 6px; }
  /* Considered and not used. */
  ul.rejected-list { list-style: none; margin: 4px 0 8px; padding: 0; }
  ul.rejected-list li { display: grid; grid-template-columns: 140px minmax(0, 1fr); gap: 4px 12px; padding: 4px 0; border-bottom: 1px solid var(--navy-line); font-size: 11px; }
  ul.rejected-list .rj-addr { font-weight: 600; }
  ul.rejected-list .rj-why { color: var(--muted); }
  /* The phone card carries the same grid lines as the column. */
  .comp-stack-grid { display: grid; gap: 2px; margin-top: 6px; }
  .comp-stack-line { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; flex-wrap: nowrap; white-space: nowrap; }
  .comp-stack-line .k { color: var(--muted); }
  .comp-stack-line .v { font-variant-numeric: tabular-nums; font-weight: 600; }
  /* Chapter 2b's centrepiece: what the first ask realized, by weeks. */
  table.realization { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 8px 0 4px; font-size: 11.5px; }
  table.realization col.rz-weeks { width: 38%; }
  table.realization col.rz-n { width: 12%; }
  table.realization col.rz-mark { width: 30%; }
  table.realization col.rz-share { width: 20%; }
  /* The mark column carries the encoding; the header names the scale once. */
  table.realization .rz-mark { text-align: left; padding-right: 10px; }
  table.realization thead th.rz-mark { white-space: normal; }
  .rz-svg { width: 100%; height: 12px; display: block; overflow: visible; }
  table.realization th, table.realization td { padding: 6px 8px; border-bottom: 1px solid var(--navy-line); text-align: left; }
  table.realization thead th { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
  table.realization td.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  /* The header wraps; only the FIGURES stay on one line. "SHARE OF THE FIRST
     ASK" on one line ran past the right edge of a 375 page. */
  table.realization th.n { text-align: right; white-space: normal; }
  table.realization tr.is-mine { font-weight: 600; }
  table.realization tr.is-mine th, table.realization tr.is-mine td { border-bottom-color: var(--navy); }
  .rz-mine { display: block; font-size: 10px; font-weight: 400; color: var(--muted); }
  /* Chapter 2's two graphics, same two-layout mechanism as the timeline. */
  .timing-phone, .outcome-phone { display: none; }
  @media screen and (max-width: 700px) {
    .timing-wide, .outcome-wide { display: none; }
    .timing-phone, .outcome-phone { display: block; }
  }
  @media print {
    .timing-wide, .outcome-wide { display: block !important; }
    .timing-phone, .outcome-phone { display: none !important; }
  }
  /* The one sentence that reads a graphic or a table for the seller. */
  .chart-read { font-size: 12.5px; line-height: 1.5; margin: 8px 0 4px; color: var(--navy); }
  /* NO PAN BOX. Every chart on this document ships a 360-unit phone layout,
     so nothing a seller reads sits in a scroll box (blueprint § The register).
     The pan box cropped six of the twelve months off the median-close line at
     375, which is how it was found. */
  .median-phone { display: none; }
  @media screen and (max-width: 700px) {
    .median-wide { display: none; }
    .median-phone { display: block; }
  }
  @media print {
    .median-wide { display: block !important; }
    .median-phone { display: none !important; }
  }
  /* Months of supply as two bars, and chapter 3's dot strip. Same mechanism. */
  /* On paper the spread is one column: two 720-unit charts side by side in a
     7.3in box put their axis type at seven points. Same story, paginated. */
  .spread { display: block; }
  .spread-col { min-width: 0; }
  .mos-phone, .worth-phone { display: none; }
  @media screen and (max-width: 700px) {
    .mos-wide, .worth-wide { display: none; }
    .mos-phone, .worth-phone { display: block; }
  }
  @media print {
    .mos-wide, .worth-wide { display: block !important; }
    .mos-phone, .worth-phone { display: none !important; }
  }
  .next-note { font-size: 12px; line-height: 1.7; max-width: 62ch; margin: 12px 0 0; color: var(--navy); }
  /* Chapter 1's timeline. Same two-layout mechanism: the reading is the gap
     between a line and a zone, and a cropped right edge deletes the day it
     came off. Exactly one layout is ever visible. */
  .timeline-phone { display: none; }
  @media screen and (max-width: 700px) {
    .timeline-wide { display: none; }
    .timeline-phone { display: block; }
  }
  @media print {
    .timeline-wide { display: block !important; }
    .timeline-phone { display: none !important; }
  }
  /* Same mechanism for the days-to-offer strip (F8): panning put the subject's
     own bar label, the punchline, outside the visible width on a phone. */
  .days-phone { display: none; }
  @media screen and (max-width: 700px) {
    .days-wide { display: none; }
    .days-phone { display: block; }
  }
  @media print {
    .days-wide { display: block !important; }
    .days-phone { display: none !important; }
  }
  /* The price-path primitive (blueprint, Delta 1). Two layouts of one line,
     exactly one visible, same mechanism as every other chart here. */
  .street-sales { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 0; }
  a.street-sale { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border: 1px solid var(--navy-line); border-radius: 8px; color: inherit; text-decoration: none; font-size: 11px; }
  a.street-sale .n { font-variant-numeric: tabular-nums; font-weight: 600; }
  @media screen and (max-width: 700px) {
    a.street-sale { min-height: 44px; padding: 10px 12px; font-size: 14px; }
  }
  .pp-wrap { margin: 8px 0 4px; }
  .pp-wrap.is-compact { margin: 5px 0 0; }
  .rival-card .pp-wrap { margin: 5px 0 0; }
  .pp svg { width: 100%; height: auto; display: block; }
  .pp-phone { display: none; }
  @media screen and (max-width: 700px) {
    .pp-wide { display: none; }
    .pp-phone { display: block; }
  }
  @media print {
    .pp-wide { display: block !important; }
    .pp-phone { display: none !important; }
    /* A card in a four-up grid is narrower than the wide line at every
       viewport, so the compact drawing is the only one it carries. */
    .pp-wrap.is-compact .pp { display: block !important; }
  }
  /* Chapter 2: one story per listing that did not sell, never a matrix. */
  .dns-set { display: grid; gap: 14px; margin: 12px 0 8px; }
  .dns-card {
    display: grid;
    grid-template-columns: 168px minmax(0, 1fr);
    gap: 14px;
    padding: 12px 0;
    border-top: 1px solid var(--navy-line);
    break-inside: avoid;
  }
  .dns-card.is-yours { border-top-width: 2px; }
  .dns-photo { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; }
  .dns-photo.is-empty { background: rgba(16, 39, 66, 0.06); }
  .dns-addr { display: block; font-size: 13px; font-weight: 600; color: var(--navy); }
  .dns-ask { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; margin-top: 2px; }
  .dns-facts { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .dns-read { font-size: 12px; line-height: 1.5; margin: 4px 0 0; }
  @media screen and (max-width: 700px) {
    .dns-card { grid-template-columns: 1fr; }
  }
  @media screen {
    table.comp-table { display: block; width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  }
  table.comp-matrix { table-layout: fixed; width: 100%; font-size: 10.5px; }
  table.kv.is-wide.comp-matrix th, table.kv.is-wide.comp-matrix td { width: auto; }
  /* TOP, not bottom: the subject head carries one line the sale heads do not. */
  table.comp-matrix thead th.v { vertical-align: top; text-align: center; }
  table.comp-matrix .matrix-thumb { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; margin: 0 0 6px; }
  table.comp-matrix .matrix-addr { display: block; }
  .addr-row { display: flex; align-items: center; justify-content: center; }
  .addr-row .matrix-addr { min-width: 0; }
  .addr-row.is-card { justify-content: flex-start; gap: 5px; margin: 0 0 6px; }
  .addr-row.is-card .pin-badge { margin-right: 0; }
  .addr-row.is-card .comp-stack-addr { margin: 0; flex: 1 1 auto; min-width: 0; }
  /* The map's pin, at reading size: the number is the key to the pin, not a
     rank. print-color-adjust is exact on * in the sheet, so it prints filled. */
  .pin-badge.is-active, .pin-badge.is-unsold {
    background: var(--cream);
    color: var(--navy);
    box-shadow: inset 0 0 0 1.5px var(--navy);
  }
  .pin-badge.is-subject { background: transparent; color: var(--navy); }
  /* The adjustment grid repeats the columns and drops the photographs. */
  table.comp-matrix.is-adjustments thead th.v { padding-top: 2px; }
  .subhead.adjustments-h { margin-top: 12px; }
  .pin-badge { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 50%; background: var(--navy); color: var(--cream); font-size: 9px; font-weight: 700; line-height: 1; margin-right: 5px; flex: 0 0 auto; vertical-align: middle; }
  table.comp-matrix th, table.comp-matrix td {
    padding: 5px 6px;
    /* Matt ADD 2026-09-12: no wrapping crumbs — labels and numbers stay one line. */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    /* Values sit under their own column head. Only the thead rule carried
       this before, so every figure in the body left-aligned away from the
       address it belonged to. The immersive stylesheet always aligned both. */
    text-align: right;
  }
  /* Only figures hold the line. Free text wraps rather than widening a column. */
  table.comp-matrix td.n { white-space: nowrap; }
  table.comp-matrix td.is-note { text-align: left; font-size: 9.5px; line-height: 1.35; }
  table.comp-matrix th[hidden], table.comp-matrix td[hidden] { display: none; }
  table.comp-matrix thead th:first-child, table.comp-matrix tbody th { text-align: left; }
  table.comp-matrix td.is-diff { font-weight: 600; }
  table.comp-matrix tr.is-total th, table.comp-matrix tr.is-total td { border-top: 1px solid var(--navy); font-weight: 600; }
  .trend-svg { width: 100%; height: auto; display: block; }
  .szn svg { width: 100%; height: auto; display: block; margin: 6px 0 2px; }
  .photo-set { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
  .photo-tile { margin: 0; overflow: hidden; }
  .photo-tile img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 0; display: block; }
  .photo-lead { grid-column: 1 / -1; }
  .photo-lead img { aspect-ratio: 16 / 9; }
  .status-hero, .sold-hero, .inv-hero { margin: 4px 0 14px; }
  .status-hero-n, .sold-hero-n, .inv-hero-n { font-family: var(--display); font-size: 42px; line-height: 1; }
  .status-hero-l, .sold-hero-l, .inv-hero-l { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin-top: 4px; }
  .status-hero-m, .status-tile-m { font-size: 11px; font-weight: 600; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .status-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 8px 0; }
  .status-tile { border: 1px solid var(--navy-line); padding: 8px; }
  .status-tile-n { font-family: var(--display); font-size: 22px; line-height: 1; }
  .status-tile-l { font-size: 9px; color: var(--muted); margin-top: 4px; }
  .inv-verdict { display: block; margin-top: 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; }
  .stat2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 10px 0; }
  /* The 90-day band's figures. The letter carried no rule for this pair at
     all, so "8" and "closed in 90 days" printed at body size on one line each
     — the same missing-register defect F7 fixed on the market board. */
  .stat2 .st-n { font-size: 16px; font-weight: 600; color: var(--navy); font-variant-numeric: tabular-nums; line-height: 1.2; }
  .stat2 .st-l { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin-top: 3px; }
  table.kv.is-wide td.b, table.kv.is-wide th.b { color: var(--muted); font-size: 9px; }
  table.kv thead th { font-size: 8.5px; letter-spacing: 0.08em; text-transform: uppercase; border-bottom: 2px solid var(--navy); }

  table.comps .sub-cell { font-size: 8px; color: var(--muted); margin-top: 1px; }
  table.comps-adjust td.num, table.comps-adjust th.v {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* ── Use-of-property boards (build / rent) ─────────────────────────────── */
  .zone-mast {
    background: var(--navy);
    color: var(--cream);
    padding: 16px 18px 14px;
    border-radius: 0;
    margin: 8px 0 14px 0;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .zone-mast .zm-kicker {
    font-size: 8.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(250, 248, 244, 0.70);
    margin-bottom: 4px;
  }
  .zone-mast .zm-code {
    font-family: 'Amboqia Boriango', Georgia, serif;
    font-size: 40px;
    line-height: 0.95;
    margin: 0 0 4px 0;
  }
  .zone-mast .zm-name { font-size: 14px; font-weight: 500; margin: 0 0 6px 0; }
  .zone-mast .zm-meta {
    font-size: 10px;
    letter-spacing: 0.04em;
    color: rgba(250, 248, 244, 0.72);
  }
  .glance-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
    gap: 0;
    margin: 0 0 16px 0;
    border: 1px solid var(--navy-line);
    border-radius: 0;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .glance {
    padding: 10px 8px;
    text-align: center;
    border-right: 1px solid var(--navy-line);
  }
  .glance:last-child { border-right: 0; }
  .glance .g-q {
    font-size: 8px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 6px;
  }
  .glance .g-a .status-mark { margin-left: 0; }
  .use-board {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin: 14px 0 12px 0;
  }
  .use-col-title {
    font-family: 'Amboqia Boriango', Georgia, serif;
    font-size: 22px;
    line-height: 1;
    color: var(--navy);
    margin: 0 0 10px 0;
  }
  .use-card {
    border: 1px solid var(--navy-line);
    border-left: 3px solid var(--navy);
    border-radius: 0;
    padding: 11px 13px;
    background: var(--cream);
    margin-bottom: 9px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .use-card[data-verdict="no"],
  .use-card[data-verdict="unlikely"] { border-left-color: var(--navy-line); }
  .use-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .use-topic {
    font-size: 8.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .use-head {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--navy);
    margin: 0 0 6px 0;
  }
  .use-detail {
    font-size: 10.5px;
    line-height: 1.45;
    color: var(--navy);
    margin: 0 0 6px 0;
  }

  /* Chapter 4: cards, four and four. Photo, linked address, price, size, days
     on market, and one delta line against your home. */
  /* Four across at four or more; fewer cards fill the row rather than leaving
     empty tracks beside them. */
  /* A card has a top width. Two cards stretched across 816 turned a thumbnail
     into a 540px photo and the price path's type with it. */
  .rival-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 200px)); justify-content: center; gap: 10px; margin: 8px 0 14px; }
  /* Wide only: a :has() rule outscores the plain media overrides below it. */
  @media screen and (min-width: 701px) {
    .rival-grid:has(> :nth-child(4)) { grid-template-columns: repeat(4, 1fr); justify-content: stretch; }
  }
  .rival-card {
    border: 1px solid var(--navy-line);
    background: var(--cream);
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .rival-card .rival-ph { width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: cover; display: block; background: var(--navy-fill); }
  .rival-card .rival-ph.is-empty { min-height: 0; }
  .rival-card .rival-body { padding: 7px 9px 9px; min-width: 0; }
  .rival-card .rival-addr {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--navy);
    text-decoration: none;
    border-bottom: 1px solid var(--navy-line);
    line-height: 1.25;
  }
  .rival-card .rival-ask { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 4px; }
  .rival-card .rival-facts { font-size: 9px; color: var(--muted); margin-top: 2px; line-height: 1.35; }
  .rival-card .rival-meta { font-size: 9px; color: var(--navy); margin-top: 4px; line-height: 1.35; }
  @media screen and (max-width: 700px) {
    .rival-grid { grid-template-columns: 1fr 1fr; }
  }
  /* Two cards across 375px leaves 130px a card. One card, full width. */
  @media screen and (max-width: 480px) {
    .rival-grid { grid-template-columns: 1fr; }
  }

  .rival-list { margin: 4px 0 12px; border-top: 1px solid var(--navy-line); }
  .rival-row {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) auto;
    gap: 8px;
    align-items: start;
    padding: 6px 0;
    border-bottom: 1px solid var(--navy-line);
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .rival-row.is-subject { border-bottom: 2px solid var(--navy); }
  .rival-ph { width: 48px; height: 48px; object-fit: cover; display: block; background: var(--navy-fill); }
  .rival-ph.is-empty { min-height: 48px; }
  .rival-body { min-width: 0; }
  .rival-addr { font-size: 11px; font-weight: 600; }
  .rival-facts { font-size: 9.5px; font-variant-numeric: tabular-nums; margin-top: 1px; }
  .rival-ask { font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; padding-top: 1px; }
  .rival-meta { font-size: 9px; opacity: 0.72; margin-top: 1px; line-height: 1.35; }
  .pin-map-wrap { margin: 10px 0 14px; }
  .pin-map { width: 100%; height: auto; display: block; border: 1px solid var(--navy-line); }

  /* The land: recorded lots at one shared scale. A tile never splits across a
     page break — half an outline reads as a different lot. */
  .lot-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 10px 0 6px; }
  .lot-tile { margin: 0; break-inside: avoid; page-break-inside: avoid; }
  .lot-tile svg { width: 100%; height: auto; display: block; border: 1px solid var(--navy-line); border-radius: 8px; }
  .lot-tile.is-subject svg { border-width: 2px; }
  .lot-tile figcaption { display: block; margin-top: 5px; font-size: 8.5pt; line-height: 1.35; }
  /* A label, not a capsule. The seller CMA carries no pills or chips
     (ci:cma-opinion-spine), so the comp number is set in type. */
  .lot-badge { font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; font-size: 7.5pt; margin-right: 5px; }
  .lot-addr { font-weight: 500; }
  .lot-acres, .lot-ppa { display: block; color: rgba(16, 39, 66, 0.7); }
  .lot-tile abbr { text-decoration: none; border-bottom: 1px dotted rgba(16, 39, 66, 0.5); }
  .lot-scale { width: 148px; height: auto; display: block; margin: 2px 0 8px; }
  .comp-row.is-on, .pin-sale.is-on, .pin-subject.is-on { outline: 2px solid var(--navy); }

  /* ── Print + PDF fidelity ─────────────────────────────────────────────── */
  p, li { orphans: 3; widows: 3; }
  .comp-card, .comp-row, .tier, .hl, .map-key .k, .trace, .flyer-features .f, .use-card, .zone-mast { break-inside: avoid; page-break-inside: avoid; }
  @media (max-width: 700px) {
    .use-board { grid-template-columns: 1fr; }
  }
  h2.section, h3.subhead, h4.subhead { break-after: avoid; page-break-after: avoid; }
  table.comps tr, table.kv tr { break-inside: avoid; page-break-inside: avoid; }

`
}

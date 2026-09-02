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
  /* The side-by-side matrix is chunked to at most four sales per table
     (lib/cma/comp-matrix.ts) and carries a colgroup. Fixed layout reads its
     widths from that colgroup, so the table is exactly the content box wide
     whatever an address or a subdivision is called, and no cell can push a
     column off the right margin.

     overflow-x:auto is a SCREEN affordance and nothing else. On paper it is a
     clipper: it is what removed sales 4 through 12 from a twelve-comp CMA with
     no error and no visible truncation. In print the box stays visible, so any
     future overflow is loud instead of silent. */
  .comp-matrix-wrap { overflow-x: visible; margin: 8px 0 14px; }
  @media screen { .comp-matrix-wrap { overflow-x: auto; } }
  table.comp-matrix { table-layout: fixed; width: 100%; font-size: 10.5px; }
  table.kv.is-wide.comp-matrix th, table.kv.is-wide.comp-matrix td { width: auto; }
  table.comp-matrix th, table.comp-matrix td {
    padding: 5px 6px;
    white-space: normal;
    overflow-wrap: anywhere;
    /* Values sit under their own column head. Only the thead rule carried
       this before, so every figure in the body left-aligned away from the
       address it belonged to. The immersive stylesheet always aligned both. */
    text-align: right;
  }
  /* Only figures hold the line. Free text wraps rather than widening a column. */
  table.comp-matrix td.n { white-space: nowrap; }
  table.comp-matrix thead th:first-child, table.comp-matrix tbody th { text-align: left; }
  table.comp-matrix td.is-diff { font-weight: 600; }
  .trend-svg { width: 100%; height: auto; display: block; }
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

  .rival-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 8px 0 12px; }
  .rival-card { border: 1px solid var(--navy-line); background: var(--cream); overflow: hidden; break-inside: avoid; }
  .rival-ph { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; background: var(--navy-fill); }
  .rival-ph.is-empty { min-height: 72px; }
  .rival-body { padding: 8px 10px 10px; }
  .rival-addr { font-size: 12px; font-weight: 600; }
  .rival-ask { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 4px; }
  .rival-meta { font-size: 10.5px; opacity: 0.7; margin-top: 3px; }
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

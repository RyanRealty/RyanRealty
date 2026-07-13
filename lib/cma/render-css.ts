/**
 * Inline stylesheet for the deterministic CMA renderer — cloned from the
 * canonical exemplar (public/drafts/cma-21042-robin/cma.html): brutalist navy
 * #102742 on cream #faf8f4 editorial, letter-size pages, print-safe.
 *
 * The Amboqia display font and brand assets load from absolute site URLs so
 * the stored HTML is self-contained in the browser, the admin iframe, and the
 * puppeteer PDF render.
 */

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

  .page {
    width: 8.5in;
    height: 11in;
    min-height: 11in;
    margin: 0.4in auto;
    background: var(--cream);
    padding: 0.4in 0.6in 0.85in 0.6in;
    box-shadow: 0 6px 24px rgba(16, 39, 66, 0.18);
    position: relative;
    page-break-after: always;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }

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
  .value-block .vb-label {
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(250, 248, 244, 0.72);
    margin-bottom: 8px;
  }
  .value-block .vb-range {
    font-family: 'Amboqia Boriango', Georgia, serif;
    font-size: 40px;
    line-height: 1;
    color: var(--cream);
    margin: 0;
  }
  .value-block .vb-detail {
    font-size: 11px;
    color: rgba(250, 248, 244, 0.80);
    margin-top: 10px;
    line-height: 1.55;
  }
  .value-block .vb-most-likely {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid rgba(250, 248, 244, 0.20);
    font-size: 12px;
    line-height: 1.55;
  }
  .value-block .vb-most-likely strong { color: var(--cream); font-weight: 600; }

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
    margin-top: 18px;
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
  table.comps .num { text-align: right; }

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
  .comp-card .ph {
    width: 100%;
    height: 92px;
    object-fit: cover;
    display: block;
    background: var(--navy-fill);
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
  .comp-card .price .when {
    font-size: 8.5px;
    font-weight: 400;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-left: 4px;
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

  .flyer-badge {
    display: inline-block;
    background: var(--navy);
    color: var(--cream);
    font-size: 8.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    padding: 3px 11px;
    border-radius: 999px;
    margin-bottom: 8px;
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
    border-radius: 8px;
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
  .flyer-features .f { background: var(--navy-fill); padding: 4px 8px; border-radius: 5px; color: var(--navy); }
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
    border-radius: 10px;
    background: var(--navy-fill);
    display: block;
    margin-bottom: 14px;
  }
  .map-key { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .map-key .k {
    background: var(--navy-fill);
    padding: 8px 10px;
    border-radius: 6px;
    display: flex;
    gap: 10px;
    align-items: center;
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

  @page { size: Letter; margin: 0; }
  @media print {
    body { background: white; margin: 0; padding: 0; }
    .page {
      box-shadow: none;
      margin: 0;
      width: 8.5in;
      height: 11in;
      min-height: 11in;
      max-height: 11in;
      overflow: hidden;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
  }
`
}

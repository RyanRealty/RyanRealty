/**
 * Immersive /cma/[slug] stylesheet. Screen document, not a print sheet:
 * no page numbers, flush photo crops, motion on this house's figures.
 */

export function immersiveStylesheet(): string {
  return `
:root{--navy:#102742;--cream:#faf8f4;--ink:rgba(16,39,66,1);--ink70:rgba(16,39,66,.7);--ink12:rgba(16,39,66,.12)}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:Geist,system-ui,sans-serif;background:var(--cream);color:var(--ink);line-height:1.55;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
/* [hidden] is a UA-stylesheet rule, so ANY author display declaration beats it.
   \`.rival-grid{display:grid}\` did: the competition filter set grid.hidden =
   true, the heading above it vanished (no author display rule of its own) and
   all eight cards stayed on screen under the surviving heading — four for-sale
   homes presented to the seller as under contract. A control that publishes a
   false status blocks a send, so the rule is author-level and important once,
   for the whole document. */
[hidden]{display:none!important}
.page-num,.pg-num,.pageNumber,.pg-footer,.toc .p{display:none}
.sc{min-height:100svh;display:flex;align-items:center;padding:96px 24px;position:relative}
.sc.tight{min-height:72svh}
.sc.pack{min-height:0;align-items:flex-start;padding-top:48px;padding-bottom:56px}
.sc-cream{background:var(--cream)}
.sc-navy{background:var(--navy);color:var(--cream)}
.in{max-width:880px;margin:0 auto;width:100%}
.in.wide{max-width:1120px}
.kick{font-size:13px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;opacity:.65;margin-bottom:18px}
.h{font-family:'Amboqia Boriango',Georgia,serif;font-weight:400;font-size:clamp(30px,5vw,54px);line-height:1.08;letter-spacing:-.01em;margin-bottom:22px}
.sub{font-family:'Amboqia Boriango',Georgia,serif;font-weight:400;font-size:clamp(22px,3vw,30px);margin:56px 0 18px}
.lede{font-size:clamp(16px,2vw,19px);color:inherit;opacity:.85;max-width:640px;margin-bottom:34px}
.body{font-size:16px;opacity:.85;max-width:640px;margin-top:28px}
.src{font-size:12px;opacity:.55;margin-top:30px;max-width:720px;font-variant-numeric:tabular-nums}
.sc-navy .src{opacity:.5}
.hero{overflow:hidden;background:var(--navy);color:var(--cream);align-items:flex-end;padding-bottom:88px}
.hero-bed{position:absolute;inset:-6%;width:112%;height:112%;object-fit:cover;filter:blur(34px) saturate(.75);opacity:.5;transform:scale(1.06)}
.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center top;opacity:.96;border-radius:0}
.hero-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,39,66,.50) 0%,rgba(16,39,66,.16) 34%,rgba(16,39,66,.58) 62%,rgba(16,39,66,.94) 100%)}
/* A SCRIM UNDER THE WORDS, not only over the photo. 13px cream at 70 percent
   on a sunlit lawn is not legible at any viewport, and the page-wide gradient
   cannot know where the light part of a photo falls (tasteReview item 3). */
.hero .in{position:relative;z-index:2;padding:26px 26px 30px;background:linear-gradient(180deg,rgba(16,39,66,0) 0%,rgba(16,39,66,.72) 26%,rgba(16,39,66,.9) 100%)}
.hero-kick{font-size:13px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:rgba(250,248,244,.92);margin-bottom:14px}
.hero-h{font-family:'Amboqia Boriango',Georgia,serif;font-weight:400;font-size:clamp(40px,8vw,92px);line-height:1.0;letter-spacing:-.01em;text-shadow:0 2px 24px rgba(16,39,66,.45)}
.hero-sub{font-size:clamp(15px,2vw,19px);color:rgba(250,248,244,.9);margin-top:16px}
.hero-for{font-size:14px;color:rgba(250,248,244,.86);margin-top:8px}
.hero-payoff{margin-top:36px}
.hero .ans-n{color:var(--cream);font-size:clamp(56px,11vw,120px);margin:4px 0 8px;text-shadow:0 2px 28px rgba(16,39,66,.7)}
.hero .ans-l{color:rgba(250,248,244,.88)}
.hero-list{font-size:clamp(15px,2vw,18px);color:rgba(250,248,244,.9);margin-top:6px;max-width:640px}
.hero-why{font-size:clamp(12px,1.5vw,14px);color:rgba(250,248,244,.72);margin-top:6px;max-width:640px}
.cue{position:absolute;left:50%;bottom:28px;z-index:2;width:16px;height:16px;border-right:2px solid rgba(250,248,244,.8);border-bottom:2px solid rgba(250,248,244,.8);transform:translateX(-50%) rotate(45deg);border-radius:0}
.ans-n{font-family:'Amboqia Boriango',Georgia,serif;font-size:clamp(64px,13vw,150px);line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin:6px 0 10px}
.ans-l{font-size:15px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;opacity:.65}
.conf{display:block;margin-top:16px;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.range{margin-top:56px}
.range-track{position:relative;height:8px;background:var(--ink12)}
.range-fill{position:absolute;top:0;bottom:0;left:0;background:var(--navy);width:var(--w,0%);transition:width 1.1s cubic-bezier(.2,.7,.2,1)}
.range-marks{display:flex;justify-content:space-between;margin-top:14px;gap:12px}
.rm{flex:1}
.rm-v{font-size:clamp(18px,2.6vw,26px);font-weight:700;font-variant-numeric:tabular-nums}
.rm-l{font-size:12.5px;opacity:.6;margin-top:2px}
.rm.mid .rm-v{color:var(--navy)}
.stat2,.stat3,.stat4{display:grid;gap:28px;margin:44px 0}
.stat2{grid-template-columns:repeat(2,1fr)}
.stat3{grid-template-columns:repeat(3,1fr)}
.stat4{grid-template-columns:repeat(4,1fr)}
.st-n{font-family:'Amboqia Boriango',Georgia,serif;font-size:clamp(34px,5vw,58px);line-height:1;font-variant-numeric:tabular-nums}
.st-l{font-size:14px;opacity:.72;margin-top:10px;line-height:1.45}
.tl{display:flex;align-items:center;gap:18px;margin:40px 0;flex-wrap:wrap}
.tl-item{min-width:120px}
.tl-lbl{font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.6}
.tl-val{font-family:'Amboqia Boriango',Georgia,serif;font-size:clamp(24px,3.4vw,38px);margin-top:4px;font-variant-numeric:tabular-nums}
.tl-arrow{flex:1;min-width:40px;height:2px;background:rgba(250,248,244,.35);position:relative}
.tl-arrow::after{content:'';position:absolute;right:0;top:-4px;border-left:8px solid rgba(250,248,244,.55);border-top:5px solid transparent;border-bottom:5px solid transparent}
.story-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:44px}
.story-card{background:rgba(250,248,244,.06);border:1px solid rgba(250,248,244,.14);padding:22px}
.story-lens{font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.65;margin-bottom:10px}
.story-fact{font-size:15.5px;font-weight:600;line-height:1.4}
.story-mean{font-size:14px;opacity:.75;margin-top:10px;line-height:1.45}
.comp-strip{display:flex;flex-direction:column;gap:18px;margin-top:8px}
.comp-row{display:grid;grid-template-columns:220px 1fr;gap:22px;background:var(--cream);border:1px solid var(--ink12);overflow:hidden}
.comp-media{position:relative}
.comp-ph{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;border-radius:0}
.comp-ph.is-empty{display:flex;align-items:center;justify-content:center;background:var(--navy);color:var(--cream);font-family:'Amboqia Boriango',Georgia,serif;font-size:40px}
.comp-pin{position:absolute;top:8px;left:8px;width:28px;height:28px;border-radius:0;background:var(--navy);color:var(--cream);font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center}
.comp-body{padding:16px 18px 18px}
.comp-addr{font-size:18px;font-weight:600;line-height:1.25}
.comp-sold-when{font-size:15px;margin:4px 0 8px;font-variant-numeric:tabular-nums}
.comp-nums{display:flex;flex-wrap:wrap;gap:18px;margin:12px 0 10px;font-variant-numeric:tabular-nums}
.comp-nl{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.55;margin-bottom:2px}
.comp-nv{font-family:'Amboqia Boriango',Georgia,serif;font-size:26px;line-height:1}
.comp-facts{font-size:14px;opacity:.7;font-variant-numeric:tabular-nums;margin-top:4px}
.comp-why{font-size:15px;line-height:1.45;margin-top:12px;max-width:none}
/* F1, Matt 2026-09-07: at 375px the side-by-side matrix collapsed the row
   label column to one character per line and ran the grid thousands of pixels
   down the page. A twenty-one-row, seven-column table is a desktop object.
   Above 700px the matrix stands (what Matt asked for on screen); below it, the
   stacked cards — the same data, one sale at a time. Never both. */
.comp-matrix-wrap{display:block;margin:18px 0 8px;overflow-x:auto;max-width:100%}
.comp-stack{display:none;margin:18px 0 8px;max-width:100%;min-width:0}
@media screen and (max-width:700px){.comp-matrix-wrap,.matrix-group-h{display:none}.comp-stack{display:block}}
.comp-stack-card{border:1px solid var(--ink12);padding:14px;margin:0 0 14px;background:#fff;max-width:100%;min-width:0;overflow-wrap:anywhere;box-sizing:border-box}
.comp-stack-addr{font-weight:600;margin:0 0 6px;font-size:17px;line-height:1.25}
.comp-stack-sold{font-size:15px;margin:0 0 10px;font-variant-numeric:tabular-nums}
.comp-stack-nums{display:flex;flex-wrap:wrap;gap:12px 18px;margin:0 0 8px;font-variant-numeric:tabular-nums}
.comp-stack-n{display:flex;flex-direction:column;gap:2px;min-width:0}
.comp-stack-n .k{font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.55}
.comp-stack-n .v{font-size:22px;font-weight:600;line-height:1.1}
.comp-stack-facts{font-size:14px;opacity:.78;margin-top:4px;line-height:1.4;overflow-wrap:anywhere}
.comp-stack-card .matrix-thumb{width:100%;max-width:100%;aspect-ratio:16/10;object-fit:cover;display:block;margin:0 0 8px}
/* A comp thumbnail on a phone is an identifier, not a hero: 16/10 at 375 is
   193px of photo above 240px of facts, five times over. */
@media (max-width:560px){.comp-stack-card .matrix-thumb{aspect-ratio:2/1}}
@media print{.comp-stack{display:none!important}.comp-matrix-wrap,.matrix-group-h{display:block!important}.comp-matrix-wrap{overflow-x:visible}}
table.comp-matrix{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
table.comp-matrix th,table.comp-matrix td{padding:8px 10px;border-bottom:1px solid var(--ink12);text-align:right;white-space:normal;overflow-wrap:anywhere}
table.comp-matrix td.n{white-space:nowrap}
table.comp-matrix thead th:first-child,table.comp-matrix tbody th{text-align:left}
table.comp-matrix td.is-diff{font-weight:600}
table.comp-matrix tr.is-total th,table.comp-matrix tr.is-total td{border-top:1px solid var(--navy);font-weight:600}
h3.subhead{font-size:17px;font-weight:600;margin:26px 0 8px}
h4.subhead{font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;opacity:.6;margin:20px 0 6px}
.sc a{color:var(--navy)}
.sc-navy a{color:var(--cream)}
/* Four across when there are four or more. With two, four fixed tracks left
   two narrow cards stranded at the left of a 1280 screen with 900px of empty
   cream beside them; auto-fit collapses the tracks nobody is using. */
.rival-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,320px));justify-content:center;gap:18px;margin:14px 0 8px}
/* Wide screens ONLY. A :has() rule outscores every plain media override, so
   unscoped it put four 37px columns on a 375 phone. */
@media (min-width:861px){.rival-grid:has(> :nth-child(4)){grid-template-columns:repeat(4,1fr);justify-content:stretch}}
.rival-card{background:var(--cream);border:1px solid var(--ink12);overflow:hidden}
.rival-card .rival-ph{width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;display:block;background:var(--navy)}
.rival-card .rival-ph.is-empty{min-height:0}
.rival-card .rival-body{padding:14px 16px 16px;min-width:0}
.rival-card .rival-addr{display:block;font-size:15px;font-weight:600;color:inherit;text-decoration:none;border-bottom:1px solid var(--ink12);line-height:1.3}
.rival-card .rival-ask{font-family:'Amboqia Boriango',Georgia,serif;font-size:24px;font-variant-numeric:tabular-nums;margin-top:8px;line-height:1}
.rival-card .rival-facts{font-size:13px;opacity:.65;margin-top:6px;line-height:1.4}
.rival-card .rival-meta{font-size:13px;margin-top:8px;line-height:1.4}
@media (max-width:860px){.rival-grid{grid-template-columns:1fr 1fr}}
/* Two competitor cards across 375px leaves 130px a card: an address on three
   lines and a price path drawn at six pixels. One card, full width — and on a
   phone that card lies DOWN: eight homes at a full-width 4:3 photo each is
   4,476px, six screens of scrolling list for one chapter (tasteReview round
   two, item 3, and TASTE.md's ban on the scrolling list as the design). Same
   markup, same filter, same data — the photo becomes a square thumbnail beside
   the facts instead of a banner above them. */
@media (max-width:560px){
  .rival-grid{grid-template-columns:1fr;gap:10px}
  .rival-card{display:grid;grid-template-columns:104px minmax(0,1fr);align-items:stretch}
  .rival-card .rival-ph{width:104px;height:100%;min-height:104px;aspect-ratio:auto}
  .rival-card .rival-ph.is-empty{min-height:104px}
  .rival-card .rival-body{padding:10px 12px 12px}
  .rival-card .rival-addr{font-size:14px;padding:8px 0;min-height:0}
  .rival-card .rival-ask{font-size:19px;margin-top:4px}
  .rival-card .rival-facts,.rival-card .rival-meta{font-size:12px;margin-top:4px}
}
.rival-list{margin-top:8px;border-top:1px solid var(--ink12)}
.rival-row{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:12px;align-items:start;padding:8px 0;border-bottom:1px solid var(--ink12)}
.rival-row.is-subject{border-bottom:2px solid currentColor}
.sc-navy .rival-list,.sc-navy .rival-row{border-color:rgba(250,248,244,.14)}
.rival-ph{width:64px;height:64px;object-fit:cover;display:block;background:var(--navy)}
.rival-ph.is-empty{min-height:64px}
.rival-body{min-width:0}
.rival-addr{font-size:16px;font-weight:600}
.rival-facts{font-size:13px;font-variant-numeric:tabular-nums;margin-top:2px;opacity:.85}
.rival-ask{font-family:'Amboqia Boriango',Georgia,serif;font-size:22px;font-variant-numeric:tabular-nums;white-space:nowrap}
.rival-meta{font-size:13px;opacity:.7;margin-top:2px;line-height:1.35}
.pin-map-wrap{margin:12px 0 20px}
.pin-map{width:100%;height:auto;display:block;border:1px solid var(--ink12)}
/* The tile is a bitmap; the pins are DOM over it, positioned from the centre
   and zoom the tile was drawn at. That is what lets a pin be tapped, light its
   row, and be a 44px target on a phone (tasteReview item 2). */
/* A CROPPED tile and a percentage-positioned pin cannot both be right: the
   pins are placed as a share of the whole image, so the frame must show the
   whole image. A cover crop inside a max-height was putting every pin
   on the wrong house. */
.pin-map-frame{position:relative;margin:12px 0 6px;line-height:0}
.pin-map-frame .pin-map{max-height:none;object-fit:fill;aspect-ratio:16/9}
.pin-hit{position:absolute;transform:translate(-50%,-50%);width:44px;height:44px;padding:0;border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}
.pin-hit:focus-visible{outline:3px solid rgba(16,39,66,.45);outline-offset:0;border-radius:22px}
/* A cream ring, so two pins that still touch after the dodge read as two pins
   rather than one blob. The dodge cannot open a bigger gap without moving a
   pin off the house it names, which is the worse error. */
.pin-dot{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--navy);color:var(--cream);font:600 13px/1 Geist,system-ui,sans-serif;box-shadow:0 0 0 2px var(--cream),0 1px 6px rgba(16,39,66,.35)}
/* Their own home is never buried under a sale pin. */
.pin-hit.is-subject{z-index:2}
/* Smaller dots on a phone: the map is a third the width there, so a cluster
   ring that separates 28px dots on a desk screen cannot separate them at 375. */
@media (max-width:700px){.pin-dot{width:22px;height:22px;font-size:11px}.pin-hit.is-subject .pin-dot{width:20px;height:20px;font-size:12px}}
.pin-hit.is-subject .pin-dot{border-radius:2px;width:26px;height:26px;font-size:14px}
/* Houses 10 metres apart cannot be pulled apart on a tile without pointing at
   the wrong block, so occlusion is resolved by the interaction instead: the
   pin a reader lit comes to the front, whatever it was sitting under. */
.pin-hit.is-on,.pin-hit:focus-visible{z-index:3}
.pin-hit.is-on .pin-dot{background:var(--cream);color:var(--navy);box-shadow:0 0 0 3px var(--navy)}
/* THREE FAMILIES, THREE GLYPHS (Delta 3): filled numbered for a sale that
   closed, hollow lettered for a home on the market, hollow barred roman for a
   listing that came off unsold. */
.pin-hit.is-active .pin-dot,.pin-hit.is-unsold .pin-dot{background:var(--cream);color:var(--navy);box-shadow:0 0 0 2px var(--navy),0 1px 6px rgba(16,39,66,.25)}
.pin-hit.is-unsold .pin-dot{position:relative}
.pin-hit.is-unsold .pin-dot::after{content:'';position:absolute;left:-5px;right:-5px;top:50%;height:2px;background:var(--navy)}
/* Every pin tells the tale: days on market, price changes, the outcome. */
.pin-note{position:absolute;left:50%;top:100%;transform:translate(-50%,8px);width:210px;padding:9px 11px;background:var(--cream);border:1px solid var(--navy);color:var(--navy);font-size:12px;line-height:1.4;text-align:left;z-index:4;opacity:0;pointer-events:none;transition:opacity 200ms ease-out}
.pin-hit.is-on .pin-note,.pin-hit:hover .pin-note,.pin-hit:focus-visible .pin-note{opacity:1}
@media (prefers-reduced-motion:reduce){.pin-note{transition:none}}
.pin-note .pn-a{display:block;font-weight:600}
.pin-note .pn-o,.pin-note .pn-d{display:block;opacity:.8}
.pin-legend{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:8px 20px;font-size:13px;opacity:.75}
.pin-legend .pl-i{display:flex;align-items:center;gap:8px}
.pin-legend .pl-k{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--navy);color:var(--cream);font-size:11px;font-weight:600;flex:0 0 auto}
.pin-legend .is-active .pl-k,.pin-legend .is-unsold .pl-k{background:transparent;color:var(--navy);box-shadow:inset 0 0 0 2px var(--navy)}
.pin-legend .is-subject .pl-k{background:transparent;color:var(--navy)}
.peer-stories{list-style:none;margin:14px 0 0;padding:0}
.peer-stories li{display:flex;align-items:baseline;gap:10px;margin:0 0 8px;font-size:14px;line-height:1.5}
.peer-stories .ps-a{font-weight:600;white-space:nowrap}
.peer-stories .ps-r{min-width:0;opacity:.85}
@media (max-width:700px){.peer-stories li{flex-direction:column;gap:2px}.peer-stories .ps-a{white-space:normal}}
.lot-strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;margin:14px 0 8px}
.lot-tile{margin:0}
.lot-tile svg{width:100%;height:auto;display:block;border:1px solid var(--ink12);border-radius:10px}
.lot-tile.is-subject svg{border-width:2px}
.lot-tile figcaption{display:block;margin-top:7px;font-size:13px;line-height:1.4}
.lot-badge{font-weight:700;letter-spacing:.04em;text-transform:uppercase;font-size:11px;margin-right:7px}
.lot-addr{font-weight:500}
.lot-acres,.lot-ppa{display:block;opacity:.72}
.lot-tile abbr{text-decoration:none;border-bottom:1px dotted currentColor}
.lot-scale{width:150px;height:auto;display:block;margin:4px 0 10px}
.comp-row.is-on,.pin-sale.is-on,.pin-subject.is-on{outline:3px solid var(--navy)}
.szn{margin:16px 0 8px}
.szn svg{width:100%;height:auto;display:block}
.srcgrid{display:grid;gap:10px;margin-top:8px}
.srcrow{display:grid;grid-template-columns:220px 1fr;gap:16px;padding:12px 0;border-top:1px solid var(--ink12);font-size:13px}
.srck{font-weight:600}
.srcv{opacity:.7;font-variant-numeric:tabular-nums}
@media (max-width:700px){.srcrow{grid-template-columns:1fr;gap:4px}}
.plan-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-top:8px}
.plan{background:rgba(250,248,244,.06);border:1px solid rgba(250,248,244,.14);padding:20px}
.plan-t{font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.7;margin-bottom:8px}
.plan-a{font-size:16px;font-weight:600;line-height:1.45}
.plan-b{font-size:13px;opacity:.7;margin-top:8px}
.yr{display:flex;gap:10px;align-items:flex-end;height:300px;margin:10px 0 18px;overflow-x:auto;padding-bottom:6px}
.yr-col{flex:1;min-width:64px;display:flex;flex-direction:column;align-items:center;height:100%}
.yr-v{font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums;margin-bottom:6px;white-space:nowrap}
.yr-bar-wrap{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center}
.yr-bar{width:72%;max-width:52px;height:var(--h);background:var(--navy);transform:scaleY(0);transform-origin:bottom;transition:transform 1s cubic-bezier(.2,.7,.2,1)}
.on .yr-bar{transform:scaleY(1)}
.yr-m{font-size:13px;font-weight:600;margin-top:8px}
.yr-c{font-size:11.5px;opacity:.55;margin-top:2px}
.sty-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px 44px;margin:34px 0 10px}
.sty-h{font-family:'Amboqia Boriango',Georgia,serif;font-weight:400;font-size:22px;margin-bottom:8px}
.sty-b{font-size:15.5px;opacity:.85;line-height:1.6}
.nb-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:6px}
.nb{background:var(--cream);border:1px solid var(--ink12);overflow:hidden}
.nb-img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;border-radius:0}
.nb-b{padding:14px 16px 16px}
.nb-a{font-size:13.5px;font-weight:600;opacity:.8}
.nb-p{font-size:13px;font-variant-numeric:tabular-nums;opacity:.65;margin-top:3px}
.nb-l{font-size:13.5px;margin-top:9px;line-height:1.5}
.pos{font-weight:600;opacity:1}
.fin,.bench{max-width:640px;margin-top:6px}
.fin-row,.bench-row{display:flex;align-items:center;gap:14px;margin:14px 0}
.fin-l,.bench-l{width:190px;font-size:14px;opacity:.85}
.fin-track,.bench-track{flex:1;height:14px;background:rgba(250,248,244,.14);overflow:hidden}
.sc-cream .fin-track,.sc-cream .bench-track{background:var(--ink12)}
.fin-bar,.bench-bar{height:100%;width:0;background:var(--cream);transition:width 1s cubic-bezier(.2,.7,.2,1)}
.bench-bar.warm{opacity:.55}
.on .fin-bar,.on .bench-bar{width:var(--w)}
.fin-v,.bench-v{width:64px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;font-size:15px}
.like-grid,.cando-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:10px}
.like,.cando{background:var(--cream);border:1px solid var(--ink12);padding:22px}
.like-h,.cando-h{font-size:16px;font-weight:600;line-height:1.4}
.like-d{font-size:13.5px;opacity:.65;margin-top:8px}
.cando-t{font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.55;margin-bottom:8px}
.next-in{display:flex;gap:48px;align-items:flex-end}
.br-img{width:min(320px,34vw);height:auto;flex:0 0 auto;align-self:flex-end;max-width:100%}
.next-b{flex:1;min-width:0}
.next-note{font-size:16px;line-height:1.55;max-width:56ch;margin:0 0 12px;color:rgba(250,248,244,.88)}
.sc-cream .next-note{color:var(--ink)}
.print-out{margin-top:22px;font-size:13px}
.print-out a{color:rgba(250,248,244,.7);text-decoration:underline;text-underline-offset:4px}
.cta{display:flex;gap:14px;flex-wrap:wrap;align-items:stretch;margin:30px 0 22px}
.btn{display:inline-block;padding:15px 28px;border:1.5px solid transparent;font-weight:600;font-size:15.5px;text-decoration:none;transition:transform .18s ease,box-shadow .18s ease}
.btn:hover{transform:translateY(-1px)}
.btn.pri{background:var(--navy);color:var(--cream);box-shadow:0 12px 28px rgb(16 39 66 / .22)}
.btn.sec{border:1.5px solid var(--navy);color:var(--navy)}
.btn.ter{color:var(--ink70);text-decoration:underline;text-underline-offset:4px;padding-left:8px;padding-right:8px}
.sig{font-size:14.5px;font-weight:600}
.fine{font-size:12px;opacity:.55;margin-top:14px;max-width:640px;line-height:1.5}
html.anim .r{opacity:0;transform:translateY(22px)}
html.anim .hero .r{opacity:1;transform:none}
html.anim .on .r{opacity:1;transform:none;transition:opacity .55s ease-out,transform .55s ease-out}
html.anim .on .r:nth-child(2){transition-delay:.06s}
html.anim .on .r:nth-child(3){transition-delay:.12s}
html.anim .on .r:nth-child(4){transition-delay:.18s}
html.anim .on .r:nth-child(5){transition-delay:.24s}
@media (prefers-reduced-motion:no-preference){.hero-bed{animation:kb 26s ease-in-out infinite alternate}}
@keyframes kb{from{transform:scale(1)}to{transform:scale(1.08)}}
@media screen and (max-width:700px){
  /* Contain leaves a 375-wide hero as a 250px photo strip over 900px of blur.
     On a phone the photo is a band and the title block sits under it, which
     is the same promise (nothing in the photo is cut) in a form that fills
     the screen. */
  /* .sc.hero, not .hero: the 860px rule below resets .sc padding and would
     otherwise put an 18px gutter around a full-bleed photo. */
  .sc.hero{display:block;min-height:0;padding:0;overflow:visible}
  .hero-bed,.hero-scrim,.hero .cue{display:none}
  .hero-img{position:static;width:100%;height:auto;object-fit:contain}
  .hero .in{position:static;padding:32px 18px 44px;background:var(--navy)}
  .hero .in{background:var(--navy)}
  .hero-h{font-size:clamp(34px,11vw,54px)}
}
@media (max-width:860px){
  .stat2,.stat3,.stat4{grid-template-columns:1fr 1fr}
  .comp-row,.story-grid,.like-grid,.cando-grid,.sty-grid,.plan-grid{grid-template-columns:1fr}
  .nb-grid{grid-template-columns:1fr 1fr}
  .yr{height:220px}
  .next-in{flex-direction:column;align-items:flex-start}
  /* In a column the row's flex-end alignment pushes the portrait off the
     right edge of the panel and clips its shoulder. */
  .br-img{align-self:flex-start;width:min(180px,42vw)}
  .fin-l,.bench-l{width:120px}
  .sc{padding:72px 18px}
  .status-tiles{grid-template-columns:1fr 1fr}
}
.status-hero{margin:8px 0 40px}
.status-hero-n,.sold-hero-n,.inv-hero-n{font-family:'Amboqia Boriango',Georgia,serif;font-size:clamp(72px,13vw,148px);line-height:0.92;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.status-hero-l,.sold-hero-l,.inv-hero-l{font-size:15px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;opacity:.65;margin-top:12px}
.status-hero-m{font-size:clamp(18px,2.4vw,26px);font-weight:600;margin-top:10px;font-variant-numeric:tabular-nums}
.status-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:8px 0 18px}
.status-tile{background:var(--cream);border:1px solid var(--ink12);padding:20px 18px}
.status-tile-n{font-family:'Amboqia Boriango',Georgia,serif;font-size:clamp(32px,4vw,48px);line-height:1;font-variant-numeric:tabular-nums}
.status-tile-l{font-size:13px;opacity:.7;margin-top:8px;line-height:1.35}
.status-tile-m{font-size:14px;font-weight:600;margin-top:10px;font-variant-numeric:tabular-nums}
.sold-hero{margin:8px 0 28px}
.inv-hero{margin:8px 0 28px}
.inv-verdict{display:block;margin-top:18px;font-size:15px;font-weight:600;letter-spacing:.04em}
.szn.is-hero{margin-top:36px}
/* TOP, not bottom. The subject head carries one line the sale heads do not,
   so bottom alignment staircased six photos to six different heights. */
table.comp-matrix thead th.v{vertical-align:top;text-align:center}
table.comp-matrix .matrix-thumb{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;margin:0 0 8px}
table.comp-matrix .matrix-addr{display:block}
/* The map's pin, at reading size. The number beside a sale is the KEY to that
   pin, not a rank, and drawn as the pin it cannot be misread as one after the
   grid is sorted. */
.pin-badge.is-active,.pin-badge.is-unsold{background:transparent;color:var(--navy);box-shadow:inset 0 0 0 2px var(--navy)}
.pin-badge.is-subject{background:transparent;color:var(--navy)}
.subhead.adjustments-h,h4.adjustments-h{margin-top:22px}
.pin-badge{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--navy);color:var(--cream);font-size:11px;font-weight:700;line-height:1;margin-right:7px;flex:0 0 auto;vertical-align:middle}
.addr-row{display:flex;align-items:center;justify-content:center}
.addr-row .matrix-addr{min-width:0}
.addr-row.is-card{justify-content:flex-start;gap:8px;margin:0 0 6px}
.addr-row.is-card .pin-badge{margin-right:0}
.addr-row.is-card .comp-stack-addr{margin:0;flex:1 1 auto;min-width:0}
.small{font-size:13px;opacity:.65;line-height:1.45;margin-top:12px;max-width:720px}
.chart-read{font-size:16px;line-height:1.5;margin-top:18px;max-width:720px}
/* NO PAN BOX: every chart ships a 360-unit phone layout. */
.median-phone{display:none}
@media screen and (max-width:700px){.median-wide{display:none}.median-phone{display:block}}
@media print{.median-wide{display:block!important}.median-phone{display:none!important}}
.mos-phone{display:none}
@media screen and (max-width:700px){.mos-wide{display:none}.mos-phone{display:block}}
@media print{.mos-wide{display:block!important}.mos-phone{display:none!important}}
.worth-phone{display:none}
@media screen and (max-width:700px){.worth-wide{display:none}.worth-phone{display:block}}
@media print{.worth-wide{display:block!important}.worth-phone{display:none!important}}
.pin-map{max-height:60vh;object-fit:cover}
/* Chapter 3's lead line, under the number that is the chapter title. */
.worth-lead{font-size:clamp(16px,2vw,19px);opacity:.85;max-width:640px;margin-bottom:26px}
.worth-lead+.worth-lead-note{margin-top:-18px}
.worth-lead-note{font-size:clamp(15px,1.8vw,17px);max-width:640px;margin:0 0 26px;border-left:2px solid var(--navy);padding-left:12px}
table.comp-matrix .matrix-sub{display:block;margin-top:4px;font-size:12px;font-weight:400;opacity:.65}
table.comp-matrix a.matrix-addr,.comp-stack-card a.comp-stack-addr{display:block;color:inherit;text-decoration:none;border-bottom:1px solid var(--ink12)}
/* The price-path primitive (blueprint, Delta 1). Two layouts, one visible. */
.pp-wrap{margin:10px 0 4px}
.pp svg{width:100%;height:auto;display:block}
.pp-phone{display:none}
@media screen and (max-width:700px){.pp-wide{display:none}.pp-phone{display:block}}
@media print{.pp-wide{display:block!important}.pp-phone{display:none!important}}
/* A card in a four-up grid is narrower than the wide line at every viewport,
   so the compact drawing is the only one it carries — print included. */
.pp-wrap.is-compact{margin:10px 0 0}
.rival-card .pp-wrap{margin:10px 0 0}
@media print{.pp-wrap.is-compact .pp{display:block!important}}
/* Chapter 2: one story per listing that did not sell. */
.dns-set{display:grid;gap:26px;margin:22px 0 10px}
.dns-card{display:grid;grid-template-columns:260px minmax(0,1fr);gap:22px;padding-top:22px;border-top:1px solid var(--ink12)}
.dns-card.is-yours{border-top:2px solid var(--navy)}
.dns-photo{width:100%;aspect-ratio:4 / 3;object-fit:cover;display:block}
.dns-photo.is-empty{background:rgba(16,39,66,.06)}
.dns-addr{display:block;font-size:18px;font-weight:600;color:var(--navy);text-decoration:none;border-bottom:1px solid var(--ink12)}
a.dns-addr:hover{border-bottom-color:var(--navy)}
.dns-ask{font-family:'Amboqia Boriango',Georgia,serif;font-size:24px;font-variant-numeric:tabular-nums;margin-top:6px}
.dns-facts{font-size:13px;opacity:.65;margin-top:4px}
.dns-read{font-size:15px;line-height:1.55;margin:8px 0 0}
@media (max-width:700px){.dns-card{grid-template-columns:1fr;gap:12px}}
/* Chapter 3's method, stated before the evidence for it. */
.method{margin:10px 0 20px;max-width:70ch}
.method-line{font-size:16px;line-height:1.6;margin:0 0 10px}
/* The price path as ONE cell of the grid: the shape, no type, no toggle. It
   used to be drawn twice, once in the phone card and again in a stacked block
   under the grid (tasteReview item 3). */
.pp-spark{display:block;width:100%;min-width:0}
.pp-spark svg{width:100%;height:auto;display:block}
table.comp-matrix td.is-draw{padding:6px 8px;vertical-align:middle}
.sale-paths-h{font-size:19px;font-weight:600;margin:18px 0 10px}
/* Their own home leads the phone stack. */
.comp-stack-card.is-yours{border-color:var(--navy);border-width:2px}
/* Considered and not used. */
ul.rejected-list{list-style:none;margin:6px 0 12px;padding:0}
ul.rejected-list li{display:grid;grid-template-columns:200px minmax(0,1fr);gap:4px 18px;padding:10px 0;border-bottom:1px solid var(--ink12);font-size:15px}
ul.rejected-list .rj-addr{font-weight:600}
ul.rejected-list .rj-why{opacity:.7}
@media (max-width:700px){ul.rejected-list li{grid-template-columns:1fr;gap:2px}}
/* The phone card carries the same grid lines as the column. */
.comp-stack-grid{display:grid;gap:4px;margin-top:10px}
.comp-stack-line{display:flex;justify-content:space-between;gap:14px;font-size:14px}
.comp-stack-line .k{opacity:.6}
.comp-stack-line .v{font-variant-numeric:tabular-nums;font-weight:600}
/* Chapter 2b's centrepiece: what the first ask realized, by weeks. */
table.realization{width:100%;table-layout:fixed;border-collapse:collapse;margin:16px 0 8px;font-size:15px}
table.realization col.rz-weeks{width:38%}
table.realization col.rz-n{width:12%}
table.realization col.rz-mark{width:30%}
table.realization col.rz-share{width:20%}
/* The mark column carries the encoding, so the share reads as a shape before
   it reads as five numbers. The dot column has no type in it: the header names
   the scale once. */
table.realization .rz-mark{text-align:left;padding-right:14px}
table.realization thead th.rz-mark{white-space:normal}
.rz-svg{width:100%;height:14px;display:block;overflow:visible}
table.realization th,table.realization td{padding:12px 10px;border-bottom:1px solid var(--ink12);text-align:left}
table.realization thead th{font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.6}
table.realization td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
/* The header WRAPS; only the figures stay on one line. "Share of the first ask"
   held on one line in a 20% column pushed a fixed-layout table 74px past a 375
   screen, and the whole document with it. */
table.realization th.n{text-align:right;white-space:normal}
table.realization tr.is-mine{font-weight:600}
table.realization tr.is-mine th,table.realization tr.is-mine td{border-bottom:2px solid var(--navy)}
.rz-mine{display:block;font-size:12px;font-weight:400;opacity:.65}
@media (max-width:700px){table.realization{font-size:13px}table.realization th,table.realization td{padding:9px 4px}table.realization thead th{font-size:10px;letter-spacing:.06em;white-space:normal}}
/* Chapter 2's two graphics, same two-layout mechanism as the timeline. */
.timing-phone,.outcome-phone{display:none}
@media screen and (max-width:700px){.timing-wide,.outcome-wide{display:none}.timing-phone,.outcome-phone{display:block}}
@media print{.timing-wide,.outcome-wide{display:block!important}.timing-phone,.outcome-phone{display:none!important}}
/* ONE COMPOSED SPREAD (tasteReview item 4). The two graphics that answer the
   same question sit side by side on a screen and stack on a phone, under one
   title with one source line. A column is ~520px, so it carries the drawn-to-
   fit layout at every width — the 720-unit one scaled into half a screen puts
   its axis type at nine pixels. */
.spread{display:grid;grid-template-columns:1fr 1fr;gap:14px 44px;align-items:start;margin:8px 0 4px}
.spread-col{min-width:0}
.spread .timing-wide,.spread .outcome-wide{display:none}
.spread .timing-phone,.spread .outcome-phone{display:block}
.spread h3.subhead{margin-top:14px}
@media (max-width:900px){.spread{grid-template-columns:1fr;gap:4px}}
@media print{.spread{display:block}.spread .timing-wide,.spread .outcome-wide{display:block!important}.spread .timing-phone,.spread .outcome-phone{display:none!important}}
/* Chapter 1's timeline. Same two-layout mechanism (see render-css-sections). */
.timeline-phone{display:none}
@media screen and (max-width:700px){.timeline-wide{display:none}.timeline-phone{display:block}}
@media print{.timeline-wide{display:block!important}.timeline-phone{display:none!important}}
/* Same mechanism for the days-to-offer strip (F8): panning put the subject's
   own bar label, the punchline, outside the visible width on a phone. */
.days-phone{display:none}
@media screen and (max-width:700px){.days-wide{display:none}.days-phone{display:block}}
@media print{.days-wide{display:block!important}.days-phone{display:none!important}}
/* The market stat row (F7). Same figures, same order, same labels as the
   letter; the immersive's own register for the numerals. The declarations
   match .letter-body .stat exactly, so a strip inside a wrapped letter body
   keeps the size it already had. */
.stat-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin:36px 0}
.stat-strip.is-1{grid-template-columns:1fr}
.stat-strip.is-2{grid-template-columns:repeat(2,1fr)}
.stat-strip.is-4{grid-template-columns:repeat(4,1fr)}
.stat-strip .stat .val{font-family:'Amboqia Boriango',Georgia,serif;font-size:clamp(28px,3.6vw,44px);line-height:1;font-variant-numeric:tabular-nums}
.stat-strip .stat .lbl{font-size:13px;opacity:.7;margin-top:8px;line-height:1.4}
.stat-strip .stat .lbl.vd{font-weight:600;opacity:.95;margin-top:6px}

/* The closing scene is the only navy one, so its buttons invert there rather
   than carrying their own modifier class. */
.sc-navy .btn.pri{background:var(--cream);color:var(--navy);box-shadow:0 12px 28px rgb(0 0 0 / .28)}
.sc-navy .btn.sec{border-color:var(--cream);color:var(--cream)}
.sc-navy .btn.ter{color:rgba(250,248,244,.75)}
/* A chart drawn in navy ink is invisible on a navy scene. The median-close
   line printed a caption over a blank field until this landed. Scoped to the
   scene, not to one wrapper class, so a chart moved to a navy chapter cannot
   disappear again. */
.sc-navy svg text{fill:var(--cream)}
.sc-navy svg line{stroke:rgba(250,248,244,.5)}
.sc-navy svg [fill='#102742']{fill:var(--cream)}
.sc-navy svg [stroke='#102742']{stroke:var(--cream)}
.sc-navy svg path[fill='#102742']{fill:var(--cream);fill-opacity:.14}
.letter-body table.kv{width:100%;border-collapse:collapse;font-size:15px}
.letter-body table.kv th{text-align:left;font-weight:500;opacity:.7;padding:8px 16px 8px 0;border-bottom:1px solid var(--ink12);width:38%}
.letter-body table.kv td{padding:8px 0;border-bottom:1px solid var(--ink12)}
/* The net-at-list ledger, on screen. Same rows the letter prints, at reading
   size, with the money column right-aligned so the column adds up by eye. */
.letter-body table.kv.netsheet th{width:62%;opacity:1;font-weight:500}
.letter-body table.kv.netsheet td.v{text-align:right;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.letter-body table.kv.netsheet .ln-src{display:block;font-size:13px;opacity:.6;font-weight:400;margin-top:3px}
.letter-body table.kv.netsheet tr.is-net th,
.letter-body table.kv.netsheet tr.is-net td.v{border-top:2px solid var(--navy);border-bottom:0;font-weight:700;padding-top:12px}
@media (max-width:700px){
  .letter-body table.kv.netsheet,.letter-body table.kv.netsheet th{font-size:14px}
  .letter-body table.kv.netsheet .ln-src{font-size:12px}
}
.letter-body .stat-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin:24px 0}
/* AFTER .letter-body .stat-strip, not before it. Sitting above that rule the
   phone override lost to it on equal specificity, and three money figures at
   clamp(28px,3.6vw,44px) cannot shrink below their own min-content — so the
   strip ran 78px past a 375 viewport and gave the whole document a horizontal
   scrollbar. Each cell also gets min-width:0 so a grid track can shrink at all. */
@media (max-width:700px){
  .stat-strip,.stat-strip.is-4{grid-template-columns:repeat(2,1fr)}
  .stat-strip.is-3,.letter-body .stat-strip{grid-template-columns:1fr}
  .stat-strip .stat{min-width:0}
}
.letter-body .stat .lbl{font-size:13px;opacity:.7;margin-top:8px;line-height:1.4}
.letter-body .stat .val{font-family:'Amboqia Boriango',Georgia,serif;font-size:clamp(28px,3.6vw,44px);line-height:1;font-variant-numeric:tabular-nums}
.letter-body p{margin:0 0 14px;max-width:720px}
.letter-body h3.subhead{font-size:17px;font-weight:600;margin:22px 0 6px}
.letter-body ul{margin:0 0 16px 18px}
.letter-body li{margin:6px 0}
.letter-body .signature-page{display:flex;gap:24px;align-items:flex-start;margin-top:28px}
.letter-body .portrait{width:120px;height:auto}
.letter-body .fine,.letter-body .small{font-size:13px;opacity:.65}
.photo-set{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px}
.photo-tile{margin:0;overflow:hidden;background:var(--navy)}
.photo-tile img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:0}
.photo-lead{grid-column:1 / -1}
.photo-lead img{aspect-ratio:16/9}
.facts-block ul{margin:0 0 16px 18px}
.facts-block li{margin:6px 0}
@media (max-width:560px){.stat2,.stat3,.stat4{grid-template-columns:1fr}.photo-set{grid-template-columns:1fr 1fr}.status-tiles{grid-template-columns:1fr}}
/* TAP TARGETS (tasteReview item 3). 65 controls measured under 44px at 375,
   starting with the address links a seller taps to open a sale. A block link
   inside a card owns its full width, so only its height had to grow. Inline
   links inside a sentence stay inline — that is what a sentence is. */
.comp-stack-card a.comp-stack-addr,a.dns-addr,.rival-card .rival-addr{display:block;min-height:44px;padding:11px 0;box-sizing:border-box}
/* Chapter 5's recent sales: a row of tappable chips, not 21px inline links in
   a paragraph (tasteReview round two, item 3). */
.street-sales{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0}
a.street-sale{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:10px 14px;border:1px solid var(--ink12);border-radius:10px;color:inherit;text-decoration:none;font-size:15px}
a.street-sale:hover{border-color:var(--navy)}
a.street-sale .n{font-variant-numeric:tabular-nums;font-weight:600}
.print-out a{display:inline-block;min-height:44px;padding:12px 0;box-sizing:border-box}
@media print{.comp-stack-card a.comp-stack-addr,a.dns-addr,.rival-card .rival-addr{min-height:0;padding:0}}
@media print{
  .sc{min-height:0;padding:24px}
  .cue{display:none}
  .hero{color:var(--navy)}
}
`
}

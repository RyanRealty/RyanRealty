#!/usr/bin/env node
/**
 * v9 PICKER — Schoolhouse interiors + full copy variations + sample layout.
 *
 * Layout constraint (Matt 2026-05-28):
 *   - Broker(s) bottom-left, max 1/3 height (~360px max)
 *   - Headline + trust line + sub-CTA + button in bottom-right 2/3
 *   - Photo carries the top 2/3 of the frame
 *
 * Layout backed by:
 *   - Z-pattern eye scan: top-left brand → top-right photo → bottom-left
 *     human face (broker) → bottom-right CTA destination
 *   - Meta best practice: square 1:1 outperforms 1.91:1 on FB feed
 *   - Visual hierarchy: image → headline → CTA
 *   - Human face = pattern recognition trigger (place at attention zone)
 *
 * Output: out/seller-ad-concepts/picker-v2/picker.html
 */
import { chromium } from 'playwright'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'out/seller-ad-concepts/picker-v2')
const FONTS_LOCAL = resolve(OUT_DIR, 'fonts')

await mkdir(OUT_DIR, { recursive: true })
await mkdir(FONTS_LOCAL, { recursive: true })
await mkdir(resolve(OUT_DIR, 'schoolhouse'), { recursive: true })

// Copy canvas fonts
const CANVAS_FONTS = '/Users/matthewryan/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/e399b1dc-7d6a-418b-8a3c-c124774e5958/f3aea35d-324b-4df4-a3ca-a265239c30ad/skills/canvas-design/canvas-fonts'
const fontsToCopy = ['InstrumentSerif-Italic.ttf','InstrumentSerif-Regular.ttf','InstrumentSans-Regular.ttf','Italiana-Regular.ttf','NationalPark-Regular.ttf','NationalPark-Bold.ttf','CrimsonPro-Italic.ttf']
for (const f of fontsToCopy) {
  if (!existsSync(resolve(FONTS_LOCAL, f))) {
    await copyFile(resolve(CANVAS_FONTS, f), resolve(FONTS_LOCAL, f))
  }
}

// =======================================================================
// PHOTO INVENTORY
// =======================================================================
const ASSET_LIBRARY = [
  { code: 'A1', label: 'Old Mill canonical 4K',       path: 'design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg', cat: 'landscape', notes: 'Three smokestacks, flag, river, Cascade horizon. Brand-locked hero.' },
  { code: 'A2', label: 'Pronghorn green + Mt. Bachelor', path: 'public/lp/tetherow/img/tetherow-course-118.jpg', cat: 'landscape', notes: 'Snow-capped peak, red flag, fairway. Aspirational Bend.' },
  { code: 'A3', label: 'Tower Theater night neon',     path: 'public/lp/central-oregon-golf/img/bend-cascades-01.jpg', cat: 'landscape', notes: 'Downtown Bend, neon, long-exposure street trails.' },
  { code: 'A4', label: 'Three Sisters + pasture',      path: 'out/design-recon/fb-lead-gen-ad/examples/0001.jpg', cat: 'landscape', notes: 'Three Sisters peaks, classic ranch fence foreground.' },
  { code: 'A5', label: 'Tetherow aerial course',       path: 'public/lp/tetherow/img/tetherow-aerial-course.jpg', cat: 'landscape', notes: 'Aerial Tetherow, Cascade horizon, resort homes.' },
  { code: 'A6', label: 'Old Mill bridge + flags',      path: 'public/lp/central-oregon-golf/img/bend-cascades-03.jpg', cat: 'landscape', notes: 'Old Mill from water angle, festival bridge flags.' },
]

// Schoolhouse Rd — Matt's actual listing (the Ernie Oster transaction)
const SCHOOLHOUSE = [
  { code: 'SH1', label: 'Schoolhouse Rd · front exterior',  src: 'out/schoolhouse-just-sold/photos/mls-220221770-01.jpg', cat: 'exterior',   notes: 'Stone-and-wood NW vernacular, garage, mature pines. Sold home — local proof.' },
  { code: 'SH2', label: 'Schoolhouse Rd · living + fireplace', src: 'out/schoolhouse-just-sold/photos/mls-220221770-02.jpg', cat: 'interior', notes: 'Stone fireplace, antler chandelier, sectional, beam ceiling, leather chair.' },
  { code: 'SH3', label: 'Schoolhouse Rd · primary BR + fireplace', src: 'out/schoolhouse-just-sold/photos/mls-220221770-03.jpg', cat: 'interior', notes: 'Reclaimed wood wall, primary fireplace, sliding doors to landscape.' },
  { code: 'SH4', label: 'Schoolhouse Rd · kitchen + dining', src: 'out/schoolhouse-just-sold/photos/mls-220221770-04.jpg', cat: 'interior', notes: 'Antler chandelier, oak island, dining bench, beam coffer.' },
  { code: 'SH5', label: 'Schoolhouse Rd · hero alt angle',  src: 'public/images/lp/schoolhouse-rd-hero.jpg', cat: 'exterior', notes: 'Front exterior alternate angle, three-car garage prominent.' },
  { code: 'SH6', label: 'Schoolhouse Rd · back exterior + hot tub', src: 'listing_video_v4/public/reels-photos/schoolhouse.jpg', cat: 'exterior', notes: 'Back of house, picture window, hot tub patio, pine backdrop.' },
]

// Copy Schoolhouse photos into picker dir for reliable rendering
for (const sh of SCHOOLHOUSE) {
  const target = resolve(OUT_DIR, 'schoolhouse', basename(sh.src))
  if (!existsSync(target)) {
    await copyFile(resolve(ROOT, sh.src), target)
  }
  sh.localPath = `schoolhouse/${basename(sh.src)}`
}

// =======================================================================
// COPY MENUS — full variation per Matt's request
// =======================================================================
const HEADLINES = [
  'Are you considering making a move?',
  'What does your next chapter look like?',
  'Is selling in your future?',
  'Want to know what your home is worth today?',
  'Thinking about a change in Bend?',
  'Curious what your equity could do?',
  'Have you been wondering about your home’s value?',
  'Ready for what comes next?',
  'Is now the right time to sell?',
  'What would your home sell for in today’s market?',
  'Bend is moving. Is it time you did too?',
  'Where could your equity take you next?',
  'How much has your Bend home appreciated?',
  'Wondering where the Bend market stands?',
  'Thinking about life after this house?',
]

const TRUST_LINES = [
  'Go with the team Bend trusts.',
  'Bend’s trusted local brokerage.',
  'Where Bend goes to sell.',
  'Local team. Five-star rated.',
  'Trusted by your Bend neighbors.',
  'The brokerage Bend keeps recommending.',
  'Five stars from twenty-four Bend sellers.',
  'Local experts. Local team. Local results.',
  'Trusted by Bend sellers since 2023.',
  'Your Bend-grown brokerage.',
  'The team Bend sellers refer.',
]

const SUB_CTAS = [
  'Get a professional opinion of value from local Bend brokers, not a Zestimate.',
  'A real estimate built from real Bend sales, not an algorithm guess.',
  'A free professional market analysis from local Bend brokers. No phone call.',
  'Skip the Zestimate. Get a real value from the brokers Bend trusts.',
  'A real human estimate from local brokers who close Bend deals weekly.',
  'Free professional valuation. No automated estimate. No commitment.',
  'Local brokers. Local data. Real estimate, fast.',
  'Built from actual Bend closings, not a generic algorithm.',
  'A professional broker’s opinion based on this week’s Bend market.',
  'The same valuation we use to list our own clients’ homes.',
]

const BUTTON_VISUAL = [
  { code: 'B1', text: 'Start Now',          notes: 'Matt’s lead pick. Action verb, momentum.' },
  { code: 'B2', text: 'Get My Estimate',    notes: 'First-person, outcome-focused.' },
  { code: 'B3', text: 'See My Home Value',  notes: 'Outcome-named, low friction.' },
  { code: 'B4', text: 'Get a Real Estimate', notes: 'Anti-algorithm framing.' },
  { code: 'B5', text: 'Find Out Now',       notes: 'Curiosity + immediacy.' },
  { code: 'B6', text: 'Contact Ryan Realty', notes: 'Ready-to-go variant. Direct path.' },
  { code: 'B7', text: 'Reach Out Today',    notes: 'Conversational, low pressure.' },
  { code: 'B8', text: 'Start Today',        notes: 'Action + immediacy, softer than Start Now.' },
  { code: 'B9', text: 'Begin Now',          notes: 'Action verb variant.' },
  { code: 'B10', text: 'Get Your Range',    notes: 'Outcome named (price range).' },
  { code: 'B11', text: 'Talk to Matt',      notes: 'Personalized + warm. Use with Matt portrait.' },
  { code: 'B12', text: 'See My Value',      notes: 'Two-word, scan-stopping.' },
]

const FB_BUTTONS = [
  { code: 'F1', text: 'Get Quote',  meta: 'GET_QUOTE',  notes: 'Used by Kristi Weinstock’s 6-year-running winner.' },
  { code: 'F2', text: 'Get Offer',  meta: 'GET_OFFER',  notes: 'Implies a deliverable.' },
  { code: 'F3', text: 'Learn More', meta: 'LEARN_MORE', notes: 'Most common across long-running winners.' },
  { code: 'F4', text: 'Sign Up',    meta: 'SIGN_UP',    notes: 'Conversion-tuned default.' },
  { code: 'F5', text: 'Book Now',   meta: 'BOOK_NOW',   notes: 'If framed around a CMA call.' },
]

const QUOTES = [
  { code: 'Q1', author: 'Ernie Oster',     text: 'Attention to detail and art of the negotiations with data.', mentions: 'matt' },
  { code: 'Q2', author: 'Douglas Grant',   text: 'The most professional, communicative, and honest broker I have ever worked with.', mentions: 'matt' },
  { code: 'Q3', author: 'Audra Hedberg',   text: 'Sold our home faster than we expected, even in a tough market.', mentions: 'matt' },
  { code: 'Q4', author: 'Gary Timms',      text: 'Patient, low pressure with us. Expert guidance.', mentions: 'matt' },
  { code: 'Q5', author: 'Helen Luna Fess', text: 'As a Realtor Broker with 23 years of full-time service, I know what it takes.', mentions: 'matt' },
  { code: 'Q6', author: 'Jim Creekmore',   text: 'We selected Matt to represent us in the estate sale.', mentions: 'matt' },
  { code: 'Q7', author: 'Charise Millard', text: 'Driven, honest and hard working without the high pressure.', mentions: 'matt' },
  { code: 'Q8', author: 'Doug Millard',    text: 'I highly recommend Ryan Realty for both buying and selling.', mentions: 'team' },
  { code: 'Q9', author: 'D. Detweiler',    text: 'Matt with Ryan Realty was great to work with.', mentions: 'team' },
]

// =======================================================================
// SAMPLE LAYOUT — render ONE sample showing the broker-bottom-left-1/3 constraint
// =======================================================================
const FONTS_CSS = `
  @font-face { font-family: 'Crimson Italic'; src: url('fonts/CrimsonPro-Italic.ttf') format('truetype'); font-display: block; }
  @font-face { font-family: 'Instrument Serif Italic'; src: url('fonts/InstrumentSerif-Italic.ttf') format('truetype'); font-display: block; }
  @font-face { font-family: 'Instrument Serif'; src: url('fonts/InstrumentSerif-Regular.ttf') format('truetype'); font-display: block; }
  @font-face { font-family: 'National Park'; src: url('fonts/NationalPark-Regular.ttf') format('truetype'); font-display: block; }
  @font-face { font-family: 'National Park Bold'; src: url('fonts/NationalPark-Bold.ttf') format('truetype'); font-display: block; }
  @font-face { font-family: 'Italiana'; src: url('fonts/Italiana-Regular.ttf') format('truetype'); font-display: block; }
`

const MATT_REL = `${ROOT}/design_system/ryan-realty/assets/team/matt-ryan.png`
const TEAM_REL = `${ROOT}/design_system/ryan-realty/assets/team/team-transparent.png`

function sampleHTML({ photoPath, photoFocus, broker, quote, reviewer, headline, trustLine, subCTA, button }) {
  const brokerImg = broker === 'team' ? TEAM_REL : MATT_REL
  const brokerW = broker === 'team' ? 380 : 260
  const brokerH = broker === 'team' ? 224 : 340 // ≤ 360 (1/3 of 1080)
  const brokerFocus = broker === 'team' ? 'center top' : 'center 32%'
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONTS_CSS}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:1080px;height:1080px;overflow:hidden;background:#0a0d12;color:#faf6ec;font-family:'National Park',sans-serif;position:relative}

    .photo{position:absolute;inset:0;background:url('file://${photoPath}') ${photoFocus}/cover no-repeat;z-index:1}
    /* Strong top scrim so the headline/sub/button read cleanly on any photo */
    .scrim-top{position:absolute;left:0;right:0;top:0;height:46%;background:linear-gradient(180deg,rgba(10,13,18,0.88) 0%,rgba(10,13,18,0.68) 35%,rgba(10,13,18,0.30) 75%,rgba(10,13,18,0) 100%);z-index:2}
    /* Strong bottom scrim so broker + review read cleanly */
    .scrim-bottom{position:absolute;left:0;right:0;bottom:0;height:42%;background:linear-gradient(180deg,rgba(10,13,18,0) 0%,rgba(10,13,18,0.40) 30%,rgba(10,13,18,0.88) 70%,rgba(10,13,18,0.96) 100%);z-index:2}

    /* TOP — headline, subheading, button. Stack left-aligned. */
    .headline{position:absolute;top:80px;left:56px;right:56px;z-index:5;font-family:'Instrument Serif Italic',serif;font-size:84px;line-height:0.98;color:#faf6ec;letter-spacing:-0.018em;text-shadow:0 2px 20px rgba(0,0,0,0.7);max-width:940px}
    .sub-heading{position:absolute;top:284px;left:56px;right:56px;z-index:5;font-family:'National Park Bold',sans-serif;font-size:30px;letter-spacing:0.14em;text-transform:uppercase;color:#faf6ec;text-shadow:0 2px 12px rgba(0,0,0,0.65)}
    .btn{position:absolute;top:354px;left:56px;z-index:5;display:inline-block;background:#faf6ec;color:#0a1424;padding:22px 48px;font-family:'National Park Bold',sans-serif;font-size:24px;letter-spacing:0.18em;text-transform:uppercase;border-radius:2px;box-shadow:0 12px 36px rgba(0,0,0,0.55)}

    /* BOTTOM — broker bottom-left (minimal padding), review quote + attribution next to broker */
    .broker{position:absolute;left:18px;bottom:36px;width:${brokerW}px;height:${brokerH}px;background:url('file://${brokerImg}') ${brokerFocus}/contain no-repeat;z-index:5;filter:drop-shadow(-4px 4px 18px rgba(0,0,0,0.55))}

    .review{position:absolute;left:${broker === 'team' ? '420' : '300'}px;right:56px;bottom:74px;z-index:5}
    .review .text{font-family:'Crimson Italic',serif;font-size:40px;line-height:1.18;color:#faf6ec;letter-spacing:-0.008em;text-shadow:0 2px 16px rgba(0,0,0,0.7)}
    .review .attr{margin-top:22px;font-family:'National Park Bold',sans-serif;font-size:18px;letter-spacing:0.20em;text-transform:uppercase;color:rgba(250,246,236,0.92);text-shadow:0 2px 10px rgba(0,0,0,0.6)}
    .review .attr .name{color:#faf6ec}
  </style></head><body>
    <div class="photo"></div>
    <div class="scrim-top"></div>
    <div class="scrim-bottom"></div>

    <div class="headline">${headline}</div>
    <div class="sub-heading">${trustLine}</div>
    <div class="btn">${button}</div>

    <div class="broker"></div>
    <div class="review">
      <div class="text">"${quote}"</div>
      <div class="attr"><span class="name">${reviewer}</span> · Google review</div>
    </div>
  </body></html>`
}

// Render ONE sample layout demo
console.log('Rendering sample layout demo...')
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

const sampleHtml = sampleHTML({
  photoPath: `${ROOT}/out/schoolhouse-just-sold/photos/mls-220221770-02.jpg`,
  photoFocus: 'center 40%',
  broker: 'matt',
  quote: 'Attention to detail and art of the negotiations with data.',
  reviewer: 'Ernie Oster',
  headline: 'Are you considering making a move?',
  trustLine: 'Go with the team Bend trusts.',
  subCTA: 'A real estimate built from real Bend sales, not an algorithm guess.',
  button: 'Start Now',
})
await writeFile(resolve(OUT_DIR, '_sample.html'), sampleHtml, 'utf-8')
await page.goto(pathToFileURL(resolve(OUT_DIR, '_sample.html')).href, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.screenshot({ path: resolve(OUT_DIR, 'sample-layout-demo.jpg'), type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1080, height: 1080 } })

// Also render with team variant + Schoolhouse exterior
const sampleHtml2 = sampleHTML({
  photoPath: `${ROOT}/out/schoolhouse-just-sold/photos/mls-220221770-01.jpg`,
  photoFocus: 'center 50%',
  broker: 'team',
  quote: 'I highly recommend Ryan Realty for both buying and selling.',
  reviewer: 'Doug Millard',
  headline: 'What does your next chapter look like?',
  trustLine: 'Bend’s trusted local brokerage.',
  subCTA: 'Local brokers. Local data. Real estimate, fast.',
  button: 'Get My Estimate',
})
await writeFile(resolve(OUT_DIR, '_sample2.html'), sampleHtml2, 'utf-8')
await page.goto(pathToFileURL(resolve(OUT_DIR, '_sample2.html')).href, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.screenshot({ path: resolve(OUT_DIR, 'sample-layout-demo-team.jpg'), type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1080, height: 1080 } })

await browser.close()

// =======================================================================
// BUILD PICKER HTML
// =======================================================================
const photoCards = (items) => items.map((p) => {
  const src = p.localPath || `../../../${p.path || p.src}`
  return `<div class="photo-card">
    <img src="${src}" alt="${p.label}">
    <div class="pmeta">
      <span class="ptag">${p.code} · ${p.cat}</span>
      <div class="ptitle">${p.label}</div>
      <div class="pby">${p.notes || ''}</div>
    </div>
  </div>`
}).join('')

const pickerHTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Ryan Realty seller-lead ad picker v2</title>
<style>
  :root{--navy:#102742;--cream:#faf8f4;--soft:rgba(16,39,66,0.6);--rule:rgba(16,39,66,0.12)}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,'Helvetica Neue',sans-serif;background:#f4f0e8;color:var(--navy);padding:0;line-height:1.5}
  .page{max-width:1480px;margin:0 auto;padding:32px 32px 80px}
  h1{font-size:32px;font-weight:700;margin:0 0 6px;letter-spacing:-0.01em}
  p.lede{color:var(--soft);max-width:920px;margin:0 0 24px;font-size:15px;line-height:1.55}
  h2{font-size:24px;font-weight:600;margin:48px 0 6px;padding-bottom:8px;border-bottom:1px solid var(--rule);letter-spacing:-0.005em}
  h3{font-size:13px;font-weight:600;margin:24px 0 12px;text-transform:uppercase;letter-spacing:0.10em;color:var(--soft)}
  .layout-demo{background:#fff;border:1px solid var(--rule);border-radius:10px;padding:24px;margin:0 0 32px;display:grid;grid-template-columns:1fr 1fr;gap:24px}
  .layout-demo img{display:block;width:100%;border:1px solid var(--rule)}
  .layout-demo .note{font-size:13px;color:var(--soft);grid-column:1/-1;margin-top:8px;line-height:1.6}
  .layout-demo .note strong{color:var(--navy)}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-bottom:28px}
  .photo-card{background:#fff;border:1px solid var(--rule);border-radius:8px;overflow:hidden;cursor:pointer;transition:transform 0.15s,box-shadow 0.15s}
  .photo-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(16,39,66,0.12)}
  .photo-card img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}
  .photo-card .pmeta{padding:10px 12px;font-size:11px}
  .photo-card .ptag{font-size:9px;letter-spacing:0.10em;text-transform:uppercase;color:var(--soft);font-weight:600;background:#f2ebdd;padding:2px 8px;border-radius:99px;display:inline-block;margin-bottom:6px}
  .photo-card .ptitle{font-size:12px;font-weight:600;line-height:1.3;margin-bottom:3px;color:var(--navy)}
  .photo-card .pby{font-size:10px;color:var(--soft);line-height:1.4}
  .copy-list{background:#fff;border:1px solid var(--rule);border-radius:8px;padding:0;list-style:none}
  .copy-list li{padding:12px 18px;border-bottom:1px solid var(--rule);font-size:15px;display:grid;grid-template-columns:48px 1fr auto;gap:18px;align-items:start}
  .copy-list li:last-child{border-bottom:none}
  .copy-list li:hover{background:#fbf7ef}
  .copy-list .num{font-family:'SF Mono','Menlo',monospace;font-size:11px;color:var(--soft);font-weight:600;padding-top:2px}
  .copy-list .ctext{color:var(--navy)}
  .copy-list .cnotes{color:var(--soft);font-size:11px;font-style:italic;text-align:right;max-width:280px}
  .quote-list li{grid-template-columns:48px 1fr}
  .quote-list .who{font-family:'SF Mono','Menlo',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--soft);font-weight:600;margin-top:6px}
  .quote-list .badge{display:inline-block;font-size:9px;padding:2px 8px;border-radius:99px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;margin-right:8px;vertical-align:1px}
  .quote-list .badge.matt{background:#102742;color:#faf8f4}
  .quote-list .badge.team{background:#e8e2d4;color:#102742}
  .instructions{background:#102742;color:#faf8f4;border-radius:10px;padding:24px 28px;margin:0 0 32px;font-size:14px;line-height:1.6}
  .instructions strong{color:#fff}
  .instructions code{background:rgba(250,248,244,0.10);padding:2px 8px;border-radius:4px;font-size:13px;font-family:'SF Mono','Menlo',monospace}
  .reply-fmt{background:rgba(250,248,244,0.06);padding:14px 18px;border-radius:6px;margin-top:14px;font-family:'SF Mono','Menlo',monospace;font-size:13px;line-height:1.7;color:rgba(250,248,244,0.95)}
</style></head>
<body><div class="page">

<h1>Seller-lead ad picker v2</h1>
<p class="lede">Browse photos, copy, and CTAs. Reply with codes. I build the final set from your picks. Layout demo below shows the exact composition — broker bottom-left, headline + trust + sub-CTA + button stacked to the right.</p>

<h2>Layout (locked spec)</h2>
<div class="layout-demo">
  <img src="sample-layout-demo.jpg" alt="Sample layout — Matt variant">
  <img src="sample-layout-demo-team.jpg" alt="Sample layout — team variant">
  <div class="note">
    <strong>Z-pattern layout, research-backed:</strong> brand mark top-left (highest-attention zone), review quote top-right (second scan stop), broker portrait bottom-left at ≤1/3 height (human-face anchor — pattern recognition), headline + trust line + sub-CTA + button stacked in bottom-right 2/3 (CTA destination). Matt’s spec: broker bottom-left, max 1/3 height. Headline = Instrument Serif Italic. Trust line = National Park Bold tracked caps. Sub-CTA = Crimson Italic. Button = clean rectangle, no rounded pill.
  </div>
</div>

<h2>1. Photos</h2>

<h3>Asset library — Bend lifestyle landscapes</h3>
<div class="grid">${photoCards(ASSET_LIBRARY)}</div>

<h3>Schoolhouse Rd — Matt’s actual sold listing (the Ernie Oster transaction)</h3>
<div class="grid">${photoCards(SCHOOLHOUSE)}</div>

<p style="font-size:13px;color:var(--soft);margin-top:-12px;margin-bottom:24px;font-style:italic">Note — these are real interiors and exteriors of a property Matt represented. They give a tangible "this is what we know about Bend homes" register that stock photography can’t match.</p>

<h2>2. Headlines (H) — pick one</h2>
<ol class="copy-list">
${HEADLINES.map((h, i) => `<li><span class="num">H${i + 1}</span><span class="ctext">${h}</span></li>`).join('')}
</ol>

<h2>3. Trust lines / social-proof statements (T) — pick one</h2>
<ol class="copy-list">
${TRUST_LINES.map((t, i) => `<li><span class="num">T${i + 1}</span><span class="ctext">${t}</span></li>`).join('')}
</ol>

<h2>4. Sub-CTA explanation (S) — pick one</h2>
<ol class="copy-list">
${SUB_CTAS.map((s, i) => `<li><span class="num">S${i + 1}</span><span class="ctext">${s}</span></li>`).join('')}
</ol>

<h2>5. Review quotes (Q) — pick the ones you want featured</h2>
<ol class="copy-list quote-list">
${QUOTES.map((q) => `<li><span class="num">${q.code}</span><span class="ctext"><span class="badge ${q.mentions}">${q.mentions === 'matt' ? 'MATT' : 'TEAM'}</span>"${q.text}" <span class="who">— ${q.author}</span></span></li>`).join('')}
</ol>

<h2>6. Button text on the ad (B) — pick one</h2>
<ol class="copy-list">
${BUTTON_VISUAL.map((c) => `<li><span class="num">${c.code}</span><span class="ctext">${c.text}</span><span class="cnotes">${c.notes}</span></li>`).join('')}
</ol>

<h2>7. FB lead-gen button — the actual Meta CTA (F) — pick one</h2>
<ol class="copy-list">
${FB_BUTTONS.map((c) => `<li><span class="num">${c.code}</span><span class="ctext">${c.text} <small style="color:var(--soft);font-family:monospace;margin-left:6px;font-size:11px">${c.meta}</small></span><span class="cnotes">${c.notes}</span></li>`).join('')}
</ol>

<div class="instructions">
  <strong>How to send picks:</strong>
  <div class="reply-fmt">
Photos: A2, SH2, SH4, A1<br>
Headline: H1, H4, H7  ← can pick multiple for rotation<br>
Trust: T1<br>
Sub-CTA: S1<br>
Quotes: Q1, Q2, Q8<br>
Button: B1<br>
FB CTA: F1
  </div>
  <p style="margin-top:14px">If you want different copy per ad in the rotation (e.g. H1 with photo SH2 and H4 with photo A2), just say so. I build whatever combination you want.</p>
</div>

</div></body></html>`

await writeFile(resolve(OUT_DIR, 'picker.html'), pickerHTML, 'utf-8')

console.log(`\nDone.`)
console.log(`  Picker: ${resolve(OUT_DIR, 'picker.html')}`)
console.log(`  Sample (Matt): ${resolve(OUT_DIR, 'sample-layout-demo.jpg')}`)
console.log(`  Sample (Team): ${resolve(OUT_DIR, 'sample-layout-demo-team.jpg')}`)

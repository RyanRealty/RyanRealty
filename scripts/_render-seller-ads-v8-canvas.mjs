#!/usr/bin/env node
/**
 * v8 seller-lead ad — "High Desert Editorial" philosophy.
 *
 * Visual register: Sotheby's International / Wallpaper* magazine spread.
 * One photograph carries the composition. Text is whispered editorial
 * annotation. Broker appears as a framed inset, not a circular badge.
 *
 * Philosophy: out/seller-ad-concepts/v8-canvas/DESIGN_PHILOSOPHY.md
 *
 * Three variants — same architecture, different photograph + different
 * voice from the GBP corpus. All locked to the same restraint.
 */
import { chromium } from 'playwright'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'out/seller-ad-concepts/v8-canvas')
const FONTS = resolve(OUT_DIR, 'fonts')

const FONTS_CSS = `
  @font-face { font-family: 'Crimson Italic'; src: url('${FONTS}/CrimsonPro-Italic.ttf') format('truetype'); font-display: block; }
  @font-face { font-family: 'Instrument Serif Italic'; src: url('${FONTS}/InstrumentSerif-Italic.ttf') format('truetype'); font-display: block; }
  @font-face { font-family: 'Instrument Serif'; src: url('${FONTS}/InstrumentSerif-Regular.ttf') format('truetype'); font-display: block; }
  @font-face { font-family: 'National Park'; src: url('${FONTS}/NationalPark-Regular.ttf') format('truetype'); font-display: block; }
  @font-face { font-family: 'National Park Bold'; src: url('${FONTS}/NationalPark-Bold.ttf') format('truetype'); font-display: block; }
  @font-face { font-family: 'Italiana'; src: url('${FONTS}/Italiana-Regular.ttf') format('truetype'); font-display: block; }
`

const MATT = `${ROOT}/design_system/ryan-realty/assets/team/matt-ryan.png`
const TEAM = `${ROOT}/design_system/ryan-realty/assets/team/team-transparent.png`

const VARIANTS = [
  {
    slug: '01-pronghorn-ernie',
    photo: `${ROOT}/public/lp/tetherow/img/tetherow-course-118.jpg`,
    photoFocus: 'center 55%',
    portraitFile: MATT,
    portraitFocus: 'center 32%',
    headline: ['Are you considering', 'making a move?'],
    quote: 'Attention to detail and art of the negotiations with data.',
    reviewer: 'Ernie Oster',
    reviewerMeta: 'Google review · May 2026',
    portraitLabel: 'Matt Ryan',
    portraitTitle: 'Principal Broker',
    issueRef: 'No. 24',
    issueLabel: 'Twenty-four five-star reviews',
    cta: 'Begin the conversation.',
  },
  {
    slug: '02-old-mill-douglas',
    photo: `${ROOT}/design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg`,
    photoFocus: 'center 38%',
    portraitFile: TEAM,
    portraitFocus: 'center top',
    portraitWide: true,
    headline: ['What does your next', 'chapter look like?'],
    quote: 'I highly recommend Ryan Realty for both buying and selling.',
    reviewer: 'Doug Millard',
    reviewerMeta: 'Google review',
    portraitLabel: 'Ryan Realty',
    portraitTitle: 'Bend, Oregon',
    issueRef: 'Est. 2023',
    issueLabel: 'Bend · Oregon',
    cta: 'Begin the conversation.',
  },
  {
    slug: '03-three-sisters-douglas-grant',
    photo: `${ROOT}/out/design-recon/fb-lead-gen-ad/examples/0001.jpg`,
    photoFocus: 'center 50%',
    portraitFile: MATT,
    portraitFocus: 'center 30%',
    headline: ['Is selling', 'in your future?'],
    quote: 'The most professional, communicative, and honest broker I have ever worked with.',
    reviewer: 'Douglas Grant',
    reviewerMeta: 'Google review · February 2026',
    portraitLabel: 'Matt Ryan',
    portraitTitle: 'Principal Broker',
    issueRef: 'No. 24',
    issueLabel: 'Five stars · twenty-four reviews',
    cta: 'Begin the conversation.',
  },
]

function html(v) {
  const portraitW = v.portraitWide ? 260 : 158
  const portraitH = v.portraitWide ? 156 : 200

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONTS_CSS}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:1080px;height:1080px;overflow:hidden;background:#0a0d12;color:#faf6ec;font-family:'National Park',sans-serif;position:relative;font-feature-settings:"liga","kern"}

    /* Photograph — full bleed, the composition itself */
    .photo{position:absolute;inset:0;background:url('file://${v.photo}') ${v.photoFocus}/cover no-repeat;z-index:1}

    /* Subtle editorial vignette — top-left and bottom shaded for text */
    .vignette-tl{position:absolute;inset:0;background:radial-gradient(ellipse at 0% 0%,rgba(10,13,18,0.62) 0%,rgba(10,13,18,0.32) 30%,rgba(10,13,18,0) 60%);z-index:2;mix-blend-mode:multiply}
    .vignette-bl{position:absolute;left:0;right:0;bottom:0;height:60%;background:linear-gradient(180deg,rgba(10,13,18,0) 0%,rgba(10,13,18,0.18) 45%,rgba(10,13,18,0.68) 100%);z-index:2}

    /* Top-left editorial slug — masthead-style */
    .masthead{position:absolute;top:54px;left:64px;z-index:6;display:flex;align-items:baseline;gap:18px}
    .masthead .mark{font-family:'Italiana',serif;font-size:34px;letter-spacing:0.005em;color:#faf6ec;line-height:1}
    .masthead .rule{width:60px;height:1px;background:rgba(250,246,236,0.55)}
    .masthead .issue{font-family:'National Park',sans-serif;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:rgba(250,246,236,0.78);font-weight:400;line-height:1}

    .place{position:absolute;top:96px;left:64px;font-family:'National Park',sans-serif;font-size:10px;letter-spacing:0.34em;text-transform:uppercase;color:rgba(250,246,236,0.55);z-index:6}

    /* Headline — italic editorial serif, two lines, lower portion */
    .headline{position:absolute;left:64px;right:64px;top:540px;z-index:5}
    .headline span{display:block;font-family:'Instrument Serif Italic',serif;font-size:88px;line-height:0.95;color:#faf6ec;letter-spacing:-0.018em;text-shadow:0 2px 22px rgba(0,0,0,0.45)}
    .headline span:first-child{margin-bottom:2px}

    /* Quote — italic serif, smaller, beneath headline */
    .quote-line{position:absolute;left:64px;right:380px;top:768px;z-index:5;font-family:'Crimson Italic',serif;font-size:22px;line-height:1.32;color:rgba(250,246,236,0.88);letter-spacing:-0.005em;text-shadow:0 2px 14px rgba(0,0,0,0.5)}
    .quote-attr{position:absolute;left:64px;top:838px;z-index:5;font-family:'National Park',sans-serif;font-size:10px;letter-spacing:0.34em;text-transform:uppercase;color:rgba(250,246,236,0.62);font-weight:400}
    .quote-attr .name{color:rgba(250,246,236,0.92);font-weight:700}

    /* CTA — single italic line, no button */
    .cta{position:absolute;left:64px;bottom:64px;z-index:6;display:flex;align-items:baseline;gap:14px}
    .cta-text{font-family:'Instrument Serif Italic',serif;font-size:28px;color:#faf6ec;letter-spacing:-0.005em;text-shadow:0 2px 14px rgba(0,0,0,0.5)}
    .cta-arrow{font-family:'Instrument Serif',serif;font-size:28px;color:rgba(250,246,236,0.7);text-shadow:0 2px 14px rgba(0,0,0,0.5)}

    /* Editorial portrait inset — framed, bottom-right, like a byline */
    .portrait-wrap{position:absolute;right:64px;bottom:64px;z-index:6;display:flex;flex-direction:column;align-items:center}
    .portrait{width:${portraitW}px;height:${portraitH}px;background:url('file://${v.portraitFile}') ${v.portraitFocus}/cover no-repeat;border:1px solid rgba(250,246,236,0.40);padding:0;position:relative}
    .portrait::before{content:'';position:absolute;inset:6px;border:1px solid rgba(250,246,236,0.18);pointer-events:none}
    .portrait-label{margin-top:14px;font-family:'National Park Bold',sans-serif;font-size:11px;letter-spacing:0.20em;text-transform:uppercase;color:rgba(250,246,236,0.92);text-align:center;line-height:1.4}
    .portrait-title{font-family:'National Park',sans-serif;font-size:9px;letter-spacing:0.30em;text-transform:uppercase;color:rgba(250,246,236,0.62);text-align:center;margin-top:3px}

    /* Faint hairline cross — bottom-left framing detail */
    .hair-h{position:absolute;left:64px;top:528px;width:120px;height:1px;background:rgba(250,246,236,0.50);z-index:5}
  </style></head><body>
    <div class="photo"></div>
    <div class="vignette-tl"></div>
    <div class="vignette-bl"></div>

    <div class="masthead">
      <span class="mark">Ryan Realty</span>
      <span class="rule"></span>
      <span class="issue">${v.issueRef}</span>
    </div>
    <div class="place">${v.issueLabel}</div>

    <div class="hair-h"></div>
    <div class="headline"><span>${v.headline[0]}</span><span>${v.headline[1]}</span></div>

    <div class="quote-line">"${v.quote}"</div>
    <div class="quote-attr"><span class="name">${v.reviewer}</span> · ${v.reviewerMeta}</div>

    <div class="cta"><span class="cta-text">${v.cta}</span><span class="cta-arrow">→</span></div>

    <div class="portrait-wrap">
      <div class="portrait"></div>
      <div class="portrait-label">${v.portraitLabel}</div>
      <div class="portrait-title">${v.portraitTitle}</div>
    </div>
  </body></html>`
}

await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

const results = []
for (let i = 0; i < VARIANTS.length; i++) {
  const v = VARIANTS[i]
  const htmlPath = resolve(OUT_DIR, `seller-v8-${v.slug}.html`)
  const jpgPath = resolve(OUT_DIR, `seller-v8-${v.slug}.jpg`)
  const pngPath = resolve(OUT_DIR, `seller-v8-${v.slug}.png`)
  await writeFile(htmlPath, html(v), 'utf-8')
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: pngPath, type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1080 } })
  await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 94, clip: { x: 0, y: 0, width: 1080, height: 1080 } })
  console.log(`  ${i + 1}/${VARIANTS.length}  ${v.slug}`)
  results.push({ ...v, jpgPath: `seller-v8-${v.slug}.jpg`, pngPath: `seller-v8-${v.slug}.png` })
}

await browser.close()

const sheet = `<!doctype html><html><head><meta charset="utf-8"><title>v8 — High Desert Editorial</title>
<style>
  body{font-family:Georgia,serif;background:#0a0d12;color:#faf6ec;margin:0;padding:48px}
  h1{font-family:Georgia,serif;font-style:italic;font-size:36px;font-weight:400;margin:0 0 8px;letter-spacing:-0.01em}
  p.lede{color:rgba(250,246,236,0.65);margin:0 0 8px;max-width:920px;line-height:1.55;font-size:15px;font-style:italic}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:32px;max-width:1480px;margin:32px auto 0}
  .card{background:rgba(255,255,255,0.03);border:1px solid rgba(250,246,236,0.18);overflow:hidden}
  .card img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover}
  .meta{padding:18px 22px;font-size:12px;color:rgba(250,246,236,0.7);letter-spacing:0.05em;text-transform:uppercase}
</style></head><body>
<h1>High Desert Editorial</h1>
<p class="lede">A design philosophy that refuses the visual language of the category it lives in. The photograph carries the composition. Typography is restraint. The work appears found, not made.</p>
<div class="grid">
${results.map((r, i) => `<div class="card">
  <a href="${r.jpgPath}" target="_blank"><img src="${r.jpgPath}" alt="${r.headline.join(' ')}"></a>
  <div class="meta">${String(i + 1).padStart(2, '0')} · ${r.slug}</div>
</div>`).join('\n')}
</div>
</body></html>`

await writeFile(resolve(OUT_DIR, 'v8-canvas-contact-sheet.html'), sheet, 'utf-8')

console.log(`\nDone. Sheet: ${resolve(OUT_DIR, 'v8-canvas-contact-sheet.html')}`)

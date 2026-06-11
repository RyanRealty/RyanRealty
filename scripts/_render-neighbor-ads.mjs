#!/usr/bin/env node
/**
 * Render N "your neighbor" ad variants from a property list.
 * Each variant: 1080x1080 JPG with brand-fonts overlay on a westside photo.
 *
 * Usage: node scripts/_render-neighbor-ads.mjs
 */
import { chromium } from 'playwright'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'out/seller-ad-concepts')

// Westside Bend photos. Each property gets assigned one of these by index mod 3.
// hero-awbrey-clean = modern westside home dusk (dark moody)
// tetherow-aerial-course = pristine westside drone, Cascade horizon
// banner-2048x1152-youtube = Old Mill brand hero (lighter, brand-recognizable)
const PHOTOS = [
  'public/mockup-preview/assets/hero-awbrey-clean.jpg',
  'public/lp/tetherow/img/tetherow-aerial-course.jpg',
  'design_system/ryan-realty/assets/hero/banner-2048x1152-youtube.jpg',
]

// 10 westside closes from the last 30 days (Supabase verified 2026-05-27).
// price is rounded to nearest thousand for display.
const PROPERTIES = [
  { neighborhood: 'Awbrey Butte',     street: 'Okane',          price: 2100000, question: 'Curious what yours would bring?'                  , photo: 0 },
  { neighborhood: 'Awbrey Butte',     street: 'Summit',         price: 1600000, question: 'Does that change your home value?'                , photo: 1 },
  { neighborhood: 'Awbrey Village',   street: 'Constellation',  price: 1625000, question: 'Think yours could beat that?'                     , photo: 2 },
  { neighborhood: 'Awbrey Glen',      street: 'Kidd',           price: 1450000, question: 'If you sold today, where could you move next?'    , photo: 0 },
  { neighborhood: 'Tetherow',         street: 'Weinhard',       price: 2700000, question: 'Curious what yours would bring?'                  , photo: 1 },
  { neighborhood: 'Shevlin Ridge',    street: 'Morningwood',    price: 1475000, question: 'What is selling on your block?'                   , photo: 2 },
  { neighborhood: 'Broken Top',       street: 'Green Lakes',    price: 1500000, question: 'Tap to see your recent comps.'                    , photo: 0 },
  { neighborhood: 'Discovery West',   street: 'Leavitt',        price: 1569000, question: 'What did the home down the street sell for?'      , photo: 1 },
  { neighborhood: 'Bend North Rim',   street: 'Puccoon',        price: 2570000, question: 'Curious what yours would bring?'                  , photo: 2 },
  { neighborhood: 'Skyliner Summit',  street: 'Skyliner Summit',price: 2200000, question: 'Want to know what your block is doing?'           , photo: 0 },
]

function priceText(n) {
  return '$' + n.toLocaleString('en-US')
}

function htmlTemplate(prop, photoPath) {
  // Choose headline font size based on length so all variants fit cleanly
  const headlineLength = `A home on ${prop.street} just sold for ${priceText(prop.price)}.`.length
  const headlineSize = headlineLength > 60 ? 76 : headlineLength > 50 ? 84 : 92
  const questionSize = prop.question.length > 50 ? 26 : 30

  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @font-face { font-family: 'Amboqia'; src: url('${ROOT}/design_system/ryan-realty/fonts/Amboqia_Boriango.otf') format('opentype'); font-display: block; }
  @font-face { font-family: 'Azo Sans'; src: url('${ROOT}/design_system/ryan-realty/fonts/AzoSans-Medium.ttf') format('truetype'); font-display: block; }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1080px;height:1080px;overflow:hidden;font-family:'Azo Sans',sans-serif;background:#102742;color:#faf8f4;position:relative}
  .photo{position:absolute;inset:0;background:url('file://${ROOT}/${photoPath}') center/cover no-repeat;z-index:1}
  .scrim{position:absolute;left:0;right:0;bottom:0;height:62%;background:linear-gradient(180deg,rgba(16,39,66,0) 0%,rgba(16,39,66,0.58) 28%,rgba(16,39,66,0.9) 62%,rgba(16,39,66,0.96) 100%);z-index:2}
  .content{position:absolute;left:0;right:0;bottom:0;padding:60px 80px 80px;z-index:3}
  .neighborhood{font-size:22px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(250,248,244,0.82);margin-bottom:22px}
  .headline{font-family:'Amboqia',serif;font-size:${headlineSize}px;line-height:1.04;color:#faf8f4;margin-bottom:30px;letter-spacing:-0.01em}
  .price{white-space:nowrap}
  .question{font-size:${questionSize}px;line-height:1.35;color:rgba(250,248,244,0.92);font-weight:500}
  .disclosure{position:absolute;right:36px;bottom:28px;font-size:13px;color:rgba(250,248,244,0.55);letter-spacing:0.04em;z-index:4}
  .brand{position:absolute;top:56px;left:80px;z-index:4;font-family:'Amboqia',serif;font-size:28px;color:#faf8f4;letter-spacing:0.04em;text-shadow:0 2px 12px rgba(0,0,0,0.4)}
</style></head>
<body>
  <div class="photo"></div>
  <div class="scrim"></div>
  <div class="brand">Ryan Realty</div>
  <div class="content">
    <div class="neighborhood">${prop.neighborhood} · Bend, Oregon</div>
    <div class="headline">A home on ${prop.street} just sold for <span class="price">${priceText(prop.price)}</span>.</div>
    <div class="question">${prop.question}</div>
  </div>
  <div class="disclosure">Public ORMLS closed-sale data</div>
</body></html>`
}

await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

const results = []
for (let i = 0; i < PROPERTIES.length; i++) {
  const prop = PROPERTIES[i]
  const photo = PHOTOS[prop.photo]
  const slug = `ad-${String(i + 1).padStart(2, '0')}-${prop.neighborhood.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${prop.street.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const htmlPath = resolve(OUT_DIR, `${slug}.html`)
  const jpgPath = resolve(OUT_DIR, `${slug}.jpg`)
  await writeFile(htmlPath, htmlTemplate(prop, photo), 'utf-8')
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 92, fullPage: false, clip: { x: 0, y: 0, width: 1080, height: 1080 } })
  console.log(`  ${i + 1}/10  ${slug}`)
  results.push({ slug, prop, photo })
}

await browser.close()

// Build a contact-sheet HTML for review
const sheet = `<!doctype html>
<html><head><meta charset="utf-8"><title>10 Westside Seller Ads</title>
<style>
  body{font-family:-apple-system,sans-serif;background:#faf8f4;color:#102742;margin:0;padding:32px}
  h1{margin:0 0 6px}
  p.lede{color:#5b6478;margin:0 0 28px;max-width:880px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:24px;max-width:1480px;margin:0 auto}
  .card{background:#fff;border:1px solid rgba(16,39,66,0.12);border-radius:14px;overflow:hidden}
  .card img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover}
  .meta{padding:14px 18px;font-size:13px}
  .meta .n{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#5b6478;margin-bottom:4px}
  .meta .h{font-weight:600;color:#102742;margin-bottom:4px}
  .meta .q{color:#5b6478}
</style></head><body>
<h1>10 westside seller-ad variants</h1>
<p class="lede">All "your neighbor sold for $X" pattern (TJ Kelly framework). Each verified from Supabase closed-sale data, last 30 days. Westside photos rotated. Brand-voice clean, zero "we" language. Click any image to open at full resolution.</p>
<div class="grid">
${results.map((r, i) => `<div class="card">
  <a href="${r.slug}.jpg" target="_blank"><img src="${r.slug}.jpg" alt="Ad ${i + 1}"></a>
  <div class="meta">
    <div class="n">Ad ${String(i + 1).padStart(2, '0')} · ${r.prop.neighborhood}</div>
    <div class="h">A home on ${r.prop.street} sold for ${priceText(r.prop.price)}.</div>
    <div class="q">${r.prop.question}</div>
  </div>
</div>`).join('\n')}
</div>
</body></html>`
await writeFile(resolve(OUT_DIR, 'contact-sheet-v2.html'), sheet, 'utf-8')

console.log(`\nDone. Contact sheet: ${resolve(OUT_DIR, 'contact-sheet-v2.html')}`)

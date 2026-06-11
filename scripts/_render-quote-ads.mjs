#!/usr/bin/env node
/**
 * Render 5 quote-led seller ads.
 * Real Google reviews as headlines + market-data body + restrained brand mark.
 * Each = 1080x1080 JPG written to out/seller-ad-concepts/quote-ad-{slug}.jpg
 */
import { chromium } from 'playwright'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'out/seller-ad-concepts')

const FONTS_CSS = `
  @font-face { font-family: 'Amboqia'; src: url('${ROOT}/design_system/ryan-realty/fonts/Amboqia_Boriango.otf') format('opentype'); font-display: block; }
  @font-face { font-family: 'Azo Sans'; src: url('${ROOT}/design_system/ryan-realty/fonts/AzoSans-Medium.ttf') format('truetype'); font-display: block; }
`

const ADS = [
  {
    slug: 'helen-peer-broker',
    style: 'text-cream',
    quote: `"I'm a Realtor Broker with 23 years of full-time service of my own. I know what it takes to be a top-notch professional Realtor. Bravo Matt."`,
    attribution: 'Helen Luna Fess · verified Google review',
    body: `Bend single-family market, May 2026. 165 closed sales last 30 days. Median $705,000. Median 47 days on market.`,
    footer: 'Full quarterly report, free below',
  },
  {
    slug: 'david-rent-vs-sell',
    style: 'text-cream-data',
    quote: `"We worked with Matt over a long time deciding to rent or sell. Matt provided information for both options. Even after we chose to rent, Matt continued to work for us."`,
    attribution: 'David Town · verified Google review',
    body: `Bend SFR market, 90 days. 533 closed sales. Median DOM 47. Active inventory: 984. Pending: 190.`,
    footer: 'Full data set, free below',
  },
  {
    slug: 'gary-low-pressure',
    style: 'photo-tetherow',
    quote: `"Patient, low pressure with us, and provided expert guidance. We would not hesitate to recommend or use Matt's services again."`,
    attribution: 'Gary Timms · verified Google review',
    body: `West Bend (97703) closes above $1.5M last 30 days: 16. Above $2.5M: 3.`,
    footer: 'Full breakdown by address and DOM',
  },
  {
    slug: 'audra-tough-market',
    style: 'photo-tetherow',
    quote: `"In a tough market, Matt sold our home faster than we expected."`,
    attribution: 'Audra Hedberg · verified Google review',
    body: `Bend median time on market is 47 days. The patterns by neighborhood are not what most expect.`,
    footer: 'Full report by zip, free below',
  },
  {
    slug: 'stephen-out-of-state',
    style: 'photo-tetherow',
    quote: `"Matt was responsive, professional, and above all, a trustworthy person. He helped us jump through the various hoops it takes to buy a house from out-of-state."`,
    attribution: 'Stephen Graham · verified Google review',
    body: `Roughly 1,600 of 9,000 Bend single-family owners live out of state.`,
    footer: 'Bend market report, by zip, free below',
  },
]

function html(ad) {
  const photoPath = `${ROOT}/public/lp/tetherow/img/tetherow-aerial-course.jpg`

  // Auto-shrink the quote font size based on length so it fits cleanly
  const len = ad.quote.length
  const quoteSize = len > 280 ? 40 : len > 220 ? 46 : len > 170 ? 52 : len > 120 ? 60 : 70

  if (ad.style === 'text-cream' || ad.style === 'text-cream-data') {
    // Restrained, text-led, cream background, Mayer Brown / Chambers USA voice.
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      ${FONTS_CSS}
      *{box-sizing:border-box;margin:0;padding:0}
      html,body{width:1080px;height:1080px;overflow:hidden;background:#faf8f4;color:#102742;font-family:'Azo Sans',sans-serif;position:relative}
      .frame{position:absolute;inset:60px 80px;display:flex;flex-direction:column}
      .brand{font-family:'Amboqia',serif;font-size:24px;letter-spacing:0.04em;color:#102742;margin-bottom:48px}
      .quote-block{flex:1;display:flex;align-items:center}
      .quote{font-family:'Amboqia',serif;font-size:${quoteSize}px;line-height:1.18;color:#102742;letter-spacing:-0.005em}
      .attribution{font-size:18px;letter-spacing:0.06em;color:rgba(16,39,66,0.62);text-transform:uppercase;margin-top:36px}
      .divider{height:1px;background:rgba(16,39,66,0.18);margin:36px 0 28px}
      .body{font-size:22px;line-height:1.5;color:rgba(16,39,66,0.88);font-weight:500}
      .footer{font-size:16px;letter-spacing:0.06em;color:rgba(16,39,66,0.55);text-transform:uppercase;margin-top:14px}
    </style></head><body>
      <div class="frame">
        <div class="brand">Ryan Realty · Bend, Oregon</div>
        <div class="quote-block">
          <div>
            <div class="quote">${ad.quote}</div>
            <div class="attribution">${ad.attribution}</div>
          </div>
        </div>
        <div class="divider"></div>
        <div class="body">${ad.body}</div>
        <div class="footer">${ad.footer}</div>
      </div>
    </body></html>`
  }

  // photo-tetherow: quote bottom over scrim, hero photo top
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONTS_CSS}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:1080px;height:1080px;overflow:hidden;background:#102742;color:#faf8f4;font-family:'Azo Sans',sans-serif;position:relative}
    .photo{position:absolute;inset:0;background:url('file://${photoPath}') center 30%/cover no-repeat;z-index:1}
    .scrim{position:absolute;left:0;right:0;bottom:0;height:72%;background:linear-gradient(180deg,rgba(16,39,66,0) 0%,rgba(16,39,66,0.5) 22%,rgba(16,39,66,0.92) 58%,rgba(16,39,66,0.97) 100%);z-index:2}
    .brand{position:absolute;top:56px;left:80px;z-index:4;font-family:'Amboqia',serif;font-size:26px;color:#faf8f4;letter-spacing:0.04em;text-shadow:0 2px 12px rgba(0,0,0,0.4)}
    .content{position:absolute;left:80px;right:80px;bottom:0;padding-bottom:80px;z-index:3}
    .quote{font-family:'Amboqia',serif;font-size:${quoteSize}px;line-height:1.16;color:#faf8f4;letter-spacing:-0.005em;margin-bottom:28px}
    .attribution{font-size:16px;letter-spacing:0.08em;color:rgba(250,248,244,0.7);text-transform:uppercase;margin-bottom:24px}
    .divider{height:1px;background:rgba(250,248,244,0.22);margin-bottom:20px}
    .body{font-size:20px;line-height:1.45;color:rgba(250,248,244,0.92);font-weight:500;margin-bottom:8px}
    .footer{font-size:14px;letter-spacing:0.08em;color:rgba(250,248,244,0.55);text-transform:uppercase}
  </style></head><body>
    <div class="photo"></div>
    <div class="scrim"></div>
    <div class="brand">Ryan Realty · Bend, Oregon</div>
    <div class="content">
      <div class="quote">${ad.quote}</div>
      <div class="attribution">${ad.attribution}</div>
      <div class="divider"></div>
      <div class="body">${ad.body}</div>
      <div class="footer">${ad.footer}</div>
    </div>
  </body></html>`
}

await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

const results = []
for (let i = 0; i < ADS.length; i++) {
  const ad = ADS[i]
  const htmlPath = resolve(OUT_DIR, `quote-ad-${ad.slug}.html`)
  const jpgPath = resolve(OUT_DIR, `quote-ad-${ad.slug}.jpg`)
  await writeFile(htmlPath, html(ad), 'utf-8')
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1080, height: 1080 } })
  console.log(`  ${i + 1}/${ADS.length}  ${ad.slug}`)
  results.push({ ...ad, jpgPath: `quote-ad-${ad.slug}.jpg` })
}

await browser.close()

// Contact sheet
const sheet = `<!doctype html><html><head><meta charset="utf-8"><title>5 Quote-Led Ads</title>
<style>
  body{font-family:-apple-system,sans-serif;background:#faf8f4;color:#102742;margin:0;padding:32px}
  h1{margin:0 0 6px;font-size:24px}
  p.lede{color:#5b6478;margin:0 0 24px;max-width:880px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:24px;max-width:1480px;margin:0 auto}
  .card{background:#fff;border:1px solid rgba(16,39,66,0.12);border-radius:14px;overflow:hidden}
  .card img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover}
  .meta{padding:16px 18px;font-size:13px}
  .meta .n{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#5b6478;margin-bottom:6px}
  .meta .h{font-weight:600;color:#102742;font-size:14px}
</style></head><body>
<h1>5 quote-led seller ads</h1>
<p class="lede">Real Google reviews as headlines, real Bend market data as body, restrained brand mark. Zero self-claims, zero age mentions, zero marketing-formula fluff. Mayer Brown / Chambers USA model.</p>
<div class="grid">
${results.map((r, i) => `<div class="card">
  <a href="${r.jpgPath}" target="_blank"><img src="${r.jpgPath}" alt="Ad ${i + 1}"></a>
  <div class="meta">
    <div class="n">${i + 1} · ${r.style === 'text-cream' || r.style === 'text-cream-data' ? 'Text-led (cream)' : 'Photo-led (Tetherow)'} · ${r.attribution.split(' · ')[0]}</div>
  </div>
</div>`).join('\n')}
</div>
</body></html>`
await writeFile(resolve(OUT_DIR, 'quote-ads-contact-sheet.html'), sheet, 'utf-8')

console.log(`\nDone. Contact sheet: ${resolve(OUT_DIR, 'quote-ads-contact-sheet.html')}`)

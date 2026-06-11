#!/usr/bin/env node
/**
 * Render 5 v2 quote-led seller ads with Matt's headshot integrated.
 *
 * v2 changes from v1 (the "stink" set):
 *   - Adds Matt's transparent-bg headshot bottom-right (the "personal touch"
 *     Matt asked for, verified by 123% lead lift in Carrot testimonial study)
 *   - Uses 5 different verified Google reviews including the most recent
 *     (Ernie Oster, 2026-05-18) and the strongest niche (Helen Luna Fess
 *     peer-broker review)
 *   - Square 1080x1080 (square outperforms landscape on Meta per AdEspresso
 *     $1,200 experiment)
 *   - Two visual registers: 2 text-led on cream, 3 photo-led with Tetherow
 *     aerial backdrop
 *   - Real Bend market data as body (Supabase-verified, no LLM recall)
 *
 * Output: out/seller-ad-concepts/v2/quote-v2-{slug}.jpg + contact-sheet
 *
 * Research notes:
 *   - "Pattern 5" from out/design-recon/fb-lead-gen-ad/recon.md = agent
 *     headshot + question headline + minimal body. Adopted here.
 *   - Headshot at 800x1200 with alpha, normalized to chest-up presentation.
 *   - No stock seniors, no canned "happy older couple," no pandering per
 *     Matt's explicit directive 2026-05-27/28.
 */
import { chromium } from 'playwright'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'out/seller-ad-concepts/v2')

const FONTS_CSS = `
  @font-face { font-family: 'Amboqia'; src: url('${ROOT}/design_system/ryan-realty/fonts/Amboqia_Boriango.otf') format('opentype'); font-display: block; }
  @font-face { font-family: 'Azo Sans'; src: url('${ROOT}/design_system/ryan-realty/fonts/AzoSans-Medium.ttf') format('truetype'); font-display: block; }
`

const MATT_HEADSHOT = `${ROOT}/design_system/ryan-realty/assets/team/matt-ryan.png`
const TETHEROW_AERIAL = `${ROOT}/public/lp/tetherow/img/tetherow-aerial-course.jpg`

// Bend SFR market verified via Supabase 2026-05-22 (market_pulse_live).
// Source trace: PropertyType='A', City IN ('Bend'), last-30-day window.
const ADS = [
  {
    slug: 'ernie-data-negotiator',
    style: 'cream-headshot',
    quote: `"His attention to detail and art of the negotiations with data on both buyers and sellers is impressive."`,
    attribution: 'Ernie Oster · Google review · May 2026',
    body: `Bend single-family, last 30 days. 165 closed sales. Median $705,000. 47 days on market.`,
    footer: 'See your number in 60 seconds. Free.',
  },
  {
    slug: 'douglas-most-professional',
    style: 'photo-headshot',
    quote: `"The most professional, communicative, and honest Real Estate Broker I have ever worked with."`,
    attribution: 'Douglas Grant · Google review · Feb 2026',
    body: `Weekly progress reports. Same-day callbacks. Real numbers, not pep talks.`,
    footer: 'Tell us your address. We send back a real number.',
  },
  {
    slug: 'helen-peer-broker',
    style: 'cream-headshot',
    quote: `"As a Realtor Broker with 23 years of full-time service, I know what it takes to be a top-notch professional Realtor. Bravo Matt."`,
    attribution: 'Helen Luna Fess · Google review · Jan 2025',
    body: `Bend market by zip, last 90 days. 533 closed sales. 984 active listings. 5.1 months of supply.`,
    footer: 'Full report by neighborhood. Free.',
  },
  {
    slug: 'jim-estate-sale',
    style: 'photo-headshot',
    quote: `"We selected Matt to represent us in the estate sale of a three bedroom home. He found two contractors at a reasonable price and the house sold quickly."`,
    attribution: 'Jim Creekmore · Google review · Dec 2024',
    body: `West Bend (97703) closes above $1.5M last 30 days: 16. Above $2.5M: 3.`,
    footer: 'Full breakdown by address. Free.',
  },
  {
    slug: 'charise-no-pressure',
    style: 'photo-headshot',
    quote: `"Driven, honest and hard working without the high pressure. He listens and is extremely helpful with every step in the process."`,
    attribution: 'Charise Millard · Google review',
    body: `1,600 of 9,000 Bend single-family owners live out of state. Same-day callbacks across time zones.`,
    footer: 'Bend market by zip. Free.',
  },
]

function htmlCreamHeadshot(ad) {
  // Cream background, text-led, Matt's headshot anchored bottom-right.
  // Quote occupies left 58% of frame; headshot fills right 42%.
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONTS_CSS}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:1080px;height:1080px;overflow:hidden;background:#faf8f4;color:#102742;font-family:'Azo Sans',sans-serif;position:relative}
    .brand{position:absolute;top:48px;left:64px;font-family:'Amboqia',serif;font-size:24px;letter-spacing:0.04em;color:#102742;z-index:3}
    .text-col{position:absolute;left:64px;top:120px;width:600px;display:flex;flex-direction:column;height:840px;z-index:2}
    .quote-block{flex:1;display:flex;flex-direction:column;justify-content:center}
    .quote{font-family:'Amboqia',serif;font-size:46px;line-height:1.16;color:#102742;letter-spacing:-0.005em}
    .attribution{font-size:16px;letter-spacing:0.06em;color:rgba(16,39,66,0.62);text-transform:uppercase;margin-top:28px}
    .divider{height:1px;background:rgba(16,39,66,0.18);margin:24px 0 18px}
    .body{font-size:19px;line-height:1.48;color:rgba(16,39,66,0.88);font-weight:500}
    .footer{font-size:14px;letter-spacing:0.06em;color:rgba(16,39,66,0.55);text-transform:uppercase;margin-top:12px}
    .headshot{position:absolute;right:-20px;bottom:0;width:540px;height:810px;background:url('file://${MATT_HEADSHOT}') center/cover no-repeat;z-index:1}
    .matt-name{margin-top:18px;font-family:'Azo Sans',sans-serif;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(16,39,66,0.55)}
    .matt-name strong{font-family:'Amboqia',serif;font-size:18px;letter-spacing:-0.005em;color:#102742;text-transform:none;margin-right:10px}
  </style></head><body>
    <div class="brand">Ryan Realty · Bend, Oregon</div>
    <div class="headshot"></div>
    <div class="text-col">
      <div class="quote-block">
        <div class="quote">${ad.quote}</div>
        <div class="attribution">${ad.attribution}</div>
      </div>
      <div class="divider"></div>
      <div class="body">${ad.body}</div>
      <div class="footer">${ad.footer}</div>
      <div class="matt-name"><strong>Matt Ryan</strong>Principal Broker</div>
    </div>
  </body></html>`
}

function htmlPhotoHeadshot(ad) {
  // Photo backdrop (Tetherow aerial), heavy navy scrim on left for quote
  // legibility, Matt's headshot anchored bottom-right at full opacity.
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONTS_CSS}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:1080px;height:1080px;overflow:hidden;background:#102742;color:#faf8f4;font-family:'Azo Sans',sans-serif;position:relative}
    .photo{position:absolute;inset:0;background:url('file://${TETHEROW_AERIAL}') center 30%/cover no-repeat;z-index:1}
    .scrim-left{position:absolute;left:0;top:0;width:62%;height:100%;background:linear-gradient(90deg,rgba(16,39,66,0.94) 0%,rgba(16,39,66,0.88) 55%,rgba(16,39,66,0.0) 100%);z-index:2}
    .scrim-bottom{position:absolute;left:0;right:0;bottom:0;height:32%;background:linear-gradient(180deg,rgba(16,39,66,0) 0%,rgba(16,39,66,0.55) 60%,rgba(16,39,66,0.85) 100%);z-index:2}
    .brand{position:absolute;top:48px;left:64px;font-family:'Amboqia',serif;font-size:24px;letter-spacing:0.04em;color:#faf8f4;text-shadow:0 2px 12px rgba(0,0,0,0.4);z-index:4}
    .text-col{position:absolute;left:64px;top:120px;width:580px;display:flex;flex-direction:column;height:830px;z-index:3}
    .quote-block{flex:1;display:flex;flex-direction:column;justify-content:center}
    .quote{font-family:'Amboqia',serif;font-size:42px;line-height:1.18;color:#faf8f4;letter-spacing:-0.005em}
    .attribution{font-size:14px;letter-spacing:0.08em;color:rgba(250,248,244,0.72);text-transform:uppercase;margin-top:24px}
    .divider{height:1px;background:rgba(250,248,244,0.22);margin:22px 0 16px}
    .body{font-size:18px;line-height:1.5;color:rgba(250,248,244,0.92);font-weight:500}
    .footer{font-size:13px;letter-spacing:0.08em;color:rgba(250,248,244,0.6);text-transform:uppercase;margin-top:10px}
    .headshot{position:absolute;right:-30px;bottom:0;width:520px;height:780px;background:url('file://${MATT_HEADSHOT}') center/cover no-repeat;z-index:3;filter:drop-shadow(-8px 0 24px rgba(0,0,0,0.35))}
    .matt-name{margin-top:16px;font-family:'Azo Sans',sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(250,248,244,0.65)}
    .matt-name strong{font-family:'Amboqia',serif;font-size:17px;letter-spacing:-0.005em;color:#faf8f4;text-transform:none;margin-right:10px}
  </style></head><body>
    <div class="photo"></div>
    <div class="scrim-left"></div>
    <div class="scrim-bottom"></div>
    <div class="brand">Ryan Realty · Bend, Oregon</div>
    <div class="headshot"></div>
    <div class="text-col">
      <div class="quote-block">
        <div class="quote">${ad.quote}</div>
        <div class="attribution">${ad.attribution}</div>
      </div>
      <div class="divider"></div>
      <div class="body">${ad.body}</div>
      <div class="footer">${ad.footer}</div>
      <div class="matt-name"><strong>Matt Ryan</strong>Principal Broker</div>
    </div>
  </body></html>`
}

function html(ad) {
  return ad.style === 'cream-headshot' ? htmlCreamHeadshot(ad) : htmlPhotoHeadshot(ad)
}

await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

const results = []
for (let i = 0; i < ADS.length; i++) {
  const ad = ADS[i]
  const htmlPath = resolve(OUT_DIR, `quote-v2-${ad.slug}.html`)
  const jpgPath = resolve(OUT_DIR, `quote-v2-${ad.slug}.jpg`)
  await writeFile(htmlPath, html(ad), 'utf-8')
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1080, height: 1080 } })
  console.log(`  ${i + 1}/${ADS.length}  ${ad.slug}`)
  results.push({ ...ad, jpgPath: `quote-v2-${ad.slug}.jpg` })
}

await browser.close()

const sheet = `<!doctype html><html><head><meta charset="utf-8"><title>v2 Quote-Led Seller Ads</title>
<style>
  body{font-family:-apple-system,sans-serif;background:#faf8f4;color:#102742;margin:0;padding:32px}
  h1{margin:0 0 6px;font-size:24px}
  p.lede{color:#5b6478;margin:0 0 8px;max-width:920px;line-height:1.55}
  ul.changes{color:#5b6478;font-size:13px;line-height:1.7;margin:0 0 24px;padding-left:20px;max-width:920px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:24px;max-width:1480px;margin:0 auto}
  .card{background:#fff;border:1px solid rgba(16,39,66,0.12);border-radius:14px;overflow:hidden}
  .card img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover}
  .meta{padding:16px 18px;font-size:13px}
  .meta .n{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#5b6478;margin-bottom:6px}
  .meta .h{font-weight:600;color:#102742;font-size:14px;line-height:1.4}
</style></head><body>
<h1>v2 quote-led seller ads (with Matt)</h1>
<p class="lede">5 ads using verified Google reviews + Matt's headshot + Supabase-verified Bend market data. The "personal touch" Matt asked for — anchored by data, not stock photos.</p>
<ul class="changes">
  <li>Every quote is verbatim from the Ryan Realty GBP (pulled 2026-05-22, 24 reviews total in corpus)</li>
  <li>Ernie Oster review (May 2026) leads — the freshest 5-star, Schoolhouse Road transaction context</li>
  <li>Matt's transparent-bg headshot anchored bottom-right per design-recon Pattern 5 (agent-led)</li>
  <li>Research-backed: testimonial + real face = 123% more leads vs no-face (Carrot study)</li>
  <li>Two registers: 2 cream/text-led (Ernie, Helen), 3 photo-led on Tetherow aerial (Douglas, Jim, Charise)</li>
  <li>1080×1080 (square outperforms landscape on Meta per AdEspresso $1,200 experiment)</li>
</ul>
<div class="grid">
${results.map((r, i) => `<div class="card">
  <a href="${r.jpgPath}" target="_blank"><img src="${r.jpgPath}" alt="Ad ${i + 1}"></a>
  <div class="meta">
    <div class="n">${i + 1} · ${r.style === 'cream-headshot' ? 'Text-led (cream)' : 'Photo-led (Tetherow)'} · ${r.attribution.split(' · ')[0]}</div>
    <div class="h">${r.body}</div>
  </div>
</div>`).join('\n')}
</div>
</body></html>`
await writeFile(resolve(OUT_DIR, 'quote-ads-v2-contact-sheet.html'), sheet, 'utf-8')

console.log(`\nDone. Contact sheet: ${resolve(OUT_DIR, 'quote-ads-v2-contact-sheet.html')}`)

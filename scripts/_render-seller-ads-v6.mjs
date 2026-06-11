#!/usr/bin/env node
/**
 * v6 seller-lead ads — full-bleed photo composition, no cream card.
 *
 * Architecture per Matt 2026-05-28 directive:
 *   - Drop the cream-card-below-photo layout entirely
 *   - Full-bleed image, everything overlays on top
 *   - Social proof (review quote) in WHITE italic at ~85% opacity, floating
 *   - Broker(s) integrated into the scene — Matt composited PNG over Bend
 *     photo, OR the team studio shot as the full-bleed image itself
 *
 * Copy sourced from real long-running winners (out/design-recon/fb-lead-gen-ad
 * raw.json — 18,716 ads, 1,288 seller-focused):
 *   - "What's your home worth?" — 6 years running (Kristi Weinstock)
 *   - "Thinking of selling in the next year?" — 5 years running (Trish Pullin)
 *   - "Considering selling your home?" — variation pattern
 *   - "Get a professional estimate." — anti-Zillow without naming Zillow
 *
 * Trust lines from Bend competitor research:
 *   - "Bend's trusted real estate team" (Ninebark pattern)
 *   - "5.0 stars across 24 Bend sellers" (quantified, defensible)
 *
 * CTA from FB-allowed buttons only (Get Quote / Learn More / Get Offer /
 * Download / Book Now / Sign Up). "Start Now" and "Get My Estimate" aren't
 * FB-button-allowed — would only work as visual button copy in creative.
 */
import { chromium } from 'playwright'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'out/seller-ad-concepts/v6')

const FONTS_CSS = `
  @font-face { font-family: 'Amboqia'; src: url('${ROOT}/design_system/ryan-realty/fonts/Amboqia_Boriango.otf') format('opentype'); font-display: block; }
  @font-face { font-family: 'Azo Sans'; src: url('${ROOT}/design_system/ryan-realty/fonts/AzoSans-Medium.ttf') format('truetype'); font-display: block; }
`

const TEAM_PHOTO = `${ROOT}/public/images/team.png`
const MATT_PHOTO = `${ROOT}/design_system/ryan-realty/assets/team/matt-ryan.png`

const VARIANTS = [
  {
    slug: 'team-home-worth',
    label: 'Team · "What\'s your home worth?"',
    template: 'team',
    photo: TEAM_PHOTO,
    photoFocus: 'center 30%',
    headline: "What's your home worth?",
    trustLine: "Bend's trusted real estate team.",
    review: 'Attention to detail and art of the negotiations with data.',
    reviewer: 'Ernie Oster · Google review',
    cta: 'Get Quote',
  },
  {
    slug: 'matt-thinking-of-selling',
    label: 'Matt · "Thinking of selling in the next year?"',
    template: 'matt',
    photo: `${ROOT}/public/lp/central-oregon-golf/img/bend-cascades-01.jpg`,
    photoFocus: 'center 50%',
    headline: 'Thinking of selling in the next year?',
    trustLine: '24 five-star reviews. Built on local expertise.',
    review: 'The most professional, communicative, and honest Real Estate Broker I have ever worked with.',
    reviewer: 'Douglas Grant · Google review',
    cta: 'Learn More',
  },
  {
    slug: 'team-considering-selling',
    label: 'Team · "Considering selling your home?"',
    template: 'team',
    photo: TEAM_PHOTO,
    photoFocus: 'center 30%',
    headline: 'Considering selling your home?',
    trustLine: '5.0 stars across 24 Bend sellers.',
    review: 'Sold our home faster than we expected, even in a tough market.',
    reviewer: 'Audra Hedberg · Google review',
    cta: 'Get Quote',
  },
  {
    slug: 'matt-professional-estimate',
    label: 'Matt · "Get a professional estimate"',
    template: 'matt',
    photo: `${ROOT}/public/lp/tetherow/img/tetherow-course-118.jpg`,
    photoFocus: 'center 55%',
    headline: 'Get a professional estimate.',
    trustLine: 'The Bend market is moving. So is your equity.',
    review: 'Patient, low pressure with us. Expert guidance.',
    reviewer: 'Gary Timms · Google review',
    cta: 'Learn More',
  },
]

function htmlMatt(v) {
  // Full-bleed Bend photo, Matt composited bottom-right, dark scrim on left
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONTS_CSS}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:1080px;height:1080px;overflow:hidden;background:#102742;color:#faf8f4;font-family:'Azo Sans',sans-serif;position:relative}

    /* Full-bleed Bend photo */
    .photo{position:absolute;inset:0;background:url('file://${v.photo}') ${v.photoFocus}/cover no-repeat;z-index:1}

    /* Strong scrim on left (text area) fading to clear on right (Matt area) */
    .scrim-left{position:absolute;inset:0;background:linear-gradient(95deg,rgba(16,39,66,0.92) 0%,rgba(16,39,66,0.78) 38%,rgba(16,39,66,0.32) 62%,rgba(16,39,66,0) 80%);z-index:2}

    /* Brand mark top-left */
    .brand{position:absolute;top:56px;left:64px;z-index:5;font-family:'Amboqia',serif;font-size:30px;letter-spacing:0.02em;color:#faf8f4;text-shadow:0 2px 14px rgba(0,0,0,0.6)}
    .brand-sub{font-family:'Azo Sans',sans-serif;font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(250,248,244,0.85);margin-top:6px;text-shadow:0 2px 10px rgba(0,0,0,0.6)}

    /* Headline — top-left */
    .headline{position:absolute;left:64px;top:200px;width:600px;font-family:'Amboqia',serif;font-size:64px;line-height:1.04;color:#faf8f4;letter-spacing:-0.012em;z-index:4;text-shadow:0 2px 18px rgba(0,0,0,0.5)}

    /* Trust line — under headline */
    .trust{position:absolute;left:64px;top:430px;width:560px;font-family:'Azo Sans',sans-serif;font-size:22px;line-height:1.42;color:rgba(250,248,244,0.92);font-weight:500;z-index:4;text-shadow:0 2px 12px rgba(0,0,0,0.55)}

    /* Review overlay — middle-left, white italic, 85% opacity */
    .review{position:absolute;left:64px;top:560px;width:540px;z-index:4}
    .review-mark{font-family:'Amboqia',serif;font-size:56px;color:rgba(250,248,244,0.42);line-height:0.4;margin-bottom:8px;text-shadow:0 2px 12px rgba(0,0,0,0.4)}
    .review-text{font-family:'Amboqia',serif;font-size:24px;line-height:1.32;color:rgba(250,248,244,0.88);letter-spacing:-0.005em;font-style:italic;text-shadow:0 2px 14px rgba(0,0,0,0.55)}
    .review-attr{font-family:'Azo Sans',sans-serif;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(250,248,244,0.7);margin-top:14px;text-shadow:0 2px 10px rgba(0,0,0,0.5)}

    /* Matt composited bottom-right */
    .matt{position:absolute;right:30px;bottom:-40px;width:520px;height:780px;background:url('file://${MATT_PHOTO}') center top/contain no-repeat;z-index:3;filter:drop-shadow(-12px 0 28px rgba(0,0,0,0.5))}

    /* CTA pill bottom-left */
    .cta-pill{position:absolute;left:64px;bottom:64px;background:#faf8f4;color:#102742;padding:22px 42px;border-radius:14px;font-family:'Azo Sans',sans-serif;font-size:22px;font-weight:600;letter-spacing:0.02em;display:inline-flex;align-items:center;gap:14px;box-shadow:0 12px 32px rgba(0,0,0,0.35);z-index:5}
    .cta-pill .arrow{font-size:24px;line-height:1}
  </style></head><body>
    <div class="photo"></div>
    <div class="scrim-left"></div>
    <div class="brand">Ryan Realty<div class="brand-sub">Bend, Oregon</div></div>
    <div class="headline">${v.headline}</div>
    <div class="trust">${v.trustLine}</div>
    <div class="review">
      <div class="review-mark">"</div>
      <div class="review-text">${v.review}</div>
      <div class="review-attr">${v.reviewer}</div>
    </div>
    <div class="matt"></div>
    <div class="cta-pill">${v.cta} <span class="arrow">→</span></div>
  </body></html>`
}

function htmlTeam(v) {
  // Team photo (1024×600) sits centered with studio-black bands top + bottom.
  // Banded layout: top band = brand + headline, photo middle, bottom band = trust + review + CTA.
  // Photo height = 600px scaled to 1080w → 633px. Top band 224px, bottom band 223px.
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONTS_CSS}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:1080px;height:1080px;overflow:hidden;background:#0a0f1a;color:#faf8f4;font-family:'Azo Sans',sans-serif;position:relative}

    /* Photo banded — full 1080w, contained vertically, dark bleed top + bottom */
    .photo{position:absolute;left:0;right:0;top:140px;height:633px;background:#0a0f1a url('file://${v.photo}') center top/cover no-repeat;z-index:1}

    /* Soft gradient at photo top + bottom to blend into dark bands */
    .photo-fade-top{position:absolute;left:0;right:0;top:140px;height:80px;background:linear-gradient(180deg,rgba(10,15,26,0.65) 0%,rgba(10,15,26,0) 100%);z-index:2}
    .photo-fade-bottom{position:absolute;left:0;right:0;top:693px;height:80px;background:linear-gradient(180deg,rgba(10,15,26,0) 0%,rgba(10,15,26,0.65) 100%);z-index:2}

    .brand{position:absolute;top:48px;left:64px;z-index:5;font-family:'Amboqia',serif;font-size:26px;letter-spacing:0.02em;color:#faf8f4}
    .brand-sub{font-family:'Azo Sans',sans-serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(250,248,244,0.78);margin-top:5px}

    /* Headline — top band, centered */
    .headline{position:absolute;left:64px;right:64px;top:60px;font-family:'Amboqia',serif;font-size:44px;line-height:1.05;color:#faf8f4;letter-spacing:-0.01em;z-index:4;text-align:right}

    /* Bottom band — trust + review + CTA */
    .bottom{position:absolute;left:0;right:0;bottom:0;height:307px;z-index:4;padding:40px 64px 48px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}

    .trust{font-family:'Azo Sans',sans-serif;font-size:20px;letter-spacing:0.04em;color:rgba(250,248,244,0.88);font-weight:500;margin-bottom:18px}

    .review{margin-bottom:24px;max-width:780px}
    .review-mark{font-family:'Amboqia',serif;font-size:38px;color:rgba(250,248,244,0.4);line-height:0.4;margin-bottom:10px}
    .review-text{font-family:'Amboqia',serif;font-size:22px;line-height:1.3;color:rgba(250,248,244,0.86);letter-spacing:-0.005em;font-style:italic}
    .review-attr{font-family:'Azo Sans',sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(250,248,244,0.65);margin-top:10px}

    .cta-pill{background:#faf8f4;color:#102742;padding:20px 42px;border-radius:14px;font-family:'Azo Sans',sans-serif;font-size:21px;font-weight:600;letter-spacing:0.02em;display:inline-flex;align-items:center;gap:14px;box-shadow:0 12px 28px rgba(0,0,0,0.4)}
    .cta-pill .arrow{font-size:24px;line-height:1}
  </style></head><body>
    <div class="photo"></div>
    <div class="photo-fade-top"></div>
    <div class="photo-fade-bottom"></div>
    <div class="brand">Ryan Realty<div class="brand-sub">Bend, Oregon</div></div>
    <div class="headline">${v.headline}</div>
    <div class="bottom">
      <div class="trust">${v.trustLine}</div>
      <div class="review">
        <div class="review-mark">"</div>
        <div class="review-text">${v.review}</div>
        <div class="review-attr">${v.reviewer}</div>
      </div>
      <div class="cta-pill">${v.cta} <span class="arrow">→</span></div>
    </div>
  </body></html>`
}

function html(v) {
  return v.template === 'team' ? htmlTeam(v) : htmlMatt(v)
}

await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

const results = []
for (let i = 0; i < VARIANTS.length; i++) {
  const v = VARIANTS[i]
  const htmlPath = resolve(OUT_DIR, `seller-v6-${v.slug}.html`)
  const jpgPath = resolve(OUT_DIR, `seller-v6-${v.slug}.jpg`)
  await writeFile(htmlPath, html(v), 'utf-8')
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1080, height: 1080 } })
  console.log(`  ${i + 1}/${VARIANTS.length}  ${v.slug}`)
  results.push({ ...v, jpgPath: `seller-v6-${v.slug}.jpg` })
}

await browser.close()

const sheet = `<!doctype html><html><head><meta charset="utf-8"><title>v6 Seller Ads — Full-bleed composition</title>
<style>
  body{font-family:-apple-system,sans-serif;background:#0a0f1a;color:#faf8f4;margin:0;padding:32px}
  h1{margin:0 0 6px;font-size:24px;font-weight:600;color:#faf8f4}
  p.lede{color:rgba(250,248,244,0.7);margin:0 0 8px;max-width:920px;line-height:1.55}
  ul.changes{color:rgba(250,248,244,0.6);font-size:13px;line-height:1.7;margin:0 0 24px;padding-left:20px;max-width:920px}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(420px,1fr));gap:24px;max-width:1300px;margin:0 auto}
  .card{background:#1a2235;border:1px solid rgba(250,248,244,0.12);border-radius:14px;overflow:hidden}
  .card img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover}
  .meta{padding:16px 18px;font-size:13px;color:rgba(250,248,244,0.85)}
  .meta .n{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(250,248,244,0.6);margin-bottom:6px}
  .meta .h{font-weight:600;color:#faf8f4;font-size:14px;line-height:1.4;margin-bottom:6px}
  .meta .s{color:rgba(250,248,244,0.65);font-size:12px;line-height:1.45}
</style></head><body>
<h1>v6 seller ads — full-bleed photo composition</h1>
<p class="lede">No cream card. Everything overlays on the photo. Social proof quote in white italic at 85% opacity. Matt composited into the Bend backdrop on his variants; team studio photo serves as the full-bleed image on team variants.</p>
<ul class="changes">
  <li>Headlines from real long-running FB seller ads (6yr / 5yr winners) — not invented copy</li>
  <li>Trust lines from Bend competitor research (Ninebark, Kromm, Mr Bend pattern)</li>
  <li>Review quotes verbatim from Ryan Realty GBP pull 2026-05-22</li>
  <li>CTAs match FB's allowed lead-gen button types (Get Quote / Learn More)</li>
  <li>Drive to <code>/lp/seller-home-value</code></li>
</ul>
<div class="grid">
${results.map((r, i) => `<div class="card">
  <a href="${r.jpgPath}" target="_blank"><img src="${r.jpgPath}" alt="${r.label}"></a>
  <div class="meta">
    <div class="n">${i + 1} · ${r.label}</div>
    <div class="h">${r.headline}</div>
    <div class="s">${r.trustLine} · CTA: ${r.cta}</div>
  </div>
</div>`).join('\n')}
</div>
</body></html>`
await writeFile(resolve(OUT_DIR, 'seller-ads-v6-contact-sheet.html'), sheet, 'utf-8')

console.log(`\nDone. Contact sheet: ${resolve(OUT_DIR, 'seller-ads-v6-contact-sheet.html')}`)

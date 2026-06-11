#!/usr/bin/env node
/**
 * v5 seller-lead ads — per Matt's 2026-05-28 direction:
 *   - 2 team-photo variants (replaces brokerage Jax-badge variant + Paul solo)
 *   - 2 Matt-photo variants (Matt as principal face of the brokerage)
 *   - NO Paul solo, NO Rebecca solo, NO Jax
 *
 * Team photo is rectangular (280×164, 16px radius) so all 3 brokers are
 * visible — circles only fit one face. Matt remains a circular avatar.
 *
 * Skills loaded same as v4 (design SKILL.md + competitor-design-recon +
 * recon Pattern 1 + brand-voice).
 *
 * All 4 variants drive to /lp/seller-home-value (confirmed with Matt).
 */
import { chromium } from 'playwright'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'out/seller-ad-concepts/v5')

const FONTS_CSS = `
  @font-face { font-family: 'Amboqia'; src: url('${ROOT}/design_system/ryan-realty/fonts/Amboqia_Boriango.otf') format('opentype'); font-display: block; }
  @font-face { font-family: 'Azo Sans'; src: url('${ROOT}/design_system/ryan-realty/fonts/AzoSans-Medium.ttf') format('truetype'); font-display: block; }
`

const TEAM_PHOTO = `${ROOT}/public/images/team.png`
const MATT_PHOTO = `${ROOT}/design_system/ryan-realty/assets/team/matt-ryan.png`

const VARIANTS = [
  {
    slug: 'team-home-worth',
    label: 'Team · "What is your home worth?"',
    photo: `${ROOT}/design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg`,
    photoFocus: 'center 38%',
    badgeType: 'team',
    headline: 'What is your Bend home worth?',
    subhead: 'A real range in 60 seconds. Three recent comps. No phone call.',
    proofType: 'stars',
    proofText: '5.0 across 24 Google reviews',
  },
  {
    slug: 'matt-zestimate',
    label: 'Matt · "Skip the Zestimate"',
    photo: `${ROOT}/public/lp/central-oregon-golf/img/bend-cascades-01.jpg`,
    photoFocus: 'center 45%',
    badgeType: 'matt',
    headline: 'Selling in Bend? Skip the Zestimate.',
    subhead: 'A range built from actual closed sales on your block. Not a Zillow guess.',
    proofType: 'quote',
    proofText: 'Attention to detail and art of the negotiations with data.',
    proofAttribution: 'Ernie Oster · Google review · May 2026',
  },
  {
    slug: 'team-165-homes',
    label: 'Team · "165 homes last month"',
    photo: `${ROOT}/public/lp/tetherow/img/tetherow-course-118.jpg`,
    photoFocus: 'center 50%',
    badgeType: 'team',
    headline: 'Bend sold 165 homes last month.',
    subhead: 'Was one on your block? Get your range in 60 seconds.',
    proofType: 'stars',
    proofText: '24 five-star reviews from Bend sellers',
  },
  {
    slug: 'matt-next-year',
    label: 'Matt · "Thinking of selling next year?"',
    photo: `${ROOT}/public/lp/central-oregon-golf/img/bend-cascades-03.jpg`,
    photoFocus: 'center 55%',
    badgeType: 'matt',
    headline: 'Thinking of selling next year?',
    subhead: 'Start with the number. Then decide. No pressure, no phone call.',
    proofType: 'quote',
    proofText: 'Patient, low pressure with us. Expert guidance.',
    proofAttribution: 'Gary Timms · Google review',
  },
]

const CTA = 'Get your range'

function proofBlock(v) {
  if (v.proofType === 'stars') {
    return `
      <div class="proof proof-stars">
        <span class="stars">★★★★★</span>
        <span class="proof-text">${v.proofText}</span>
      </div>`
  }
  return `
    <div class="proof proof-quote">
      <div class="quote-mark">"</div>
      <div class="quote-content">
        <div class="quote-text">${v.proofText}</div>
        <div class="quote-attribution">${v.proofAttribution}</div>
      </div>
    </div>`
}

function badgeBlock(v) {
  if (v.badgeType === 'team') {
    return `
      <div class="team-badge-wrap">
        <div class="team-badge"></div>
        <div class="team-label">Ryan Realty team</div>
      </div>`
  }
  if (v.badgeType === 'matt') {
    return `
      <div class="avatar-wrap">
        <div class="avatar matt"></div>
        <div class="avatar-name">Matt Ryan</div>
      </div>`
  }
  return ''
}

function html(v) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONTS_CSS}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:1080px;height:1080px;overflow:hidden;background:#faf8f4;color:#102742;font-family:'Azo Sans',sans-serif;position:relative}

    /* Photo — full-bleed top 62% */
    .photo{position:absolute;left:0;right:0;top:0;height:680px;background:url('file://${v.photo}') ${v.photoFocus}/cover no-repeat;z-index:1}
    .photo-scrim-top{position:absolute;left:0;right:0;top:0;height:220px;background:linear-gradient(180deg,rgba(16,39,66,0.62) 0%,rgba(16,39,66,0.22) 60%,rgba(16,39,66,0) 100%);z-index:2}
    .photo-fade{position:absolute;left:0;right:0;top:580px;height:120px;background:linear-gradient(180deg,rgba(250,248,244,0) 0%,rgba(250,248,244,0.85) 60%,#faf8f4 100%);z-index:2}

    /* Brand mark top-left */
    .brand{position:absolute;top:48px;left:64px;z-index:5;font-family:'Amboqia',serif;font-size:28px;letter-spacing:0.02em;color:#faf8f4;text-shadow:0 2px 14px rgba(0,0,0,0.5)}
    .brand-sub{font-family:'Azo Sans',sans-serif;font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(250,248,244,0.82);margin-top:6px;text-shadow:0 2px 10px rgba(0,0,0,0.55)}

    /* Bottom card */
    .card{position:absolute;left:0;right:0;bottom:0;height:480px;background:#faf8f4;z-index:3;padding:56px 80px 48px;display:flex;flex-direction:column;justify-content:center}

    .headline{font-family:'Amboqia',serif;font-size:60px;line-height:1.06;color:#102742;letter-spacing:-0.012em;margin-bottom:16px;max-width:820px}
    .subhead{font-family:'Azo Sans',sans-serif;font-size:21px;line-height:1.42;color:rgba(16,39,66,0.78);font-weight:500;margin-bottom:26px;max-width:740px}

    .cta-row{display:flex;align-items:center;gap:24px;flex-wrap:wrap}
    .cta-pill{background:#102742;color:#faf8f4;padding:20px 38px;border-radius:14px;font-family:'Azo Sans',sans-serif;font-size:21px;font-weight:600;letter-spacing:0.02em;display:inline-flex;align-items:center;gap:14px;box-shadow:0 8px 24px rgba(16,39,66,0.18)}
    .cta-pill .arrow{font-size:24px;line-height:1}

    .proof{display:flex;align-items:center;gap:14px;max-width:460px}
    .proof-stars{font-family:'Azo Sans',sans-serif}
    .proof-stars .stars{color:#102742;font-size:22px;letter-spacing:0.04em}
    .proof-stars .proof-text{font-size:13px;font-weight:500;letter-spacing:0.04em;color:rgba(16,39,66,0.7);text-transform:uppercase}

    .proof-quote{align-items:flex-start}
    .proof-quote .quote-mark{font-family:'Amboqia',serif;font-size:54px;line-height:0.6;color:rgba(16,39,66,0.32);margin-top:8px}
    .proof-quote .quote-content{flex:1}
    .proof-quote .quote-text{font-family:'Amboqia',serif;font-size:18px;line-height:1.32;color:rgba(16,39,66,0.85);letter-spacing:-0.005em;font-style:italic}
    .proof-quote .quote-attribution{font-family:'Azo Sans',sans-serif;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(16,39,66,0.55);margin-top:6px}

    /* Matt avatar — circular */
    .avatar-wrap{position:absolute;right:64px;top:520px;width:160px;text-align:center;z-index:6}
    .avatar.matt{width:148px;height:148px;border-radius:50%;background:#faf8f4 url('file://${MATT_PHOTO}') center 30%/cover no-repeat;border:4px solid #faf8f4;box-shadow:0 6px 20px rgba(16,39,66,0.25)}
    .avatar-name{margin-top:8px;font-family:'Azo Sans',sans-serif;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(16,39,66,0.62)}

    /* Team badge — wider rectangular, 3 faces */
    .team-badge-wrap{position:absolute;right:48px;top:520px;width:300px;text-align:center;z-index:6}
    .team-badge{width:300px;height:176px;border-radius:18px;background:#102742 url('file://${TEAM_PHOTO}') center/cover no-repeat;border:4px solid #faf8f4;box-shadow:0 8px 24px rgba(16,39,66,0.30)}
    .team-label{margin-top:8px;font-family:'Azo Sans',sans-serif;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(16,39,66,0.62)}
  </style></head><body>
    <div class="photo"></div>
    <div class="photo-scrim-top"></div>
    <div class="photo-fade"></div>

    <div class="brand">
      Ryan Realty
      <div class="brand-sub">Bend, Oregon</div>
    </div>

    <div class="card">
      <div class="headline">${v.headline}</div>
      <div class="subhead">${v.subhead}</div>
      <div class="cta-row">
        <div class="cta-pill">${CTA} <span class="arrow">→</span></div>
        ${proofBlock(v)}
      </div>
    </div>

    ${badgeBlock(v)}
  </body></html>`
}

await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

const results = []
for (let i = 0; i < VARIANTS.length; i++) {
  const v = VARIANTS[i]
  const htmlPath = resolve(OUT_DIR, `seller-v5-${v.slug}.html`)
  const jpgPath = resolve(OUT_DIR, `seller-v5-${v.slug}.jpg`)
  await writeFile(htmlPath, html(v), 'utf-8')
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1080, height: 1080 } })
  console.log(`  ${i + 1}/${VARIANTS.length}  ${v.slug}`)
  results.push({ ...v, jpgPath: `seller-v5-${v.slug}.jpg` })
}

await browser.close()

const sheet = `<!doctype html><html><head><meta charset="utf-8"><title>v5 Seller Ads — Team + Matt rotation</title>
<style>
  body{font-family:-apple-system,sans-serif;background:#faf8f4;color:#102742;margin:0;padding:32px}
  h1{margin:0 0 6px;font-size:24px;font-weight:600}
  p.lede{color:#5b6478;margin:0 0 8px;max-width:920px;line-height:1.55}
  ul.changes{color:#5b6478;font-size:13px;line-height:1.7;margin:0 0 24px;padding-left:20px;max-width:920px}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(420px,1fr));gap:24px;max-width:1300px;margin:0 auto}
  .card{background:#fff;border:1px solid rgba(16,39,66,0.12);border-radius:14px;overflow:hidden}
  .card img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover}
  .meta{padding:16px 18px;font-size:13px}
  .meta .n{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#5b6478;margin-bottom:6px}
  .meta .h{font-weight:600;color:#102742;font-size:14px;line-height:1.4;margin-bottom:6px}
  .meta .s{color:#5b6478;font-size:12px;line-height:1.45}
</style></head><body>
<h1>v5 seller ads — Team + Matt rotation</h1>
<p class="lede">Per direction: 2 team-photo variants, 2 Matt-photo variants. No Paul or Rebecca solo, no Jax. All CTAs drive to <code>/lp/seller-home-value</code>. Each variant runs a different headline, subhead, and social-proof flavor.</p>
<ul class="changes">
  <li>Team badge is a wider rectangle (300×176, 18px radius) so all 3 brokers stay visible — circles only fit one face</li>
  <li>Matt avatar stays circular (148×148)</li>
  <li>Social proof rotates: ★ rating + count (Team variants) and verbatim Google review quote (Matt variants)</li>
  <li>Photos: Old Mill canonical · Tower Theater night · Pronghorn w/ Mt. Bachelor · Old Mill bridge flags</li>
  <li>Quotes verbatim from GBP corpus (Ernie Oster, Gary Timms)</li>
</ul>
<div class="grid">
${results.map((r, i) => `<div class="card">
  <a href="${r.jpgPath}" target="_blank"><img src="${r.jpgPath}" alt="${r.label}"></a>
  <div class="meta">
    <div class="n">${i + 1} · ${r.label}</div>
    <div class="h">${r.headline}</div>
    <div class="s">${r.subhead}</div>
  </div>
</div>`).join('\n')}
</div>
</body></html>`
await writeFile(resolve(OUT_DIR, 'seller-ads-v5-contact-sheet.html'), sheet, 'utf-8')

console.log(`\nDone. Contact sheet: ${resolve(OUT_DIR, 'seller-ads-v5-contact-sheet.html')}`)

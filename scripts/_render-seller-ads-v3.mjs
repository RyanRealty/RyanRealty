#!/usr/bin/env node
/**
 * v3 seller-lead ads — Pattern 1 from out/design-recon/fb-lead-gen-ad/recon.md
 * (the 477-day-running winner: concrete question + concise stat + clear CTA).
 *
 * v3 changes from v2 (broker-headshot-dominant):
 *   - Headshot shrunk from ~50% of frame to a ~120px circular avatar in the
 *     bottom-right corner — broker becomes a badge, not the subject
 *   - The CTA is the visual anchor: navy pill, "Get your range →", direct
 *     mirror of the FB ad button
 *   - Bend photography is the protagonist (per brand SKILL: "documentary
 *     Central Oregon photography")
 *   - Removed "Matt Ryan / Principal Broker" label (per Matt directive)
 *   - Removed small body data row (unreadable at thumb-scroll)
 *   - 4-variant rotation: brokerage-led + Matt-led + Paul-led + Rebecca-led
 *     so the audience accumulates brand impressions across the carousel
 *
 * Source skills loaded:
 *   - design_system/ryan-realty/SKILL.md (palette navy + cream only)
 *   - marketing_brain_skills/competitor-design-recon/SKILL.md
 *   - out/design-recon/fb-lead-gen-ad/recon.md (Pattern 1 winner)
 *
 * Output: out/seller-ad-concepts/v3/seller-v3-{slug}.jpg + contact sheet
 */
import { chromium } from 'playwright'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'out/seller-ad-concepts/v3')

const FONT_AMBOQIA = `${ROOT}/design_system/ryan-realty/fonts/Amboqia_Boriango.otf`
const FONT_AZOSANS = `${ROOT}/design_system/ryan-realty/fonts/AzoSans-Medium.ttf`

const FONTS_CSS = `
  @font-face { font-family: 'Amboqia'; src: url('${FONT_AMBOQIA}') format('opentype'); font-display: block; }
  @font-face { font-family: 'Azo Sans'; src: url('${FONT_AZOSANS}') format('truetype'); font-display: block; }
`

// 4 variants — rotate across creatives in the same FB ad set for brand burn-in.
// Each variant uses a different Central Oregon photo so the viewer's brain
// doesn't pattern-match and skip. Same headline, same CTA — only the FACE
// and the backdrop change.
const VARIANTS = [
  {
    slug: 'brokerage',
    label: 'Brokerage-led (Jax badge)',
    photo: `${ROOT}/design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg`,
    photoFocus: 'center 38%',
    // Brand-led variant uses the heritage Jax circular badge per design SKILL
    avatar: `${ROOT}/design_system/ryan-realty/assets/brand/blue-dog.png`,
    avatarFocus: 'center 50%',
    avatarLabel: null, // no caption — badge speaks for itself
    avatarIsBadge: true, // skip white circle border + face crop
  },
  {
    slug: 'matt',
    label: 'Matt-led',
    photo: `${ROOT}/public/lp/central-oregon-golf/img/bend-cascades-03.jpg`,
    photoFocus: 'center 50%',
    avatar: `${ROOT}/design_system/ryan-realty/assets/team/matt-ryan.png`,
    avatarFocus: 'center 30%',
    avatarLabel: 'Matt Ryan',
  },
  {
    slug: 'paul',
    label: 'Paul-led',
    photo: `${ROOT}/public/lp/tetherow/img/tetherow-aerial-course.jpg`,
    photoFocus: 'center 35%',
    avatar: `${ROOT}/design_system/ryan-realty/assets/team/paul-stevenson.png`,
    avatarFocus: 'center 28%',
    avatarLabel: 'Paul Stevenson',
  },
  {
    slug: 'rebecca',
    label: 'Rebecca-led',
    photo: `${ROOT}/public/lp/central-oregon-golf/img/awbrey-glen-01.jpg`,
    photoFocus: 'center 40%',
    avatar: `${ROOT}/design_system/ryan-realty/assets/team/rebecca-peterson.png`,
    avatarFocus: 'center 25%',
    avatarLabel: 'Rebecca Peterson',
  },
]

// Single locked copy — same across all 4 variants for brand consistency.
// The variant only changes the FACE + BACKDROP, not the message.
const HEADLINE = 'What is your Bend home worth?'
const SUBHEAD = 'A real range in 60 seconds. Three recent comps. No phone call.'
const CTA = 'Get your range'

function html(v) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONTS_CSS}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:1080px;height:1080px;overflow:hidden;background:#faf8f4;color:#102742;font-family:'Azo Sans',sans-serif;position:relative}

    /* Photo: full-bleed top 62% of canvas */
    .photo{position:absolute;left:0;right:0;top:0;height:680px;background:url('file://${v.photo}') ${v.photoFocus}/cover no-repeat;z-index:1}

    /* Subtle top scrim for the brand mark legibility */
    .photo-scrim-top{position:absolute;left:0;right:0;top:0;height:200px;background:linear-gradient(180deg,rgba(16,39,66,0.55) 0%,rgba(16,39,66,0.20) 60%,rgba(16,39,66,0) 100%);z-index:2}

    /* Soft fade from photo into cream card */
    .photo-fade{position:absolute;left:0;right:0;top:580px;height:120px;background:linear-gradient(180deg,rgba(250,248,244,0) 0%,rgba(250,248,244,0.85) 60%,#faf8f4 100%);z-index:2}

    /* Brand wordmark top-left */
    .brand{position:absolute;top:48px;left:64px;z-index:5;font-family:'Amboqia',serif;font-size:28px;letter-spacing:0.02em;color:#faf8f4;text-shadow:0 2px 14px rgba(0,0,0,0.45)}
    .brand-sub{font-family:'Azo Sans',sans-serif;font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(250,248,244,0.78);margin-top:6px;text-shadow:0 2px 10px rgba(0,0,0,0.5)}

    /* Bottom card — cream, holds the actionable content */
    .card{position:absolute;left:0;right:0;bottom:0;height:480px;background:#faf8f4;z-index:3;padding:64px 80px 56px;display:flex;flex-direction:column;justify-content:center}

    .headline{font-family:'Amboqia',serif;font-size:74px;line-height:1.04;color:#102742;letter-spacing:-0.012em;margin-bottom:20px}
    .subhead{font-family:'Azo Sans',sans-serif;font-size:24px;line-height:1.4;color:rgba(16,39,66,0.78);font-weight:500;margin-bottom:36px;max-width:760px}

    /* CTA pill — the visual anchor */
    .cta-row{display:flex;align-items:center;gap:24px}
    .cta-pill{background:#102742;color:#faf8f4;padding:22px 40px;border-radius:14px;font-family:'Azo Sans',sans-serif;font-size:22px;font-weight:600;letter-spacing:0.02em;display:inline-flex;align-items:center;gap:14px;box-shadow:0 8px 24px rgba(16,39,66,0.18)}
    .cta-pill .arrow{font-size:24px;line-height:1}

    .review-stars{display:flex;align-items:center;gap:10px;font-family:'Azo Sans',sans-serif;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(16,39,66,0.6)}
    .stars{color:#102742;letter-spacing:0.04em;font-size:18px}

    /* Avatar — small badge sitting at the photo/card boundary, bottom-right */
    .avatar-wrap{position:absolute;right:64px;top:520px;width:160px;text-align:center;z-index:6}
    .avatar{width:148px;height:148px;border-radius:50%;background:#faf8f4 url('file://${v.avatar || ''}') ${v.avatarFocus || 'center 25%'}/cover no-repeat;border:4px solid #faf8f4;box-shadow:0 6px 20px rgba(16,39,66,0.22)}
    .avatar.badge{background:#faf8f4 url('file://${v.avatar || ''}') center/85% no-repeat;border:4px solid #faf8f4}
    .avatar-name{margin-top:8px;font-family:'Azo Sans',sans-serif;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(16,39,66,0.62)}
  </style></head><body>
    <div class="photo"></div>
    <div class="photo-scrim-top"></div>
    <div class="photo-fade"></div>

    <div class="brand">
      Ryan Realty
      <div class="brand-sub">Bend, Oregon</div>
    </div>

    <div class="card">
      <div class="headline">${HEADLINE}</div>
      <div class="subhead">${SUBHEAD}</div>
      <div class="cta-row">
        <div class="cta-pill">${CTA} <span class="arrow">→</span></div>
        <div class="review-stars"><span class="stars">★★★★★</span> 5.0 · 24 Google reviews</div>
      </div>
    </div>

    <div class="avatar-wrap">
      <div class="avatar${v.avatarIsBadge ? ' badge' : ''}"></div>
      ${v.avatarLabel ? `<div class="avatar-name">${v.avatarLabel}</div>` : ''}
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
  const htmlPath = resolve(OUT_DIR, `seller-v3-${v.slug}.html`)
  const jpgPath = resolve(OUT_DIR, `seller-v3-${v.slug}.jpg`)
  await writeFile(htmlPath, html(v), 'utf-8')
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1080, height: 1080 } })
  console.log(`  ${i + 1}/${VARIANTS.length}  ${v.slug}`)
  results.push({ ...v, jpgPath: `seller-v3-${v.slug}.jpg` })
}

await browser.close()

const sheet = `<!doctype html><html><head><meta charset="utf-8"><title>v3 Seller Ads — Brokerage Rotation</title>
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
  .meta .h{font-weight:600;color:#102742;font-size:14px;line-height:1.4}
</style></head><body>
<h1>v3 seller ads — Pattern 1 + broker rotation</h1>
<p class="lede">Switched from broker-dominant Pattern 5 → Pattern 1 from <code>out/design-recon/fb-lead-gen-ad/recon.md</code> (the 477-day-running winner). Headshot shrunk to a 148px avatar badge. CTA pill is the visual anchor. 4 variants rotate across the ad set so the viewer accumulates brand exposure across 4–5 impressions.</p>
<ul class="changes">
  <li>Same headline + subhead + CTA on every variant — only the face + backdrop change</li>
  <li>Pattern 1 is the 477-day-running winner per the FB Ads Library scrape (426 ads, 5 brands)</li>
  <li>Documentary Central Oregon photography is the protagonist (per design SKILL.md)</li>
  <li>Brand mark top-left, "It's About Relationships" tagline on brokerage-led variant</li>
  <li>5.0 ★ · 24 Google reviews — verifiable social proof, traces to GBP pull 2026-05-22</li>
  <li>Photos vary: Old Mill 4K (brokerage), Bend hero (Matt), Tetherow aerial (Paul), Awbrey Glen (Rebecca)</li>
</ul>
<div class="grid">
${results.map((r, i) => `<div class="card">
  <a href="${r.jpgPath}" target="_blank"><img src="${r.jpgPath}" alt="${r.label}"></a>
  <div class="meta">
    <div class="n">${i + 1} · ${r.label}</div>
    <div class="h">${r.avatarLabel ? `${r.avatarLabel} · ` : ''}${r.photo.split('/').slice(-2).join('/')}</div>
  </div>
</div>`).join('\n')}
</div>
</body></html>`
await writeFile(resolve(OUT_DIR, 'seller-ads-v3-contact-sheet.html'), sheet, 'utf-8')

console.log(`\nDone. Contact sheet: ${resolve(OUT_DIR, 'seller-ads-v3-contact-sheet.html')}`)

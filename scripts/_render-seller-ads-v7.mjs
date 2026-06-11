#!/usr/bin/env node
/**
 * v7 seller-lead ads — Matt's full spec 2026-05-28.
 *
 * Layout (every variant):
 *   [Photo background full-bleed]
 *   [Brand mark top-left]
 *   [Quote LEFT]              [Broker RIGHT, transparent, ~28% wide]
 *   [Headline]
 *   [Trust line]
 *   [Sub-CTA explanation]
 *   [Button: Start Now]
 *
 * Broker selection rules:
 *   - Review references "Ryan Realty" (brokerage) → team transparent PNG
 *   - Review references Matt directly → Matt transparent PNG
 *
 * 10 variants, 10 unique headlines (life-stage / future-focused, none are
 * "what's your home worth" hard-sell clichés).
 *
 * Backgrounds rotate through landscapes / exteriors / interiors per Matt:
 *   1-5: landscape (Old Mill, Tower Theater, Pronghorn, Tetherow, Three Sisters)
 *   6-7: exterior (Tumalo hero, Tumalo aerial dusk)
 *   8-10: interior (living, kitchen, primary BR)
 *
 * Reviews verbatim from GBP corpus 2026-05-22.
 *
 * Skills loaded: design_system/ryan-realty/SKILL.md, brand-voice rules,
 * facebook-lead-gen-ad/SKILL.md (drives /lp/seller-home-value).
 */
import { chromium } from 'playwright'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'out/seller-ad-concepts/v7')

const FONTS_CSS = `
  @font-face { font-family: 'Amboqia'; src: url('${ROOT}/design_system/ryan-realty/fonts/Amboqia_Boriango.otf') format('opentype'); font-display: block; }
  @font-face { font-family: 'Azo Sans'; src: url('${ROOT}/design_system/ryan-realty/fonts/AzoSans-Medium.ttf') format('truetype'); font-display: block; }
`

const MATT = `${ROOT}/design_system/ryan-realty/assets/team/matt-ryan.png`
const TEAM = `${ROOT}/design_system/ryan-realty/assets/team/team-transparent.png`

const TRUST_LINE = 'Go with the team Bend trusts.'
const SUB_CTA = 'Get a professional opinion of value from local Bend brokers, not a Zestimate.'
const BUTTON = 'Start Now'

const VARIANTS = [
  {
    slug: '01-make-a-move-old-mill',
    headline: 'Are you considering making a move?',
    badge: 'team',
    quote: 'I highly recommend Ryan Realty for both buying and selling.',
    reviewer: 'Doug Millard · Google review',
    bg: `${ROOT}/design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg`,
    bgFocus: 'center 38%',
  },
  {
    slug: '02-next-chapter-tower',
    headline: 'What does your next chapter look like?',
    badge: 'matt',
    quote: 'Attention to detail and art of the negotiations with data.',
    reviewer: 'Ernie Oster · Google review · May 2026',
    bg: `${ROOT}/public/lp/central-oregon-golf/img/bend-cascades-01.jpg`,
    bgFocus: 'center 50%',
  },
  {
    slug: '03-selling-future-pronghorn',
    headline: 'Is selling in your future?',
    badge: 'matt',
    quote: 'The most professional, communicative, and honest broker I have ever worked with.',
    reviewer: 'Douglas Grant · Google review · Feb 2026',
    bg: `${ROOT}/public/lp/tetherow/img/tetherow-course-118.jpg`,
    bgFocus: 'center 50%',
  },
  {
    slug: '04-home-worth-today-tetherow',
    headline: 'Want to know what your home is worth today?',
    badge: 'team',
    quote: 'Matt with Ryan Realty was great to work with.',
    reviewer: 'D. Detweiler · Google review',
    bg: `${ROOT}/public/lp/tetherow/img/tetherow-aerial-course.jpg`,
    bgFocus: 'center 35%',
  },
  {
    slug: '05-change-in-bend-three-sisters',
    headline: 'Thinking about a change in Bend?',
    badge: 'matt',
    quote: 'Sold our home faster than we expected, even in a tough market.',
    reviewer: 'Audra Hedberg · Google review',
    bg: `${ROOT}/out/design-recon/fb-lead-gen-ad/examples/0001.jpg`,
    bgFocus: 'center 50%',
  },
  {
    slug: '06-equity-could-do-tumalo-exterior',
    headline: 'Curious what your equity could do?',
    badge: 'matt',
    quote: 'Patient, low pressure with us. Expert guidance.',
    reviewer: 'Gary Timms · Google review',
    bg: `${ROOT}/public/template-picker/list-kits/19496-tumalo-reservoir/v3/pattern-a/01-hero-primary.jpg`,
    bgFocus: 'center 50%',
  },
  {
    slug: '07-wondering-home-value-tumalo-dusk',
    headline: 'Have you been wondering about your home’s value?',
    badge: 'matt',
    quote: 'As a Realtor Broker with 23 years of full-time service, I know what it takes.',
    reviewer: 'Helen Luna Fess · Google review',
    bg: `${ROOT}/public/template-picker/list-kits/19496-tumalo-reservoir/v3/pattern-a/02-aerial-dusk-1.jpg`,
    bgFocus: 'center 50%',
  },
  {
    slug: '08-whats-next-tumalo-living',
    headline: 'Ready for what comes next?',
    badge: 'matt',
    quote: 'We selected Matt to represent us in the estate sale.',
    reviewer: 'Jim Creekmore · Google review',
    bg: `${ROOT}/public/template-picker/list-kits/19496-tumalo-reservoir/v3/pattern-a/05-living.jpg`,
    bgFocus: 'center 50%',
  },
  {
    slug: '09-right-time-to-sell-tumalo-kitchen',
    headline: 'Is now the right time to sell?',
    badge: 'matt',
    quote: 'Driven, honest and hard working without the high pressure.',
    reviewer: 'Charise Millard · Google review',
    bg: `${ROOT}/public/template-picker/list-kits/19496-tumalo-reservoir/v3/pattern-a/06-kitchen.jpg`,
    bgFocus: 'center 50%',
  },
  {
    slug: '10-what-would-home-sell-tumalo-br',
    headline: 'What would your home sell for in today’s market?',
    badge: 'team',
    quote: 'I highly recommend Ryan Realty for both buying and selling.',
    reviewer: 'Doug Millard · Google review',
    bg: `${ROOT}/public/template-picker/list-kits/19496-tumalo-reservoir/v3/pattern-a/07-primary-br.jpg`,
    bgFocus: 'center 50%',
  },
]

function html(v) {
  const isTeam = v.badge === 'team'
  // Team badge: landscape (1024x600), placed wider but shorter
  // Matt badge: portrait (800x1200), placed taller but narrower
  const badgeCSS = isTeam
    ? `right:42px;top:130px;width:330px;height:194px;background:url('file://${TEAM}') center top/contain no-repeat`
    : `right:54px;top:90px;width:280px;height:420px;background:url('file://${MATT}') center top/contain no-repeat;filter:drop-shadow(-6px 4px 18px rgba(0,0,0,0.45))`

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONTS_CSS}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:1080px;height:1080px;overflow:hidden;background:#102742;color:#faf8f4;font-family:'Azo Sans',sans-serif;position:relative}

    /* Photo full-bleed */
    .photo{position:absolute;inset:0;background:url('file://${v.bg}') ${v.bgFocus}/cover no-repeat;z-index:1}

    /* Scrim — heavier at bottom for text legibility, lighter top to keep photo visible */
    .scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,39,66,0.55) 0%,rgba(16,39,66,0.30) 25%,rgba(16,39,66,0.55) 55%,rgba(16,39,66,0.88) 100%);z-index:2}

    /* Brand mark top-left */
    .brand{position:absolute;top:44px;left:64px;z-index:5;font-family:'Amboqia',serif;font-size:24px;letter-spacing:0.02em;color:#faf8f4;text-shadow:0 2px 12px rgba(0,0,0,0.5)}
    .brand-sub{font-family:'Azo Sans',sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(250,248,244,0.82);margin-top:5px}

    /* Quote LEFT, sized to sit beside the broker badge */
    .quote{position:absolute;left:64px;top:${isTeam ? '170px' : '180px'};width:620px;z-index:4}
    .quote-mark{font-family:'Amboqia',serif;font-size:52px;color:rgba(250,248,244,0.55);line-height:0.5;margin-bottom:10px;text-shadow:0 2px 10px rgba(0,0,0,0.45)}
    .quote-text{font-family:'Amboqia',serif;font-size:24px;line-height:1.30;color:rgba(250,248,244,0.92);letter-spacing:-0.005em;font-style:italic;text-shadow:0 2px 14px rgba(0,0,0,0.55)}
    .quote-attr{font-family:'Azo Sans',sans-serif;font-size:12px;letter-spacing:0.10em;text-transform:uppercase;color:rgba(250,248,244,0.75);margin-top:14px;text-shadow:0 2px 8px rgba(0,0,0,0.5)}

    /* Broker badge RIGHT, transparent, NOT half the ad */
    .badge{position:absolute;z-index:3;${badgeCSS}}

    /* Headline */
    .headline{position:absolute;left:64px;right:64px;top:580px;font-family:'Amboqia',serif;font-size:56px;line-height:1.06;color:#faf8f4;letter-spacing:-0.015em;z-index:4;text-shadow:0 2px 18px rgba(0,0,0,0.55);max-width:880px}

    /* Trust line */
    .trust{position:absolute;left:64px;right:64px;top:735px;font-family:'Azo Sans',sans-serif;font-size:21px;font-weight:500;color:rgba(250,248,244,0.92);letter-spacing:0.01em;z-index:4;text-shadow:0 2px 10px rgba(0,0,0,0.5)}

    /* Sub-CTA explanation */
    .sub-cta{position:absolute;left:64px;right:64px;top:780px;font-family:'Azo Sans',sans-serif;font-size:17px;font-weight:500;color:rgba(250,248,244,0.78);line-height:1.45;letter-spacing:0.005em;z-index:4;text-shadow:0 2px 10px rgba(0,0,0,0.45);max-width:820px}

    /* Button: Start Now */
    .btn{position:absolute;left:64px;bottom:64px;background:#faf8f4;color:#102742;padding:22px 44px;border-radius:14px;font-family:'Azo Sans',sans-serif;font-size:22px;font-weight:600;letter-spacing:0.02em;display:inline-flex;align-items:center;gap:14px;box-shadow:0 12px 32px rgba(0,0,0,0.4);z-index:5}
    .btn .arrow{font-size:24px;line-height:1}
  </style></head><body>
    <div class="photo"></div>
    <div class="scrim"></div>
    <div class="brand">Ryan Realty<div class="brand-sub">Bend, Oregon</div></div>

    <div class="quote">
      <div class="quote-mark">"</div>
      <div class="quote-text">${v.quote}</div>
      <div class="quote-attr">${v.reviewer}</div>
    </div>

    <div class="badge"></div>

    <div class="headline">${v.headline}</div>
    <div class="trust">${TRUST_LINE}</div>
    <div class="sub-cta">${SUB_CTA}</div>

    <div class="btn">${BUTTON} <span class="arrow">→</span></div>
  </body></html>`
}

await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

const results = []
for (let i = 0; i < VARIANTS.length; i++) {
  const v = VARIANTS[i]
  const htmlPath = resolve(OUT_DIR, `seller-v7-${v.slug}.html`)
  const jpgPath = resolve(OUT_DIR, `seller-v7-${v.slug}.jpg`)
  await writeFile(htmlPath, html(v), 'utf-8')
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1080, height: 1080 } })
  console.log(`  ${i + 1}/${VARIANTS.length}  ${v.slug}`)
  results.push({ ...v, jpgPath: `seller-v7-${v.slug}.jpg` })
}

await browser.close()

const sheet = `<!doctype html><html><head><meta charset="utf-8"><title>v7 Seller Ads — 10 Variations</title>
<style>
  body{font-family:-apple-system,sans-serif;background:#faf8f4;color:#102742;margin:0;padding:32px}
  h1{margin:0 0 6px;font-size:24px;font-weight:600}
  p.lede{color:#5b6478;margin:0 0 8px;max-width:920px;line-height:1.55}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(420px,1fr));gap:24px;max-width:1300px;margin:0 auto}
  .card{background:#fff;border:1px solid rgba(16,39,66,0.12);border-radius:14px;overflow:hidden}
  .card img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover}
  .meta{padding:14px 18px;font-size:13px}
  .meta .n{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#5b6478;margin-bottom:4px}
  .meta .h{font-weight:600;color:#102742;font-size:14px;line-height:1.4;margin-bottom:4px}
  .meta .b{color:#5b6478;font-size:12px;line-height:1.4}
  .meta .b strong{color:#102742;font-weight:500}
</style></head><body>
<h1>v7 seller ads — 10 variations per spec</h1>
<p class="lede">Layout: photo background, broker right (transparent, ~28%, NOT half), quote left of broker, then headline + trust line + sub-CTA + Start Now button stacked below. 10 unique life-stage headlines. Reviews referencing Ryan Realty → team transparent. Reviews referencing Matt → Matt transparent.</p>
<div class="grid">
${results.map((r, i) => `<div class="card">
  <a href="${r.jpgPath}" target="_blank"><img src="${r.jpgPath}" alt="${r.headline}"></a>
  <div class="meta">
    <div class="n">${String(i + 1).padStart(2, '0')} · ${r.badge.toUpperCase()} · ${r.bg.split('/').slice(-2).join('/')}</div>
    <div class="h">${r.headline}</div>
    <div class="b"><strong>${r.reviewer.split(' · ')[0]}:</strong> "${r.quote}"</div>
  </div>
</div>`).join('\n')}
</div>
</body></html>`

await writeFile(resolve(OUT_DIR, 'seller-ads-v7-contact-sheet.html'), sheet, 'utf-8')

console.log(`\nDone. Contact sheet: ${resolve(OUT_DIR, 'seller-ads-v7-contact-sheet.html')}`)

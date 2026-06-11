#!/usr/bin/env node
/**
 * Seller-lead ads — Pattern A from the approved Tumalo v3 reference.
 * The photo IS the post. Zero overlay. No broker, no headline, no review,
 * no CTA pill, no logo on the image.
 *
 * Copy lives in FB's text fields per facebook-lead-gen-ad SKILL §4.3.
 * See out/seller-ad-concepts/pattern-a/copy-deck.md for the matching copy.
 *
 * Output: 6 clean 1080x1080 Bend photos at JPG quality 92.
 */
import { chromium } from 'playwright'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'out/seller-ad-concepts/pattern-a')

const PHOTOS = [
  {
    slug: 'old-mill-canonical',
    label: 'Old Mill District — canonical 4K brand hero',
    source: `${ROOT}/design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg`,
    focus: 'center 38%',
    notes: 'Three smokestacks, American flag, Deschutes River with kayakers, Cascade horizon. The brand-locked canonical hero per design SKILL.',
  },
  {
    slug: 'tower-theater-night',
    label: 'Tower Theater — downtown Bend at night',
    source: `${ROOT}/public/lp/central-oregon-golf/img/bend-cascades-01.jpg`,
    focus: 'center 50%',
    notes: 'Iconic downtown neon. Scroll-stopping at thumb scale. Distinct register from all the daytime aerials.',
  },
  {
    slug: 'pronghorn-mt-bachelor',
    label: 'Pronghorn green with Mt. Bachelor',
    source: `${ROOT}/public/lp/tetherow/img/tetherow-course-118.jpg`,
    focus: 'center 50%',
    notes: 'Snow-capped Mt. Bachelor on the horizon, red flag pin on the green. The strongest single Bend-lifestyle shot in the asset library.',
  },
  {
    slug: 'tetherow-aerial',
    label: 'Tetherow Resort — aerial course',
    source: `${ROOT}/public/lp/tetherow/img/tetherow-aerial-course.jpg`,
    focus: 'center 35%',
    notes: 'Aerial Tetherow course with the Cascade horizon and resort homes. Represents the high-end Westside.',
  },
  {
    slug: 'old-mill-bridge',
    label: 'Old Mill bridge with festival flags',
    source: `${ROOT}/public/lp/central-oregon-golf/img/bend-cascades-03.jpg`,
    focus: 'center 55%',
    notes: 'Old Mill from the water angle. Bridge with colorful flags, smokestacks, blue sky. Warmer, more festive than the canonical hero.',
  },
  {
    slug: 'three-sisters-mountains',
    label: 'Three Sisters mountain horizon (Sisters area)',
    source: `${ROOT}/out/design-recon/fb-lead-gen-ad/examples/0001.jpg`,
    focus: 'center 50%',
    notes: 'Snow-capped Three Sisters peaks with horse fence in foreground. Sisters/Tumalo register. This same composition is the longest-running organic ad pattern across our recon set.',
  },
]

async function renderClean(photo, page) {
  const htmlPath = resolve(OUT_DIR, `_temp-${photo.slug}.html`)
  const jpgPath = resolve(OUT_DIR, `pattern-a-${photo.slug}.jpg`)

  // Zero overlay. Photo only, properly cropped to 1080x1080.
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:1080px;height:1080px;overflow:hidden;background:#000}
    .photo{position:absolute;inset:0;background:url('file://${photo.source}') ${photo.focus}/cover no-repeat}
  </style></head><body><div class="photo"></div></body></html>`

  await writeFile(htmlPath, html, 'utf-8')
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1080, height: 1080 } })
  return jpgPath
}

await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

const results = []
for (let i = 0; i < PHOTOS.length; i++) {
  const p = PHOTOS[i]
  await renderClean(p, page)
  console.log(`  ${i + 1}/${PHOTOS.length}  ${p.slug}`)
  results.push({ ...p, jpgPath: `pattern-a-${p.slug}.jpg` })
}

await browser.close()

// Clean up temp html files
const { readdir, unlink } = await import('node:fs/promises')
const tmpFiles = (await readdir(OUT_DIR)).filter((f) => f.startsWith('_temp-'))
for (const f of tmpFiles) await unlink(resolve(OUT_DIR, f))

const sheet = `<!doctype html><html><head><meta charset="utf-8"><title>Pattern A — Clean Bend photos</title>
<style>
  body{font-family:-apple-system,sans-serif;background:#faf8f4;color:#102742;margin:0;padding:32px}
  h1{margin:0 0 6px;font-size:24px;font-weight:600}
  p.lede{color:#5b6478;margin:0 0 8px;max-width:920px;line-height:1.55}
  ul.principle{color:#5b6478;font-size:13px;line-height:1.7;margin:0 0 24px;padding-left:20px;max-width:920px}
  ul.principle li strong{color:#102742}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(420px,1fr));gap:24px;max-width:1300px;margin:0 auto}
  .card{background:#fff;border:1px solid rgba(16,39,66,0.12);border-radius:14px;overflow:hidden}
  .card img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover}
  .meta{padding:16px 18px;font-size:13px}
  .meta .n{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#5b6478;margin-bottom:6px}
  .meta .h{font-weight:600;color:#102742;font-size:14px;line-height:1.4;margin-bottom:6px}
  .meta .s{color:#5b6478;font-size:12px;line-height:1.45}
  .copy-note{background:#fff;border:1px solid rgba(16,39,66,0.12);border-radius:14px;padding:24px 28px;max-width:1248px;margin:24px auto}
  .copy-note h2{font-size:18px;margin:0 0 8px;color:#102742}
  .copy-note p{margin:0 0 8px;color:#5b6478;line-height:1.5;font-size:13px}
  .copy-note code{background:#f2ebdd;padding:2px 6px;border-radius:4px;font-size:12px}
</style></head><body>
<h1>Seller-lead ads — Pattern A (the approved spec)</h1>
<p class="lede">From the locked Tumalo v3 reference: <em>"The professionally-shot photo carries the entire post. Every text element lives in the caption beneath."</em> Dominant pattern across Sotheby's, Compass, Hilton &amp; Hyland, Douglas Elliman, Aaron Kirman, Oppenheim Group, NestSeekers.</p>
<ul class="principle">
  <li><strong>Zero overlay.</strong> No headline, no review quote, no CTA pill, no broker face, no logo.</li>
  <li><strong>Per facebook-lead-gen-ad SKILL §10:</strong> brand-led campaigns omit the broker headshot.</li>
  <li><strong>Copy lives in FB's text fields.</strong> See <code>copy-deck.md</code> next to these renders.</li>
  <li><strong>All variants drive to</strong> <code>/lp/seller-home-value</code>.</li>
</ul>
<div class="copy-note">
  <h2>How to use these</h2>
  <p>In Meta Ads Manager: upload each photo as a separate creative, pair with the matching copy block from <code>copy-deck.md</code>. Test combinations. The algorithm learns which photo + copy combo wins.</p>
  <p>For Reels / Stories placements (9:16), Meta auto-handles the crop or you re-render in portrait. These 1:1 squares are optimized for Feed.</p>
</div>
<div class="grid">
${results.map((r, i) => `<div class="card">
  <a href="${r.jpgPath}" target="_blank"><img src="${r.jpgPath}" alt="${r.label}"></a>
  <div class="meta">
    <div class="n">${i + 1} · 1080×1080 · JPG q92</div>
    <div class="h">${r.label}</div>
    <div class="s">${r.notes}</div>
  </div>
</div>`).join('\n')}
</div>
</body></html>`

await writeFile(resolve(OUT_DIR, 'pattern-a-contact-sheet.html'), sheet, 'utf-8')

console.log(`\nDone. Contact sheet: ${resolve(OUT_DIR, 'pattern-a-contact-sheet.html')}`)

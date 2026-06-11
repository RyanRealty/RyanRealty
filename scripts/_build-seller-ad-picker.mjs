#!/usr/bin/env node
/**
 * Build a PICKER page for the seller-lead ad project.
 * Shows: photo options (asset library + Pexels + Unsplash) + copy options + CTA options.
 * Matt picks. We build the final ads from his picks.
 *
 * Output: out/seller-ad-concepts/picker/picker.html
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'out/seller-ad-concepts/picker')

// Load .env.local
const envPath = resolve(ROOT, '.env.local')
const envText = await readFile(envPath, 'utf-8')
const env = {}
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
}

const PEXELS_KEY = env.PEXELS_API_KEY
const UNSPLASH_KEY = env.UNSPLASH_ACCESS_KEY

await mkdir(OUT_DIR, { recursive: true })
await mkdir(resolve(OUT_DIR, 'pexels'), { recursive: true })
await mkdir(resolve(OUT_DIR, 'unsplash'), { recursive: true })

// ============================================================
// 1. CURATE ASSET LIBRARY — only the GOOD ones, not entrance signs
// ============================================================
const ASSET_LIBRARY = [
  {
    slug: 'asset-old-mill-canonical',
    label: 'Old Mill District — canonical 4K hero',
    notes: 'Three smokestacks, American flag, Deschutes River with kayakers, Cascade horizon. The brand-locked iconic hero.',
    path: 'design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg',
    category: 'landscape',
  },
  {
    slug: 'asset-pronghorn-mt-bachelor',
    label: 'Pronghorn green + Mt. Bachelor',
    notes: 'Snow-capped Mt. Bachelor on horizon, red flag pin on the green. Aspirational Bend lifestyle.',
    path: 'public/lp/tetherow/img/tetherow-course-118.jpg',
    category: 'landscape',
  },
  {
    slug: 'asset-tower-theater-night',
    label: 'Tower Theater — downtown neon',
    notes: 'Iconic Bend downtown landmark, neon at night, long exposure street trails.',
    path: 'public/lp/central-oregon-golf/img/bend-cascades-01.jpg',
    category: 'landscape',
  },
  {
    slug: 'asset-three-sisters-pasture',
    label: 'Three Sisters mountains + horse fence',
    notes: 'Snow-capped Three Sisters with classic Central Oregon ranch pasture in foreground.',
    path: 'out/design-recon/fb-lead-gen-ad/examples/0001.jpg',
    category: 'landscape',
  },
  {
    slug: 'asset-tetherow-aerial',
    label: 'Tetherow Resort — aerial course',
    notes: 'Aerial Tetherow course with Cascade horizon and resort homes.',
    path: 'public/lp/tetherow/img/tetherow-aerial-course.jpg',
    category: 'landscape',
  },
  {
    slug: 'asset-old-mill-bridge',
    label: 'Old Mill bridge with festival flags',
    notes: 'Old Mill from water angle. Colorful bridge flags, smokestacks, blue sky. Warmer/festive register.',
    path: 'public/lp/central-oregon-golf/img/bend-cascades-03.jpg',
    category: 'landscape',
  },
]

// ============================================================
// 2. QUERY PEXELS — beautiful landscapes + interiors
// ============================================================
const PEXELS_QUERIES = [
  { query: 'Bend Oregon', cat: 'landscape', count: 4 },
  { query: 'Mount Bachelor Cascade Oregon', cat: 'landscape', count: 4 },
  { query: 'Deschutes River Oregon', cat: 'landscape', count: 3 },
  { query: 'modern mountain home interior', cat: 'interior', count: 5 },
  { query: 'luxury modern living room', cat: 'interior', count: 4 },
  { query: 'modern luxury home exterior', cat: 'exterior', count: 4 },
  { query: 'Pacific Northwest pine forest', cat: 'landscape', count: 3 },
]

async function pexelsSearch(query, perPage = 5) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape&size=large`
  const res = await fetch(url, { headers: { Authorization: PEXELS_KEY } })
  if (!res.ok) {
    console.error(`Pexels error ${res.status} for "${query}"`)
    return []
  }
  const data = await res.json()
  return (data.photos || []).map((p) => ({
    id: p.id,
    src: p.src.large2x || p.src.large,
    photographer: p.photographer,
    alt: p.alt || query,
    url: p.url,
    query,
  }))
}

console.log('Querying Pexels...')
const pexelsResults = []
for (const q of PEXELS_QUERIES) {
  const items = await pexelsSearch(q.query, q.count)
  for (const it of items) pexelsResults.push({ ...it, category: q.cat })
  console.log(`  ${q.query} → ${items.length} results`)
}

// Download Pexels images locally so they render in the picker offline
async function downloadImage(url, outPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(outPath, buf)
}

console.log('Downloading Pexels images...')
for (let i = 0; i < pexelsResults.length; i++) {
  const p = pexelsResults[i]
  const localName = `pexels-${String(i + 1).padStart(2, '0')}-${p.id}.jpg`
  const localPath = resolve(OUT_DIR, 'pexels', localName)
  if (!existsSync(localPath)) {
    try {
      await downloadImage(p.src, localPath)
    } catch (e) {
      console.error(`  failed ${p.id}: ${e.message}`)
      continue
    }
  }
  p.localPath = `pexels/${localName}`
}
console.log(`  ${pexelsResults.length} Pexels images ready`)

// ============================================================
// 3. QUERY UNSPLASH
// ============================================================
const UNSPLASH_QUERIES = [
  { query: 'Bend Oregon', cat: 'landscape', count: 4 },
  { query: 'Cascade mountains Oregon', cat: 'landscape', count: 3 },
  { query: 'modern mountain cabin', cat: 'exterior', count: 4 },
  { query: 'minimalist modern living room', cat: 'interior', count: 4 },
  { query: 'modern kitchen Pacific Northwest', cat: 'interior', count: 3 },
]

async function unsplashSearch(query, perPage = 5) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } })
  if (!res.ok) {
    console.error(`Unsplash error ${res.status} for "${query}"`)
    return []
  }
  const data = await res.json()
  return (data.results || []).map((p) => ({
    id: p.id,
    src: p.urls.regular,
    photographer: p.user.name,
    alt: p.alt_description || query,
    url: p.links.html,
    query,
  }))
}

console.log('Querying Unsplash...')
const unsplashResults = []
for (const q of UNSPLASH_QUERIES) {
  const items = await unsplashSearch(q.query, q.count)
  for (const it of items) unsplashResults.push({ ...it, category: q.cat })
  console.log(`  ${q.query} → ${items.length} results`)
}

console.log('Downloading Unsplash images...')
for (let i = 0; i < unsplashResults.length; i++) {
  const p = unsplashResults[i]
  const localName = `unsplash-${String(i + 1).padStart(2, '0')}-${p.id}.jpg`
  const localPath = resolve(OUT_DIR, 'unsplash', localName)
  if (!existsSync(localPath)) {
    try {
      await downloadImage(p.src, localPath)
    } catch (e) {
      console.error(`  failed ${p.id}: ${e.message}`)
      continue
    }
  }
  p.localPath = `unsplash/${localName}`
}
console.log(`  ${unsplashResults.length} Unsplash images ready`)

// ============================================================
// 4. COPY OPTIONS (research-backed, deduplicated)
// ============================================================
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
  'How much has your home appreciated?',
]

const TRUST_LINES = [
  'Go with the team Bend trusts.',
  'Bend’s trusted local brokerage.',
  'Where Bend goes to sell.',
  'Local team. Five-star rated. Bend through and through.',
  'Trusted by your Bend neighbors.',
  'Your local Bend brokerage — five stars across every review.',
]

const SUB_CTAS = [
  'Get a professional opinion of value from local Bend brokers, not a Zestimate.',
  'A real estimate built from real Bend sales — not an algorithm guess.',
  'A free professional market analysis from local Bend brokers. No phone call.',
  'Skip the Zestimate. Get a real value from the brokers Bend trusts.',
  'A real human estimate from local brokers who close Bend deals weekly.',
]

const REVIEW_QUOTES = [
  { quote: 'Attention to detail and art of the negotiations with data.', author: 'Ernie Oster', mentions: 'matt' },
  { quote: 'The most professional, communicative, and honest broker I have ever worked with.', author: 'Douglas Grant', mentions: 'matt' },
  { quote: 'Sold our home faster than we expected, even in a tough market.', author: 'Audra Hedberg', mentions: 'matt' },
  { quote: 'Patient, low pressure with us. Expert guidance.', author: 'Gary Timms', mentions: 'matt' },
  { quote: 'As a Realtor Broker with 23 years of full-time service, I know what it takes.', author: 'Helen Luna Fess', mentions: 'matt' },
  { quote: 'We selected Matt to represent us in the estate sale.', author: 'Jim Creekmore', mentions: 'matt' },
  { quote: 'Driven, honest and hard working without the high pressure.', author: 'Charise Millard', mentions: 'matt' },
  { quote: 'I highly recommend Ryan Realty for both buying and selling.', author: 'Doug Millard', mentions: 'ryan-realty' },
  { quote: 'Matt with Ryan Realty was great to work with.', author: 'D. Detweiler', mentions: 'ryan-realty' },
]

const CTAS_BUTTON_VISUAL = [
  { text: 'Start Now', notes: 'Matt’s lead pick. Action verb, momentum.' },
  { text: 'Get My Estimate', notes: 'First-person, outcome-focused.' },
  { text: 'See My Home Value', notes: 'Outcome-named, low friction.' },
  { text: 'Get a Real Estimate', notes: 'Anti-algorithm framing.' },
  { text: 'Find Out Now', notes: 'Curiosity + immediacy.' },
  { text: 'Contact Ryan Realty', notes: 'For ready-to-go variant — direct path.' },
  { text: 'Reach Out Today', notes: 'Conversational, low pressure.' },
  { text: 'Start Today', notes: 'Action + immediacy, less aggressive than Start Now.' },
]

const CTAS_FB_BUTTON = [
  { code: 'GET_QUOTE', text: 'Get Quote', notes: 'Used by Kristi Weinstock’s 6-year-running ad.' },
  { code: 'GET_OFFER', text: 'Get Offer', notes: 'Implies a deliverable.' },
  { code: 'LEARN_MORE', text: 'Learn More', notes: 'Most common across long-running winners.' },
  { code: 'SIGN_UP', text: 'Sign Up', notes: 'Conversion-tuned default for lead-gen.' },
  { code: 'BOOK_NOW', text: 'Book Now', notes: 'If we frame around a CMA call.' },
]

// ============================================================
// 5. RENDER THE PICKER PAGE
// ============================================================
const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Ryan Realty seller-lead ad picker</title>
<style>
  :root{--navy:#102742;--cream:#faf8f4;--soft:rgba(16,39,66,0.6);--rule:rgba(16,39,66,0.12)}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,sans-serif;background:#f4f0e8;color:var(--navy);padding:0;line-height:1.5}
  .page{max-width:1480px;margin:0 auto;padding:32px 32px 80px}
  h1{font-size:30px;font-weight:700;margin:0 0 6px}
  p.lede{color:var(--soft);max-width:920px;margin:0 0 32px;font-size:15px;line-height:1.55}
  h2{font-size:22px;font-weight:600;margin:48px 0 6px;padding-bottom:8px;border-bottom:1px solid var(--rule)}
  h3{font-size:14px;font-weight:600;margin:24px 0 12px;text-transform:uppercase;letter-spacing:0.08em;color:var(--soft)}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-bottom:28px}
  .photo-card{background:#fff;border:1px solid var(--rule);border-radius:10px;overflow:hidden;transition:transform 0.15s,box-shadow 0.15s;cursor:pointer}
  .photo-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(16,39,66,0.12)}
  .photo-card img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}
  .photo-card .pmeta{padding:10px 12px;font-size:11px}
  .photo-card .ptag{font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);margin-bottom:3px;font-weight:600}
  .photo-card .ptitle{font-size:12px;color:var(--navy);font-weight:600;line-height:1.3;margin-bottom:3px}
  .photo-card .pby{font-size:10px;color:var(--soft)}
  .photo-card .pid{font-family:monospace;font-size:10px;color:var(--soft);margin-top:4px;word-break:break-all}
  .copy-list{background:#fff;border:1px solid var(--rule);border-radius:10px;padding:0;list-style:none}
  .copy-list li{padding:14px 18px;border-bottom:1px solid var(--rule);font-size:15px;display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
  .copy-list li:last-child{border-bottom:none}
  .copy-list li:hover{background:rgba(16,39,66,0.03)}
  .copy-list .num{font-family:monospace;font-size:11px;color:var(--soft);min-width:32px}
  .copy-list .ctext{flex:1;color:var(--navy)}
  .copy-list .cnotes{color:var(--soft);font-size:12px;font-style:italic;text-align:right;max-width:280px}
  .quote-list li{flex-direction:column;align-items:flex-start;gap:6px}
  .quote-list .who{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--soft);font-weight:600}
  .quote-list .badge{display:inline-block;font-size:9px;padding:2px 8px;border-radius:99px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase}
  .quote-list .badge.matt{background:#102742;color:#faf8f4}
  .quote-list .badge.team{background:#e8e2d4;color:#102742}
  .instructions{background:#fff;border:1px solid var(--rule);border-radius:10px;padding:20px 24px;margin:0 0 32px;font-size:14px;line-height:1.6}
  .instructions strong{color:var(--navy)}
  .instructions code{background:#f2ebdd;padding:1px 6px;border-radius:4px;font-size:13px}
</style></head>
<body><div class="page">

<h1>Seller-lead ad picker</h1>
<p class="lede">Pick your photos, copy, and CTAs. Send me your choices. I build the final ads from your picks. No more autonomous selection — these are all the options, you choose.</p>

<div class="instructions">
  <strong>How to use this picker:</strong> Browse each section. Tell me which photos you want (by ID), which headline you want (by number), which trust line, which sub-CTA, which review quotes, and which CTA buttons. Format your reply however you want — even just “P3, P11, U2, H4, T1, S2, Q1, Q8, CTA: Start Now, FB: Get Quote” works.
  <br><br>
  <strong>Photo categories:</strong> <code>landscape</code> (Bend lifestyle / mountain / aerial) — <code>exterior</code> (homes outside) — <code>interior</code> (homes inside)
  <br><br>
  <strong>Review quote rule:</strong> reviews tagged <span class="badge matt" style="display:inline-block;margin:0 4px;font-size:9px;padding:2px 8px;border-radius:99px;background:#102742;color:#faf8f4;font-weight:600;letter-spacing:0.06em">MATT</span> use Matt’s solo headshot. Reviews tagged <span class="badge team" style="display:inline-block;margin:0 4px;font-size:9px;padding:2px 8px;border-radius:99px;background:#e8e2d4;color:#102742;font-weight:600;letter-spacing:0.06em">TEAM</span> use the three-broker transparent.
</div>

<h2>1. Photos — pick the ones you love</h2>

<h3>From the asset library (already approved, on-brand)</h3>
<div class="grid">
${ASSET_LIBRARY.map((a, i) => `
  <div class="photo-card">
    <img src="../../../${a.path}" alt="${a.label}">
    <div class="pmeta">
      <div class="ptag">A${i + 1} · ${a.category}</div>
      <div class="ptitle">${a.label}</div>
      <div class="pby">${a.notes}</div>
    </div>
  </div>`).join('')}
</div>

<h3>Pexels (free commercial use, photographer credited)</h3>
<div class="grid">
${pexelsResults.map((p, i) => `
  <div class="photo-card">
    <img src="${p.localPath}" alt="${p.alt}">
    <div class="pmeta">
      <div class="ptag">P${i + 1} · ${p.category}</div>
      <div class="ptitle">${p.alt.slice(0, 80)}</div>
      <div class="pby">© ${p.photographer} · Pexels</div>
      <div class="pid">id ${p.id}</div>
    </div>
  </div>`).join('')}
</div>

<h3>Unsplash (free commercial use, photographer credited)</h3>
<div class="grid">
${unsplashResults.map((p, i) => `
  <div class="photo-card">
    <img src="${p.localPath}" alt="${p.alt}">
    <div class="pmeta">
      <div class="ptag">U${i + 1} · ${p.category}</div>
      <div class="ptitle">${(p.alt || 'Untitled').slice(0, 80)}</div>
      <div class="pby">© ${p.photographer} · Unsplash</div>
      <div class="pid">id ${p.id}</div>
    </div>
  </div>`).join('')}
</div>

<h2>2. Headlines — pick one</h2>
<ol class="copy-list">
${HEADLINES.map((h, i) => `
  <li>
    <span class="num">H${i + 1}</span>
    <span class="ctext">${h}</span>
  </li>`).join('')}
</ol>

<h2>3. Trust lines — pick one</h2>
<ol class="copy-list">
${TRUST_LINES.map((t, i) => `
  <li>
    <span class="num">T${i + 1}</span>
    <span class="ctext">${t}</span>
  </li>`).join('')}
</ol>

<h2>4. Sub-CTA explanation — pick one</h2>
<ol class="copy-list">
${SUB_CTAS.map((s, i) => `
  <li>
    <span class="num">S${i + 1}</span>
    <span class="ctext">${s}</span>
  </li>`).join('')}
</ol>

<h2>5. Review quotes — pick the ones you want to feature</h2>
<ol class="copy-list quote-list">
${REVIEW_QUOTES.map((q, i) => `
  <li>
    <span class="num">Q${i + 1}</span>
    <span class="ctext">
      <span class="badge ${q.mentions}">${q.mentions === 'matt' ? 'MATT' : 'TEAM'}</span>
      “${q.quote}”
    </span>
    <span class="who">— ${q.author}</span>
  </li>`).join('')}
</ol>

<h2>6. Button text (drawn on the ad) — pick one</h2>
<ol class="copy-list">
${CTAS_BUTTON_VISUAL.map((c, i) => `
  <li>
    <span class="num">B${i + 1}</span>
    <span class="ctext">${c.text}</span>
    <span class="cnotes">${c.notes}</span>
  </li>`).join('')}
</ol>

<h2>7. FB lead-gen button (actual FB CTA) — pick one</h2>
<ol class="copy-list">
${CTAS_FB_BUTTON.map((c, i) => `
  <li>
    <span class="num">F${i + 1}</span>
    <span class="ctext">${c.text} <small style="color:var(--soft);font-family:monospace;margin-left:8px">${c.code}</small></span>
    <span class="cnotes">${c.notes}</span>
  </li>`).join('')}
</ol>

<div class="instructions" style="margin-top:48px">
  <strong>How to send me your picks:</strong>
  <br><br>
  <code>Photos: A1, A3, P5, P11, U2, U4</code>
  <br><code>Headline: H4</code>
  <br><code>Trust: T2</code>
  <br><code>Sub-CTA: S1</code>
  <br><code>Quotes: Q1, Q4, Q8</code>
  <br><code>Button: B1</code>
  <br><code>FB CTA: F1</code>
  <br><br>
  I will build the final set with the photos, copy, and CTA you choose. No more guessing on my end.
</div>

</div></body></html>`

await writeFile(resolve(OUT_DIR, 'picker.html'), html, 'utf-8')

// Save manifest with photographer credit + IDs for license trace
const manifest = {
  generated_at: new Date().toISOString(),
  asset_library: ASSET_LIBRARY,
  pexels: pexelsResults,
  unsplash: unsplashResults,
  headlines: HEADLINES,
  trust_lines: TRUST_LINES,
  sub_ctas: SUB_CTAS,
  review_quotes: REVIEW_QUOTES,
  cta_button_visual: CTAS_BUTTON_VISUAL,
  cta_fb_button: CTAS_FB_BUTTON,
}
await writeFile(resolve(OUT_DIR, 'picker-manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')

console.log(`\nDone.`)
console.log(`  Picker: ${resolve(OUT_DIR, 'picker.html')}`)
console.log(`  Manifest: ${resolve(OUT_DIR, 'picker-manifest.json')}`)
console.log(`  Asset library: ${ASSET_LIBRARY.length} curated`)
console.log(`  Pexels: ${pexelsResults.length} downloaded`)
console.log(`  Unsplash: ${unsplashResults.length} downloaded`)

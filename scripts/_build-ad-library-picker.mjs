#!/usr/bin/env node
/**
 * Build a self-contained ad-library picker HTML.
 * All thumbnails are base64-embedded so the file is fully standalone.
 * Output: out/meta-fix-2026-06-03/ad-library-picker.html
 */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const THUMB_DIR = resolve(ROOT, 'out/seller-ad-concepts/v10/thumbs')
const FULL_DIR  = resolve(ROOT, 'out/seller-ad-concepts/v10')
const OUT_DIR   = resolve(ROOT, 'out/meta-fix-2026-06-03')
await mkdir(OUT_DIR, { recursive: true })

// ── LIVE concepts ─────────────────────────────────────────────────────────────
const LIVE = new Set(['react-t2a-v1-bring-today', 'react-t2a-v2-out-of-state'])

// ── Multisize slugs (have 4:5 + 9:16 in addition to 1:1) ─────────────────────
const MULTISIZE_SLUGS = new Set([
  '08-out-of-area', '01-downsizing', '16-worth-now', '28-homes-like',
  'react-t1-v1-worth-today', 'react-t1-v2-make-a-move',
  'react-t2a-v1-bring-today', 'react-t2a-v2-out-of-state',
  'react-t2b-v1-west-bend-worth', 'react-t2b-v2-westside-going-for',
])

// ── Concept definitions — extracted from _render-seller-ads-v10.mjs ───────────
const CONCEPTS = [
  // ── CALL ADS ────────────────────────────────────────────────────────────────
  { slug: '01-downsizing',      theme: 'Downsizing & life-stage', intent: 'call', headline: 'Thinking of downsizing?',           subHead: "See what your home is worth and what downsizing frees up, with a real number and no pressure. That's how we earn your business.", button: 'Call 541.703.3095' },
  { slug: '02-less-upkeep',     theme: 'Downsizing & life-stage', intent: 'call', headline: 'Ready for less upkeep?',            subHead: "Trade the yard work and repairs for lock-and-leave living. We'll handle the sale on your timeline, no pressure.",    button: 'Call 541.703.3095' },
  { slug: '03-right-size',      theme: 'Downsizing & life-stage', intent: 'call', headline: 'Too much house to manage?',         subHead: "Right-size to a home that fits you now. Our team knows your part of Bend and what it's worth. That's how we earn your business.", button: 'Call 541.703.3095' },
  { slug: '04-empty-nest',      theme: 'Downsizing & life-stage', intent: 'call', headline: 'An empty nest these days?',          subHead: "Now that it's just the two of you, see what the extra space is worth on today's market. A plan first, no pressure.",         button: 'Call 541.703.3095' },
  { slug: '05-next-chapter',    theme: 'Downsizing & life-stage', intent: 'call', headline: 'Ready for your next chapter?',       subHead: "Start with a plan, not a listing, and move on your timeline. That's how we earn your business.",    button: 'Call 541.703.3095' },
  { slug: '06-retirement',      theme: 'Downsizing & life-stage', intent: 'call', headline: 'Planning your retirement move?',     subHead: "Plan your retirement move on your timeline, with clear answers and no pressure. That's how we earn your business.",       button: 'Call 541.703.3095' },
  { slug: '07-parents-home',    theme: 'Downsizing & life-stage', intent: 'call', headline: "Handling your parents' home?",        subHead: "Our team and our local network handle the prep, repairs, and sale, so your family doesn't carry it. Let us earn your business.", button: 'Call 541.703.3095' },
  { slug: '08-out-of-area',     theme: 'Out-of-area / absentee',  intent: 'call', headline: 'Own a Bend home from out of state?',  subHead: "Our team and our trusted network handle the prep, the repairs, and the sale while you stay put. That's how we earn your business.", button: 'Call 541.703.3095' },
  { slug: '09-single-level',    theme: 'Downsizing & life-stage', intent: 'call', headline: 'Ready to leave the stairs behind?',  subHead: "Move to single-level living with less upkeep, and let our team handle the sale. On your timeline, no pressure.", button: 'Call 541.703.3095' },
  { slug: '10-relocating',      theme: 'Out-of-area / absentee',  intent: 'call', headline: 'Relocating out of Bend?',            subHead: "Already gone? Our team handles the prep, the repairs, and the sale through our trusted local network, even from afar.",        button: 'Call 541.703.3095' },
  { slug: '11-moving',          theme: 'Out-of-area / absentee',  intent: 'call', headline: 'Moving out of the area?',            subHead: "Our team manages every step, from the first walkthrough to a market-ready sale. Let us earn your business.",        button: 'Call 541.703.3095' },
  { slug: '12-closer-to-family',theme: 'Downsizing & life-stage', intent: 'call', headline: 'Moving closer to family?',           subHead: "Get closer to the grandkids on your timeline. Our team handles every detail of the sale, no pressure.", button: 'Call 541.703.3095' },
  { slug: '13-landlord',        theme: 'Downsizing & life-stage', intent: 'call', headline: 'Done being a landlord?',             subHead: "Keep renting or list it. We'll lay out the numbers either way, no pressure, and handle it all if you do.",      button: 'Call 541.703.3095' },
  { slug: '14-second-home',     theme: 'Downsizing & life-stage', intent: 'call', headline: 'Managing a second property?',        subHead: "See what that second place is worth on today's market, then keep it or let us handle the sale and earn your business.",        button: 'Call 541.703.3095' },
  { slug: '15-timing-call',     theme: 'Timing / market',         intent: 'call', headline: 'Is now your time to make a move?',   subHead: "Find out whether moving now beats waiting, with honest answers about the Bend market and no pressure.",     button: 'Call 541.703.3095' },
  // ── LP / HOME VALUE ADS ──────────────────────────────────────────────────────
  { slug: '16-worth-now',       theme: 'Home value',              intent: 'lp',   headline: "What's your home worth right now?",      subHead: "A real number from our team, based on homes that recently sold near you. No online guess, no pressure.",         button: 'Get your free home estimate' },
  { slug: '17-worth-today',     theme: 'Home value',              intent: 'lp',   headline: 'Curious what your home is worth today?',  subHead: "Our team gives you a real number based on what's actually sold near you, not an online guess.",        button: "Get your home's value" },
  { slug: '18-bend-worth',      theme: 'Home value',              intent: 'lp',   headline: "What's your Bend home worth?",            subHead: "Find out what your Bend home is worth, based on comparable homes that recently sold nearby. Real numbers, no pressure.",   button: "See your home's value" },
  { slug: '19-would-bring',     theme: 'Home value',              intent: 'lp',   headline: 'What would your home bring today?',       subHead: "See what your home would bring today, based on what buyers are actually paying now. Real numbers, no guesswork.",    button: 'Get your instant estimate' },
  { slug: '20-current-value',   theme: 'Home value',              intent: 'lp',   headline: "Want your home's current value?",         subHead: "We'll give you a real number after walking your home in person, not a computer's guess. That's how we earn your business.", button: "Find your home's value" },
  { slug: '21-zestimate-off',   theme: 'Anti-Zestimate',          intent: 'lp',   headline: 'How far off is your Zestimate?',           subHead: "We'll show you how far off it is and give you the real number from recent local sales. Let us earn your business.", button: "Get a broker's estimate" },
  { slug: '22-zestimate-inside',theme: 'Anti-Zestimate',          intent: 'lp',   headline: 'Does a Zestimate know your home?',         subHead: "A Zestimate never walked through your home. We price it on what's actually there, and what's sold nearby.",       button: 'Get a real local estimate' },
  { slug: '23-zestimate-right', theme: 'Anti-Zestimate',          intent: 'lp',   headline: 'Is the Zestimate right for your home?',    subHead: "An online estimate misses the upgrades you've made. We price what makes yours different, based on real sales.",    button: 'Get your true home value' },
  { slug: '24-right-time',      theme: 'Timing / market',         intent: 'lp',   headline: 'Is now the right time for you?',           subHead: "Know your number first, then decide when the time is right for you. No pressure, just the real picture.",  button: 'Get your free home estimate' },
  { slug: '25-wait-or-move',    theme: 'Timing / market',         intent: 'lp',   headline: 'Should you wait or make a move?',          subHead: "Get the real data first, then make the call with facts, not pressure. That's how we earn your business.",     button: "Get your home's value" },
  { slug: '26-this-year',       theme: 'Timing / market',         intent: 'lp',   headline: 'Should you make a move this year?',        subHead: "See where Bend prices stand this year, so you know if the timing works for you. No pressure, just the data.",     button: 'Get your instant estimate' },
  { slug: '27-market-now',      theme: 'Timing / market',         intent: 'lp',   headline: "How's the Bend market right now?",         subHead: "See how the Bend market looks right now, priced off homes that recently sold near you. Real data, no spin.",  button: 'Get your free home estimate' },
  { slug: '28-homes-like',      theme: 'Comps / home value',      intent: 'lp',   headline: 'What are homes like yours going for?',     subHead: "See what homes like yours have actually sold for nearby, with a real number from our team and no guesswork.", button: "Get your home's value" },
  { slug: '29-value-think',     theme: 'Home value',              intent: 'lp',   headline: "Thinking about your home's value?",        subHead: "We'll show you the real number and the recent sales it's built on. No online guess, no pressure.", button: "Find your home's value" },
  { slug: '30-where-stands',    theme: 'Home value',              intent: 'lp',   headline: 'Curious where your home stands today?',    subHead: "Get one real number you can count on, not a wide Zillow range. That's how we earn your business.",        button: "See your home's value" },
  // ── REACTIVATION SET ─────────────────────────────────────────────────────────
  { slug: 'react-t1-v1-worth-today',       theme: 'Reactivation / T1 database', intent: 'lp', headline: 'Curious what your home is worth today?',    subHead: "A real number from our team based on what's actually sold near you, not an online guess.",         button: "Get your home's value" },
  { slug: 'react-t1-v2-make-a-move',       theme: 'Reactivation / T1 database', intent: 'lp', headline: 'Is now your time to make a move?',          subHead: "Honest answers about the Bend market and what your home would bring, with no pressure.",           button: 'Get your free home estimate' },
  { slug: 'react-t2a-v1-bring-today',      theme: 'Reactivation / T2a premium', intent: 'lp', headline: 'What would your home bring today?',         subHead: "See what buyers are actually paying for homes like yours now. Real numbers, no guesswork.",         button: 'Get your instant estimate' },
  { slug: 'react-t2a-v2-out-of-state',     theme: 'Reactivation / T2a premium', intent: 'lp', headline: 'Own a Bend home from out of state?',        subHead: "Our team and trusted network handle the prep, the repairs, and the sale while you stay put.",       button: "Get your home's value" },
  { slug: 'react-t2b-v1-west-bend-worth',  theme: 'Reactivation / T2b West Bend', intent: 'lp', headline: "What's your West Bend home worth?",         subHead: "Find out what homes near you have actually sold for. A real number from our team, no pressure.",    button: "See your home's value" },
  { slug: 'react-t2b-v2-westside-going-for',theme:'Reactivation / T2b West Bend', intent: 'lp', headline: 'What are westside homes going for?',        subHead: "See what comparable homes near you have actually sold for, with a real number from our local team.", button: "Get your home's value" },
]

// ── Helpers ────────────────────────────────────────────────────────────────────
async function fileExists(p) {
  try { await access(p); return true } catch { return false }
}

async function toDataUri(filePath) {
  const buf = await readFile(filePath)
  return 'data:image/jpeg;base64,' + buf.toString('base64')
}

// ── Embed thumbnails ───────────────────────────────────────────────────────────
console.log(`Embedding ${CONCEPTS.length} thumbnails...`)
const fallbacks = []
for (const c of CONCEPTS) {
  const thumbPath = resolve(THUMB_DIR, `seller-v10-${c.slug}.jpg`)
  const fullPath  = resolve(FULL_DIR,  `seller-v10-${c.slug}.jpg`)
  if (await fileExists(thumbPath)) {
    c.imgUri = await toDataUri(thumbPath)
    c.imgSource = 'thumb'
  } else if (await fileExists(fullPath)) {
    c.imgUri = await toDataUri(fullPath)
    c.imgSource = 'full-fallback'
    fallbacks.push(c.slug)
    console.warn(`  ⚠ FALLBACK to full 1:1 for ${c.slug}`)
  } else {
    c.imgUri = null
    c.imgSource = 'missing'
    fallbacks.push(c.slug + ' (MISSING)')
    console.warn(`  ✗ NO IMAGE for ${c.slug}`)
  }
  const tag = MULTISIZE_SLUGS.has(c.slug) ? '3 sizes' : '1:1 only'
  c.sizesTag = tag
  c.isLive = LIVE.has(c.slug)
  process.stdout.write('.')
}
console.log('\n')

// ── Group by theme (preserve display order) ────────────────────────────────────
const themeOrder = [
  'Reactivation / T2a premium',
  'Reactivation / T1 database',
  'Reactivation / T2b West Bend',
  'Downsizing & life-stage',
  'Out-of-area / absentee',
  'Home value',
  'Comps / home value',
  'Anti-Zestimate',
  'Timing / market',
]
const byTheme = {}
for (const t of themeOrder) byTheme[t] = []
for (const c of CONCEPTS) {
  if (!byTheme[c.theme]) byTheme[c.theme] = []
  byTheme[c.theme].push(c)
}

// ── HTML card template ─────────────────────────────────────────────────────────
function card(c) {
  const liveBadge = c.isLive
    ? `<div class="live-badge">&#9679; LIVE NOW</div>`
    : ''
  const sizeTag = c.sizesTag === '3 sizes'
    ? `<span class="tag tag-3size">3 sizes &#10003;</span>`
    : `<span class="tag tag-1size">1:1 only</span>`
  const intentTag = c.intent === 'call'
    ? `<span class="tag tag-call">call</span>`
    : `<span class="tag tag-lp">LP / estimate</span>`
  const imgEl = c.imgUri
    ? `<img src="${c.imgUri}" alt="${escH(c.headline)}" loading="lazy">`
    : `<div class="img-missing">no image</div>`
  return `<div class="card${c.isLive ? ' card-live' : ''}">
  ${liveBadge}
  <div class="thumb">${imgEl}</div>
  <div class="meta">
    <div class="tags">${intentTag}${sizeTag}</div>
    <div class="headline">${escH(c.headline)}</div>
    <div class="subhead">${escH(c.subHead)}</div>
    <div class="cta-txt">&#9658; ${escH(c.button)}</div>
    <div class="slug-row"><code>${c.slug}</code></div>
  </div>
</div>`
}

function escH(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function section(theme) {
  const concepts = byTheme[theme] || []
  if (!concepts.length) return ''
  const cards = concepts.map(card).join('\n')
  return `<section>
  <h2>${escH(theme)}</h2>
  <div class="grid">${cards}</div>
</section>`
}

const liveCount = CONCEPTS.filter(c => c.isLive).length
const totalCount = CONCEPTS.length

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ryan Realty — Seller Ad Library (v10)</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Helvetica, Arial, sans-serif;
    background: #faf8f4;
    color: #102742;
    padding: 36px 24px 72px;
    line-height: 1.5;
  }

  /* ── Page header ── */
  .page-header {
    max-width: 1280px;
    margin: 0 auto 44px;
    border-bottom: 2px solid #102742;
    padding-bottom: 20px;
  }
  .page-header h1 {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: #102742;
    margin-bottom: 6px;
  }
  .page-header .subtitle {
    font-size: 14px;
    color: #4a6580;
    max-width: 640px;
    line-height: 1.55;
  }
  .page-header .subtitle b { color: #102742; }
  .live-indicator {
    display: inline-block;
    margin-top: 12px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #c8232b;
    background: #fff0f0;
    border: 1px solid #f5a0a4;
    border-radius: 4px;
    padding: 4px 12px;
  }

  /* ── Section headers ── */
  section {
    max-width: 1280px;
    margin: 0 auto 52px;
  }
  section h2 {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #102742;
    border-bottom: 1px solid rgba(16,39,66,0.18);
    padding-bottom: 10px;
    margin-bottom: 18px;
  }

  /* ── Grid ── */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 18px;
  }

  /* ── Card ── */
  .card {
    background: #fff;
    border: 1px solid rgba(16,39,66,0.14);
    border-radius: 8px;
    overflow: hidden;
    position: relative;
    transition: box-shadow 0.15s ease;
  }
  .card:hover {
    box-shadow: 0 4px 20px rgba(16,39,66,0.14);
  }
  .card-live {
    border-color: #c8232b;
    border-width: 2px;
    box-shadow: 0 0 0 1px rgba(200,35,43,0.2);
  }
  .card-live:hover {
    box-shadow: 0 4px 20px rgba(200,35,43,0.22);
  }

  /* ── Live badge ── */
  .live-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 10;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #fff;
    background: #c8232b;
    border-radius: 100px;
    padding: 4px 10px 4px 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.28);
    white-space: nowrap;
  }

  /* ── Thumbnail ── */
  .thumb {
    width: 100%;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    background: #e8e2d4;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .img-missing {
    font-size: 12px;
    color: rgba(16,39,66,0.4);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  /* ── Card meta ── */
  .meta {
    padding: 13px 15px 14px;
  }

  .tags {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    margin-bottom: 9px;
  }
  .tag {
    display: inline-block;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    border-radius: 100px;
    padding: 2px 8px;
    white-space: nowrap;
  }
  .tag-call  { background: rgba(16,39,66,0.08); color: #102742; }
  .tag-lp    { background: rgba(200,168,100,0.16); color: #8a6a14; }
  .tag-3size { background: rgba(16,100,60,0.10); color: #1a5c38; }
  .tag-1size { background: rgba(16,39,66,0.05); color: rgba(16,39,66,0.5); }

  .headline {
    font-size: 15px;
    font-weight: 700;
    color: #102742;
    line-height: 1.3;
    margin-bottom: 6px;
    letter-spacing: -0.005em;
  }

  .subhead {
    font-size: 11.5px;
    color: rgba(16,39,66,0.62);
    line-height: 1.45;
    margin-bottom: 7px;
  }

  .cta-txt {
    font-size: 11px;
    font-weight: 600;
    color: rgba(16,39,66,0.75);
    letter-spacing: 0.02em;
    margin-bottom: 8px;
  }

  .slug-row {
    margin-top: 2px;
  }
  .slug-row code {
    font-family: 'SF Mono', 'Fira Mono', 'Menlo', Consolas, monospace;
    font-size: 9.5px;
    color: rgba(16,39,66,0.4);
    letter-spacing: 0.01em;
    background: rgba(16,39,66,0.04);
    padding: 2px 5px;
    border-radius: 3px;
  }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .grid { grid-template-columns: 1fr 1fr; gap: 12px; }
    body { padding: 20px 12px 48px; }
    .page-header h1 { font-size: 20px; }
  }
  @media (max-width: 380px) {
    .grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<header class="page-header">
  <h1>Ryan Realty &#183; Seller Ad Library (v10)</h1>
  <p class="subtitle">
    <b>${totalCount} concepts total.</b>
    Only <b>${liveCount} are currently live.</b>
    Pick the ones to run next. Cards marked <span style="color:#c8232b;font-weight:700">&#9679; LIVE NOW</span> are active in Meta.
    Tags show destination type (call / LP estimate) and whether 3 placement sizes are available.
  </p>
  <div class="live-indicator">&#9679;&nbsp; ${liveCount} of ${totalCount} live now</div>
</header>

${themeOrder.filter(t => byTheme[t] && byTheme[t].length > 0).map(section).join('\n\n')}

</body>
</html>`

const outPath = resolve(OUT_DIR, 'ad-library-picker.html')
await writeFile(outPath, html, 'utf-8')

// ── Verify: no local file refs, count data: URIs ──────────────────────────────
const srcMatches = html.match(/src="(?!data:)[^"]+"/g) || []
const urlMatches = html.match(/url\((?!data:)[^)]+\)/g) || []
const dataCount  = (html.match(/data:image/g) || []).length

const fileSizeBytes = Buffer.byteLength(html, 'utf-8')
const fileSizeMB    = (fileSizeBytes / 1024 / 1024).toFixed(2)

console.log('─'.repeat(60))
console.log(`Output:        ${outPath}`)
console.log(`File size:     ${fileSizeMB} MB`)
console.log(`Concepts:      ${CONCEPTS.length}`)
console.log(`data: URIs:    ${dataCount}`)
console.log(`Local src=":   ${srcMatches.length} (must be 0)`)
console.log(`Local url(:    ${urlMatches.length} (must be 0)`)
if (srcMatches.length || urlMatches.length) {
  console.warn('  LOCAL FILE REFS FOUND:')
  for (const m of [...srcMatches, ...urlMatches]) console.warn('   ', m)
}
if (fallbacks.length) {
  console.warn(`\nFallbacks (${fallbacks.length}):`)
  for (const s of fallbacks) console.warn('  ', s)
} else {
  console.log('Fallbacks:     none — all thumbs present')
}
console.log('─'.repeat(60))

// ── Concept list for report ───────────────────────────────────────────────────
console.log('\nConcept list (grouped by theme):\n')
for (const t of themeOrder) {
  const cs = byTheme[t]
  if (!cs || !cs.length) continue
  console.log(`  ${t}`)
  for (const c of cs) {
    const live = c.isLive ? ' ● LIVE NOW' : ''
    console.log(`    ${c.slug} — "${c.headline}" — [${c.intent === 'call' ? 'call' : 'LP / estimate'}] — [${c.sizesTag}]${live}`)
  }
  console.log()
}

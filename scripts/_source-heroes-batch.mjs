/**
 * _source-heroes-batch.mjs — source + download licensed heroes for the new
 * events and the venues in one pass (CLAUDE.md §0 / docs/CONTENT_ENGINE_SPEC.md
 * §11b sourcing ladder). Subject/lifestyle photos from Unsplash + Pexels
 * (landscape only); real landmarks are overridden with Wikimedia separately.
 * Auto-picks the top landscape candidate per slug (a contact sheet is generated
 * for human review; misses get swapped like the Drake Park fix).
 *
 *   node --env-file=.env.local scripts/_source-heroes-batch.mjs
 */

import fs from 'node:fs'
import path from 'node:path'

const U = process.env.UNSPLASH_ACCESS_KEY
const P = process.env.PEXELS_API_KEY

// slug -> primary subject query. Real landmarks (Tower, Old Mill/Hayden,
// McMenamins, Belfry) are handled by the Wikimedia override script, not here.
const EVENTS = {
  'bend-farmers-market': 'farmers market fresh produce stand',
  'nwx-farmers-market': 'farmers market vegetables outdoor',
  'redmond-farmers-market': 'farmers market summer stall',
  'sisters-farmers-market': 'farmers market flowers produce',
  'crop-farmers-market': 'farmers market vegetables basket',
  'first-friday-art-walk': 'art gallery opening people evening',
  'bend-venture-conference': 'conference stage presentation audience',
  'sunriver-art-fair': 'outdoor art fair booths',
  'the-little-woody': 'whiskey barrels tasting',
  'central-oregon-beer-week': 'craft beer flight glasses',
  'bend-4th-of-july-pet-parade': 'dogs parade street summer',
  'sunriver-4th-of-july': 'children bike parade american flags',
  'la-pine-frontier-days': 'small town fourth of july parade',
  'downtown-bend-tree-lighting': 'christmas tree lighting downtown night',
  'sunriver-grand-illumination': 'christmas lights winter resort night',
  'winter-pridefest': 'rainbow pride flag celebration',
  'bend-pride': 'pride parade rainbow flags',
  'sisters-harvest-faire': 'autumn craft fair booths street',
  'crook-county-fair': 'county fair barn livestock',
  'jefferson-county-fair': 'rodeo fairgrounds arena',
  'airshow-of-the-cascades': 'air show vintage airplane sky',
  'crooked-river-roundup': 'horse racing track',
  'dirty-half': 'trail running forest race',
  'happy-girls-run': 'women running half marathon',
  'i-like-pie': 'runners cold autumn morning',
  'cascade-gravel-grinder': 'gravel cycling race road',
  'bend-marathon': 'marathon runners street race',
  'music-on-the-green': 'outdoor summer concert park lawn',
  'bend-roots-revival': 'live band outdoor music festival',
  'sisters-folk-festival': 'folk musician acoustic guitar stage',
  'big-ponderoo': 'bluegrass band banjo outdoor',
  'bend-comedy-festival': 'stand up comedy microphone spotlight',
  'ballet-bend': 'contemporary dance performance stage',
  'nutcracker-bend': 'nutcracker ballet dancers stage',
  'sunriver-stars-summer-play': 'outdoor community theater performance',
}

const VENUES = {
  'greenwood-playhouse': 'small theater stage seats',
  'second-street-theater': 'black box theater stage',
  'volcanic-theatre-pub': 'live band small concert venue',
  'midtown-ballroom': 'concert crowd hands stage lights',
  'silver-moon-brewing': 'brewery live music band',
  'worthy-brewing': 'brewery patio outdoor summer',
  'rivers-place': 'food truck lot string lights',
  'bunk-brew': 'backyard live music string lights',
  'the-commons-bend': 'cafe live music open mic',
  'high-desert-music-hall': 'concert hall stage crowd',
  'general-duffys-waterhole': 'outdoor country music concert',
  'sunriver-resort-concerts': 'outdoor lawn summer concert',
  'tin-pan-theater': 'vintage arthouse cinema interior seats',
  'open-space-event-studios': 'modern event studio performance space',
  'sisters-movie-house': 'movie theater interior seats screen',
}

function goodAspect(w, h) {
  if (!w || !h) return true
  const a = w / h
  return a >= 1.2 && a <= 2.1
}

async function unsplash(q) {
  if (!U) return []
  const r = await fetch(
    `https://api.unsplash.com/search/photos?per_page=5&orientation=landscape&content_filter=high&query=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Client-ID ${U}` } },
  )
  if (!r.ok) return []
  const j = await r.json()
  return (j.results ?? []).map((p) => ({
    full: (p.urls?.regular ?? '').replace(/w=\d+/, 'w=1920').replace(/q=\d+/, 'q=80'),
    credit: `${p.user?.name} / Unsplash`,
    creditUrl: p.user?.links?.html,
    source: 'Unsplash',
    license: 'Unsplash License',
    w: p.width,
    h: p.height,
  }))
}

async function pexels(q) {
  if (!P) return []
  const r = await fetch(
    `https://api.pexels.com/v1/search?per_page=5&orientation=landscape&size=large&query=${encodeURIComponent(q)}`,
    { headers: { Authorization: P } },
  )
  if (!r.ok) return []
  const j = await r.json()
  return (j.photos ?? []).map((p) => ({
    full: p.src?.large2x ?? p.src?.large,
    credit: `${p.photographer} / Pexels`,
    creditUrl: p.photographer_url,
    source: 'Pexels',
    license: 'Pexels License',
    w: p.width,
    h: p.height,
  }))
}

async function pick(q) {
  const [u, p] = await Promise.all([unsplash(q), pexels(q)])
  const all = [...u, ...p].filter((c) => c.full)
  return all.find((c) => goodAspect(c.w, c.h)) ?? all[0] ?? null
}

async function run(map, dir) {
  fs.mkdirSync(dir, { recursive: true })
  const creditsPath = path.join(dir, '_credits.json')
  const credits = fs.existsSync(creditsPath) ? JSON.parse(fs.readFileSync(creditsPath, 'utf8')) : {}
  for (const [slug, q] of Object.entries(map)) {
    if (credits[slug]) { console.log(`skip ${slug} (already sourced)`); continue }
    const c = await pick(q)
    if (!c) { console.log(`MISS ${slug}`); continue }
    const res = await fetch(c.full, { headers: { 'User-Agent': 'RyanRealty/1.0 (matt@ryan-realty.com)' } })
    if (!res.ok) { console.log(`FAIL ${slug} ${res.status}`); continue }
    fs.writeFileSync(path.join(dir, `${slug}.jpg`), Buffer.from(await res.arrayBuffer()))
    credits[slug] = { credit: c.credit, creditUrl: c.creditUrl, source: c.source, license: c.license }
    console.log(`✓ ${slug.padEnd(30)} ${c.credit}`)
  }
  fs.writeFileSync(creditsPath, JSON.stringify(credits, null, 2))
  return credits
}

console.log('== EVENTS ==')
await run(EVENTS, path.resolve('public/images/events'))
console.log('\n== VENUES ==')
await run(VENUES, path.resolve('public/images/venues'))
console.log('\ndone')

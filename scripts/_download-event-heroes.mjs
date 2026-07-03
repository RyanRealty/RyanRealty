/**
 * _download-event-heroes.mjs — download the chosen hero photo for each event and
 * capture attribution. Reads the frozen candidate sets (/tmp/hero-candidates.json
 * from _source-event-heroes.mjs, /tmp/hero-fix.json from the re-source pass),
 * writes 1600–1920px JPEGs to public/images/events/<slug>.jpg, and emits a
 * credits manifest the registry + page render as photographer recognition.
 *
 *   node scripts/_download-event-heroes.mjs
 */

import fs from 'node:fs'
import path from 'node:path'

const MAIN = JSON.parse(fs.readFileSync('/tmp/hero-candidates.json', 'utf8'))
const FIX = JSON.parse(fs.readFileSync('/tmp/hero-fix.json', 'utf8'))
const OUT_DIR = path.resolve('public/images/events')
fs.mkdirSync(OUT_DIR, { recursive: true })

const commonsFilePage = (title) =>
  `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(title).replace(/ /g, '_'))}`

// Bump Unsplash regular (w=1080) to a hero-sized 1920.
const hi = (url) => (url.includes('images.unsplash.com') ? url.replace(/w=\d+/, 'w=1920').replace(/q=\d+/, 'q=80') : url)

// Final picks. Each resolves to { url, credit, creditUrl, source }.
const mainPick = (slug, i, license) => {
  const c = MAIN[slug].candidates[i]
  return {
    url: hi(c.full),
    credit: `${c.photographer} / ${c.source}`,
    creditUrl: c.photographerUrl,
    source: c.source,
    license: license ?? (c.source === 'Unsplash' ? 'Unsplash License' : 'Pexels License'),
  }
}
const wikiPick = (key, i) => {
  const c = FIX[key][i]
  return {
    url: c.full,
    credit: `${c.photographer} / Wikimedia Commons`,
    creditUrl: commonsFilePage(c.alt),
    source: 'Wikimedia Commons',
    license: c.license,
  }
}

const PICKS = {
  'munch-and-music': wikiPick('_wiki_drake', 2), // Deschutes River, Drake Park — the actual venue
  'balloons-over-bend': mainPick('balloons-over-bend', 0),
  'sisters-outdoor-quilt-show': mainPick('sisters-outdoor-quilt-show', 4),
  'bend-oktoberfest': mainPick('bend-oktoberfest', 3),
  'bendfilm-festival': mainPick('bendfilm-festival', 0),
  'deschutes-county-fair': mainPick('deschutes-county-fair', 1),
  'sunriver-music-festival': mainPick('sunriver-music-festival', 1),
  'bend-summer-festival': mainPick('bend-summer-festival', 2),
  'sisters-rodeo': mainPick('sisters-rodeo', 3),
  'pole-pedal-paddle': mainPick('pole-pedal-paddle', 0),
  'cascade-lakes-relay': mainPick('cascade-lakes-relay', 2),
  'bend-winterfest': wikiPick('_wiki_oldmill', 2), // Old Mill District — the actual venue
  'bend-fall-festival': {
    ...(() => {
      const c = FIX['bend-fall-festival']['fall foliage main street town'][1]
      return { url: hi(c.full), credit: `${c.photographer} / ${c.source}`, creditUrl: c.photographerUrl, source: c.source, license: 'Unsplash License' }
    })(),
  },
}

const UA = 'RyanRealty/1.0 (matt@ryan-realty.com)'
const credits = {}
for (const [slug, p] of Object.entries(PICKS)) {
  const res = await fetch(p.url, { headers: { 'User-Agent': UA } })
  if (!res.ok) {
    console.error(`FAIL ${slug}: ${res.status} ${p.url}`)
    continue
  }
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(path.join(OUT_DIR, `${slug}.jpg`), buf)
  credits[slug] = { credit: p.credit, creditUrl: p.creditUrl, source: p.source, license: p.license }
  console.log(`✓ ${slug.padEnd(28)} ${(buf.length / 1024).toFixed(0)}KB  ${p.credit} (${p.license})`)
}
fs.writeFileSync(path.join(OUT_DIR, '_credits.json'), JSON.stringify(credits, null, 2))
console.log(`\nWrote ${Object.keys(credits).length} heroes + _credits.json to ${OUT_DIR}`)

/**
 * _source-event-heroes.mjs — source candidate hero photos for content pages from
 * licensed / attribution-friendly stock APIs (Unsplash, Pexels).
 *
 * Both licenses permit commercial use; we still render photographer credit on the
 * page (recognition where required — Matt directive 2026-07-03). Run:
 *
 *   node --env-file=.env.local scripts/_source-event-heroes.mjs
 *
 * Prints JSON candidates per query. Downloading + picking is a second, human step
 * (draft-first): the chosen file lands in public/images/events/ with attribution
 * captured in the registry. Reusable for parks and the coming category buckets.
 */

const UNSPLASH = process.env.UNSPLASH_ACCESS_KEY
const PEXELS = process.env.PEXELS_API_KEY

// slug -> ordered search terms (most specific first; last term is a safe
// Central-Oregon lifestyle fallback so we never return nothing usable).
const QUERIES = {
  'munch-and-music': ['Drake Park Bend Oregon', 'Mirror Pond Bend Oregon', 'outdoor summer concert park'],
  'balloons-over-bend': ['hot air balloons sunrise', 'hot air balloon Oregon', 'hot air balloons festival'],
  'sisters-outdoor-quilt-show': ['colorful quilts hanging', 'Sisters Oregon downtown', 'quilt fabric art'],
  'bend-oktoberfest': ['oktoberfest beer festival', 'craft beer festival outdoor', 'beer steins cheers'],
  'bendfilm-festival': ['vintage cinema marquee', 'film festival theater', 'movie theater night'],
  'deschutes-county-fair': ['county fair ferris wheel night', 'state fair carnival rides', 'fair carnival lights'],
  'sunriver-music-festival': ['orchestra concert hall', 'classical music orchestra', 'symphony performance'],
  'bend-summer-festival': ['street festival crowd summer', 'outdoor art festival', 'downtown street fair'],
  'sisters-rodeo': ['rodeo bull riding', 'rodeo cowboy arena', 'rodeo western'],
  'pole-pedal-paddle': ['Mount Bachelor Oregon skiing', 'cross country ski race', 'Deschutes River kayak'],
  'cascade-lakes-relay': ['Cascade Lakes Oregon', 'trail running mountains', 'Sparks Lake Oregon'],
  'bend-winterfest': ['Old Mill District Bend Oregon winter', 'winter festival snow lights', 'ice sculpture festival'],
  'bend-fall-festival': ['downtown Bend Oregon autumn', 'fall festival street', 'autumn city street'],
}

async function unsplash(q) {
  if (!UNSPLASH) return []
  const url = `https://api.unsplash.com/search/photos?per_page=3&orientation=landscape&content_filter=high&query=${encodeURIComponent(q)}`
  const r = await fetch(url, { headers: { Authorization: `Client-ID ${UNSPLASH}` } })
  if (!r.ok) return [{ error: `unsplash ${r.status}` }]
  const j = await r.json()
  return (j.results ?? []).map((p) => ({
    source: 'Unsplash',
    id: p.id,
    full: p.urls?.regular,
    download: p.links?.download_location,
    photographer: p.user?.name,
    photographerUrl: p.user?.links?.html,
    alt: p.alt_description,
    width: p.width,
    height: p.height,
  }))
}

async function pexels(q) {
  if (!PEXELS) return []
  const url = `https://api.pexels.com/v1/search?per_page=3&orientation=landscape&size=large&query=${encodeURIComponent(q)}`
  const r = await fetch(url, { headers: { Authorization: PEXELS } })
  if (!r.ok) return [{ error: `pexels ${r.status}` }]
  const j = await r.json()
  return (j.photos ?? []).map((p) => ({
    source: 'Pexels',
    id: String(p.id),
    full: p.src?.large2x ?? p.src?.large,
    download: p.src?.original,
    photographer: p.photographer,
    photographerUrl: p.photographer_url,
    alt: p.alt,
    width: p.width,
    height: p.height,
  }))
}

const out = {}
for (const [slug, terms] of Object.entries(QUERIES)) {
  const q = terms[0]
  const [u, p] = await Promise.all([unsplash(q), pexels(q)])
  out[slug] = { query: q, candidates: [...u, ...p].filter((c) => c && !c.error && c.full) }
}
console.log(JSON.stringify(out, null, 2))

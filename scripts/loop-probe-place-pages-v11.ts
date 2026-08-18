/**
 * Reproduce-or-reject probe: served place-pages punch slice (HTML).
 *
 *   npx tsx scripts/loop-probe-place-pages-v11.ts
 */
const CASES = [
  { id: 'aubrey-heights', url: 'https://ryan-realty.com/subdivisions/aubrey-heights' },
  { id: 'chase-village', url: 'https://ryan-realty.com/subdivisions/chase-village' },
  { id: 'chloe-estates', url: 'https://ryan-realty.com/subdivisions/chloe-estates' },
  { id: 'brookswood-estates', url: 'https://ryan-realty.com/subdivisions/brookswood-estates' },
  { id: 'brentwood', url: 'https://ryan-realty.com/subdivisions/brentwood' },
  { id: 'housing-market', url: 'https://ryan-realty.com/housing-market' },
  { id: 'blue-chip-ranch', url: 'https://ryan-realty.com/subdivisions/blue-chip-ranch' },
  { id: 'bend-farmers-market', url: 'https://ryan-realty.com/central-oregon/events/bend-farmers-market' },
] as const

function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

async function probe(c: (typeof CASES)[number]) {
  const res = await fetch(c.url, {
    redirect: 'manual',
    headers: { 'user-agent': 'RyanRealty-loop-probe/place-pages-v11' },
  })
  const html = await res.text()
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1]))
  const hasEmptyState = /no active listings/i.test(html)
  const hasSalesHistory = /sales history/i.test(html)
  const listingCardCount = (html.match(/data-listing-card|listing-card/gi) ?? []).length
  const terrebonne = [...html.matchAll(/Terrebonne[\s\S]{0,400}/gi)].map((m) =>
    stripTags(m[0]).slice(0, 240),
  )
  const daysToPendingHits = [...html.matchAll(/days? to pending|median days/gi)].map((m) => m[0])
  const hasMapSlot = /mapbox|leaflet|google\.maps|data-map|VenueMap|event-map/i.test(html)
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const chromeOnly =
    h1s.length === 0 && !hasEmptyState && !hasSalesHistory && bodyText.length < 400
  return {
    id: c.id,
    url: c.url,
    status: res.status,
    location: res.headers.get('location'),
    title,
    h1s,
    hasEmptyState,
    hasSalesHistory,
    listingCardCount,
    terrebonne,
    daysToPendingHits: daysToPendingHits.slice(0, 8),
    hasMapSlot,
    bodyChars: bodyText.length,
    bodyPreview: bodyText.slice(0, 320),
    chromeOnly,
  }
}

async function main() {
  const rows = []
  for (const c of CASES) {
    rows.push(await probe(c))
  }
  console.log(JSON.stringify({ fetchedAt: new Date().toISOString(), rows }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

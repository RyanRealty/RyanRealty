/**
 * Reproduce-or-reject probe: subdivision chrome-only punch lines.
 * Fetches production HTML and reports H1 / empty-state / listing signals.
 *
 *   npx tsx scripts/loop-probe-place-pages-chrome-v10.ts
 */
const SLUGS = [
  'bella-vista',
  'blue-ridge',
  'brookside',
  'buena-ventura',
  'big-sky',
  'brier-ridge',
  'black-bear-meadows',
  'boyd-crossing',
] as const

async function probe(slug: string) {
  const url = `https://ryan-realty.com/subdivisions/${slug}`
  const res = await fetch(url, {
    redirect: 'manual',
    headers: { 'user-agent': 'RyanRealty-loop-probe/place-pages-v10' },
  })
  const html = await res.text()
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  )
  const hasEmptyState = /no active listings/i.test(html)
  const hasSalesHistory = /sales history/i.test(html)
  const listingCardCount = (html.match(/data-listing-card|listing-card|homes? for sale/gi) ?? []).length
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const chromeOnly =
    h1s.length === 0 && !hasEmptyState && !hasSalesHistory && bodyText.length < 400
  return {
    slug,
    status: res.status,
    location: res.headers.get('location'),
    title,
    h1s,
    hasEmptyState,
    hasSalesHistory,
    listingCardCount,
    bodyChars: bodyText.length,
    bodyPreview: bodyText.slice(0, 280),
    chromeOnly,
  }
}

async function main() {
  const rows = []
  for (const slug of SLUGS) {
    rows.push(await probe(slug))
  }
  console.log(JSON.stringify({ fetchedAt: new Date().toISOString(), rows }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

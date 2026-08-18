/**
 * Reproduce-or-reject probe for the served place-pages slice.
 *
 *   npx tsx scripts/loop-probe-place-pages-v13.ts
 */
const URLS = [
  'https://ryan-realty.com/subdivisions/brookswood-crossing',
  'https://ryan-realty.com/subdivisions/brooktree',
  'https://ryan-realty.com/schools/summit-high',
  'https://ryan-realty.com/oregon/portland',
  'https://ryan-realty.com/housing-market',
  'https://ryan-realty.com/communities/tetherow',
  'https://ryan-realty.com/subdivisions',
] as const

function strip(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function probe(url: string) {
  const res = await fetch(url, {
    redirect: 'manual',
    headers: { 'user-agent': 'RyanRealty-loop-probe/place-pages-v13' },
  })
  const html = await res.text()
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  )
  const body = strip(html)
  const listingHrefs = [...html.matchAll(/href="(\/homes-for-sale\/[^"]+)"/gi)].map((m) => m[1])
  const uniqueListingHrefs = [...new Set(listingHrefs)]
  return {
    url,
    status: res.status,
    location: res.headers.get('location'),
    title,
    h1s,
    has404: /page not found|aw snap/i.test(html),
    hasEmptyState: /no active listings/i.test(html),
    hasSalesHistory: /sales history/i.test(html),
    hasMap: /v3-field__map|google\.maps|data-map|gm-style/i.test(html),
    mapSlots: (html.match(/v3-field__map/g) ?? []).length,
    allTypeCloses: body.match(/ALL[- ]TYPE CLOSES[^0-9]{0,40}([\d,]+)/i)?.[1] ?? null,
    categoryHits: {
      singleFamily: body.match(/Single-family[^0-9]{0,20}([\d,]+)/i)?.[1] ?? null,
      land: body.match(/\bLand[^0-9]{0,20}([\d,]+)/i)?.[1] ?? null,
      multi: body.match(/Multi-family[^0-9]{0,20}([\d,]+)/i)?.[1] ?? null,
      condo: body.match(/Condo[^0-9]{0,20}([\d,]+)/i)?.[1] ?? null,
      commercial: body.match(/Commercial[^0-9]{0,20}([\d,]+)/i)?.[1] ?? null,
    },
    composition: body.match(/Single-family[\s\S]{0,80}Land[\s\S]{0,40}/)?.[0] ?? null,
    listingHrefCount: listingHrefs.length,
    uniqueListingHrefCount: uniqueListingHrefs.length,
    featuredZero: (body.match(/0 ACTIVE/g) ?? []).length,
    featuredDashMedian: (body.match(/- MEDIAN/gi) ?? []).length,
    portlandHits: (body.match(/\bPortland\b/g) ?? []).length,
    otherCities: {
      medford: (body.match(/\bMedford\b/g) ?? []).length,
      klamath: (body.match(/Klamath Falls/g) ?? []).length,
      grantsPass: (body.match(/Grants Pass/g) ?? []).length,
      ashland: (body.match(/\bAshland\b/g) ?? []).length,
    },
    activeCountHints: [...body.matchAll(/(\d[\d,]*)\s+(?:active|homes for sale|homes)/gi)]
      .slice(0, 8)
      .map((m) => m[0]),
    bodyChars: body.length,
    bodyPreview: body.slice(0, 420),
  }
}

async function main() {
  const rows = []
  for (const url of URLS) {
    rows.push(await probe(url))
  }
  console.log(JSON.stringify({ fetchedAt: new Date().toISOString(), rows }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

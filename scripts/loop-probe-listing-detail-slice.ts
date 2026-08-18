/**
 * HTML probe for the served listing-detail punch slice.
 *   npx tsx scripts/loop-probe-listing-detail-slice.ts
 */
const URLS = [
  'https://ryan-realty.com/homes-for-sale/bend/20556-empire-220226741',
  'https://ryan-realty.com/homes-for-sale/bend/61579-rockway-220226183',
  'https://ryan-realty.com/homes-for-sale/bend/65255-swalley-220207865',
  'https://ryan-realty.com/homes-for-sale/bend/orchard-district/1st-addition-bend-pk/438-9th-220208193',
  'https://ryan-realty.com/homes-for-sale/bend/southern-crossing/2nd-addition-bend-pk/195-roosevelt-220225285',
]

function pick(html: string, re: RegExp): string[] {
  const out: string[] = []
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
  for (const m of html.matchAll(g)) out.push((m[1] ?? m[0]).slice(0, 160))
  return out.slice(0, 12)
}

async function probe(url: string) {
  const t0 = Date.now()
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'RyanRealtyLoopProbe/1.0' } })
  const html = await res.text()
  const ms = Date.now() - t0
  return {
    url,
    status: res.status,
    ms,
    title: (html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '').trim(),
    h1: pick(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).map((s) => s.replace(/<[^>]+>/g, '').trim()),
    unmute: /unmute/i.test(html),
    video: /<video\b/i.test(html),
    listingHistory: /listing history/i.test(html),
    listed: /Listed /i.test(html),
    dataLastUpdated: pick(html, /Data last updated[^<.]{0,80}/i),
    courtesy: pick(html, /Listing courtesy of[^<]{0,120}/i),
    listPriceRaw: /ListPrice:\s*\d/i.test(html),
    listPriceRawSnips: pick(html, /ListPrice:[^<]{0,80}/i),
    acres: pick(html, /\d[\d,.]*\s*ACRES/i),
    lot: pick(html, /lot[^<]{0,40}/i).slice(0, 6),
    nextStep: /Next step: get alerts/i.test(html),
    notNow: /NOT NOW/i.test(html),
    interstitial: /get alerts for homes like this/i.test(html),
    heroPrice: pick(html, /\$[\d,.]+[KM]?/),
    futureAug17: /August 17, 2026/i.test(html),
    futureAug16: /August 16, 2026/i.test(html),
  }
}

async function main() {
  const rows = []
  for (const url of URLS) rows.push(await probe(url))
  console.log(JSON.stringify({ today: new Date().toISOString().slice(0, 10), rows }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

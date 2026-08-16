/**
 * Extract KbHero lead grain from a live place page.
 *
 *   npx tsx scripts/loop-probe-awbrey-grain.ts
 *   npx tsx scripts/loop-probe-awbrey-grain.ts https://ryan-realty.com/cities/bend/awbrey-butte
 */
const DEFAULTS = [
  'https://ryan-realty.com/cities/bend/awbrey-butte',
  'https://ryan-realty.com/cities/bend/southern-crossing',
  'https://ryan-realty.com/communities/tetherow',
  'https://ryan-realty.com/cities/bend',
]

function extractLead(html: string): { lead: string | null; countPrefix: string | null; composed: string | null } {
  const leadMatch = html.match(/lead\\?":\\?"(.*?)"/)
  const lead = leadMatch
    ? leadMatch[1].replace(/\\u0027/g, "'").replace(/\\"/g, '"').replace(/\\"/g, '"')
    : null
  const countMatch = html.match(/<b>(\d[\d,]*) homes<\/b> for sale\s*/)
  const countPrefix = countMatch ? `${countMatch[1]} homes for sale` : null
  const composed = countPrefix && lead ? `${countPrefix} ${lead}` : lead
  return { lead, countPrefix, composed }
}

async function fetchPage(url: string) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; RR-loop/1.0)' },
    redirect: 'follow',
  })
  const html = await res.text()
  return { url, status: res.status, ...extractLead(html) }
}

async function main() {
  const urls = process.argv.slice(2)
  const targets = urls.length ? urls : DEFAULTS
  const rows = []
  for (const url of targets) {
    rows.push(await fetchPage(url))
  }
  const out = { fetchedAt: new Date().toISOString(), rows }
  console.log(JSON.stringify(out, null, 2))
  const awbrey = rows.find((r) => r.url.includes('awbrey-butte'))
  if (awbrey) {
    const cityGrain = /\bin Bend\b/.test(awbrey.lead ?? '') || /\bin Bend\b/.test(awbrey.composed ?? '')
    const placeGrain = /\bin Awbrey Butte\b/.test(awbrey.lead ?? '') || /\bin Awbrey Butte\b/.test(awbrey.composed ?? '')
    if (cityGrain && !placeGrain) {
      console.error('FAIL: Awbrey Butte still attributes the count to Bend')
      process.exit(1)
    }
    if (!placeGrain) {
      console.error('FAIL: Awbrey Butte lead is not labeled as Awbrey Butte')
      process.exit(1)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

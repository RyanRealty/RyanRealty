#!/usr/bin/env node
/**
 * list-public-sitemap-urls.mjs — A3 helper (optional; GSC console still human)
 *
 * Fetches the live public sitemap index + child sitemaps from production
 * (or BASE_URL) and prints URL locs. Does NOT submit to GSC and does not
 * replace Matt/ops console work — useful to inventory what Google should see
 * without opening Search Console.
 *
 * Usage:
 *   node scripts/list-public-sitemap-urls.mjs
 *   node scripts/list-public-sitemap-urls.mjs --limit 50
 *   node scripts/list-public-sitemap-urls.mjs --index-only   # child sitemap locs only
 *   node scripts/list-public-sitemap-urls.mjs --json
 *   BASE_URL=https://ryan-realty.com node scripts/list-public-sitemap-urls.mjs
 *
 * WAF: uses a browser User-Agent (bare curl often 403 on prod).
 * With --limit, stops fetching further child sitemaps once enough page URLs collected.
 */
const args = process.argv.slice(2)
const limitIdx = args.indexOf('--limit')
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : null
const asJson = args.includes('--json')
const indexOnly = args.includes('--index-only')
const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const INDEX = `${BASE}/sitemap.xml`
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const FETCH_MS = 45_000

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/xml,text/xml,*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_MS),
  })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return res.text()
}

function extractTags(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'gi')
  const out = []
  let m
  while ((m = re.exec(xml))) {
    out.push(m[1].trim())
  }
  return out
}

async function main() {
  console.error(`Fetching index: ${INDEX}`)
  const indexXml = await fetchText(INDEX)
  const childSitemaps = extractTags(indexXml, 'loc')
  // Flat urlset (no children): locs are page URLs
  const isIndex = /<sitemapindex/i.test(indexXml)
  /** @type {string[]} */
  let urls = []

  if (isIndex && indexOnly) {
    console.error(`Child sitemaps: ${childSitemaps.length} (--index-only; not expanding)`)
    urls = childSitemaps
  } else if (isIndex) {
    console.error(`Child sitemaps: ${childSitemaps.length}`)
    for (const child of childSitemaps) {
      if (Number.isFinite(limit) && limit > 0 && urls.length >= limit) {
        console.error(`  (stopped early — have ${urls.length} urls, --limit ${limit})`)
        break
      }
      try {
        const xml = await fetchText(child)
        const locs = extractTags(xml, 'loc')
        console.error(`  ${child} → ${locs.length} urls`)
        urls.push(...locs)
      } catch (e) {
        console.error(`  FAIL ${child}: ${e.message}`)
      }
    }
  } else {
    urls = childSitemaps
    console.error(`Flat urlset: ${urls.length} urls`)
  }

  // de-dupe preserve order
  const seen = new Set()
  urls = urls.filter((u) => {
    if (seen.has(u)) return false
    seen.add(u)
    return true
  })

  const slice = Number.isFinite(limit) && limit > 0 ? urls.slice(0, limit) : urls

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          base: BASE,
          index: INDEX,
          child_sitemaps: isIndex ? childSitemaps : [],
          total: urls.length,
          returned: slice.length,
          urls: slice,
        },
        null,
        2,
      ),
    )
  } else {
    for (const u of slice) console.log(u)
    console.error(`\nTotal unique URLs: ${urls.length}${limit ? ` (printed ${slice.length})` : ''}`)
    console.error('GSC console ops (coverage, submit, URL inspection) remain human — A3 residual.')
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})

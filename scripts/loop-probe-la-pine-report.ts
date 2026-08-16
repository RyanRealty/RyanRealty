/**
 * Reproduce fleet 75370225805bb52d38b151ced2dab5c1:
 * hub publishes La Pine figures; /housing-market/la-pine 404s.
 *
 *   npx tsx scripts/loop-probe-la-pine-report.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const MULTI_WORD = [
  'la pine',
  'la-pine',
  'powell butte',
  'powell-butte',
  'black butte ranch',
  'black-butte-ranch',
  'camp sherman',
  'camp-sherman',
  'crooked river ranch',
  'crooked-river-ranch',
]

async function fetchPage(path: string) {
  const res = await fetch(`https://ryan-realty.com${path}`, {
    redirect: 'follow',
    headers: { 'user-agent': UA, accept: 'text/html' },
  })
  const html = await res.text()
  return {
    path,
    status: res.status,
    fallback404: /NEXT_HTTP_ERROR_FALLBACK;404|This page could not be found/i.test(html),
    hasLaPine: /La Pine/i.test(html),
    has175: /\b175\b/.test(html),
    has500000: /\$500,000|\$500K|500,000/.test(html),
    hasEmDashWidget: /—/.test(html) && /SFR|for sale|median/i.test(html),
    title: (html.match(/<title>([^<]+)<\/title>/i) ?? [])[1] ?? null,
    snippet: html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 400),
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)

  const [pulseRes, statsRes, pages] = await Promise.all([
    sb
      .from('market_pulse_live')
      .select('geo_type,geo_slug,geo_label,property_type,active_count,median_list_price,median_days_to_pending,updated_at,methodology_version')
      .eq('geo_type', 'city')
      .eq('property_type', 'A')
      .in('geo_slug', MULTI_WORD),
    sb
      .from('market_stats_cache')
      .select('geo_type,geo_slug,period_type,sold_count,median_sale_price,period_end')
      .eq('geo_type', 'city')
      .in('geo_slug', MULTI_WORD)
      .in('period_type', ['monthly', 'ytd', 'rolling_365d'])
      .order('period_end', { ascending: false }),
    Promise.all([
      fetchPage('/housing-market'),
      fetchPage('/housing-market/la-pine'),
      fetchPage('/housing-market/bend'),
      fetchPage('/homes-for-sale/la-pine'),
      fetchPage('/housing-market/powell-butte'),
      fetchPage('/housing-market/black-butte-ranch'),
      fetchPage('/housing-market/camp-sherman'),
    ]),
  ])

  if (pulseRes.error) throw new Error(pulseRes.error.message)
  if (statsRes.error) throw new Error(statsRes.error.message)

  const pulseBySlug = Object.fromEntries(
    (pulseRes.data ?? []).map((r) => [r.geo_slug, r]),
  )
  const statsCounts: Record<string, number> = {}
  for (const r of statsRes.data ?? []) {
    statsCounts[r.geo_slug] = (statsCounts[r.geo_slug] ?? 0) + 1
  }

  const out = {
    fetchedAt: new Date().toISOString(),
    pulseBySlug,
    statsRowCounts: statsCounts,
    production: pages,
  }
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

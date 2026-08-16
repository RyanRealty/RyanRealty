/**
 * Reproduce fleet 5439b87e: region SFR pulse vs Market-by-city rows.
 *
 *   npx tsx scripts/loop-probe-sfr-city-gap.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const HUB_LABELS = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'La Pine',
  'Tumalo',
  'Prineville',
  'Terrebonne',
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)

  const [regionRes, cityRes, htmlRes] = await Promise.all([
    sb
      .from('market_pulse_live')
      .select('geo_type,geo_slug,geo_label,property_type,active_count,median_list_price,updated_at,methodology_version')
      .eq('geo_type', 'region')
      .eq('geo_slug', 'central-oregon')
      .eq('property_type', 'A')
      .maybeSingle(),
    sb
      .from('market_pulse_live')
      .select('geo_type,geo_slug,geo_label,property_type,active_count,median_list_price,updated_at')
      .eq('geo_type', 'city')
      .eq('property_type', 'A')
      .order('geo_label'),
    fetch('https://ryan-realty.com/housing-market', { redirect: 'follow' }),
  ])

  if (regionRes.error) throw new Error(regionRes.error.message)
  if (cityRes.error) throw new Error(cityRes.error.message)

  const region = regionRes.data
  const cities = cityRes.data ?? []
  const html = await htmlRes.text()
  const status = htmlRes.status

  const hub = cities.filter((c) => HUB_LABELS.includes(String(c.geo_label)))
  const omitted = cities.filter((c) => !HUB_LABELS.includes(String(c.geo_label)))
  const hubSum = hub.reduce((n, c) => n + Number(c.active_count ?? 0), 0)
  const allCitySum = cities.reduce((n, c) => n + Number(c.active_count ?? 0), 0)
  const omittedSum = omitted.reduce((n, c) => n + Number(c.active_count ?? 0), 0)
  const regionCount = Number(region?.active_count ?? 0)

  const pulseMatch = html.match(/([\d,]+)\s*homes for sale, SFR pulse|homes for sale, SFR pulse[\s\S]{0,80}?([\d,]+)/i)
  const forSaleMatches = [...html.matchAll(/([\d,]+)\s+for sale/gi)].map((m) => m[1])
  const tumaloFoot = /Tumalo shows no active single-family/i.test(html)
  const omittedNamed = omitted
    .filter((c) => Number(c.active_count ?? 0) > 0)
    .map((c) => String(c.geo_label))
    .filter((label) => html.includes(label))

  const out = {
    fetchedAt: new Date().toISOString(),
    production: {
      status,
      forSaleMentions: forSaleMatches.slice(0, 20),
      tumaloFootnoteOnly: tumaloFoot,
      omittedCitiesNamedOnPage: omittedNamed,
    },
    pulse: {
      region: regionCount,
      methodology: region?.methodology_version ?? null,
      updatedAt: region?.updated_at ?? null,
      hubRows: hub.map((c) => ({
        label: c.geo_label,
        slug: c.geo_slug,
        active: Number(c.active_count ?? 0),
        median: c.median_list_price,
      })),
      hubSum,
      allCityRows: cities.map((c) => ({
        label: c.geo_label,
        slug: c.geo_slug,
        active: Number(c.active_count ?? 0),
        median: c.median_list_price,
      })),
      allCitySum,
      omittedRows: omitted.map((c) => ({
        label: c.geo_label,
        slug: c.geo_slug,
        active: Number(c.active_count ?? 0),
      })),
      omittedSum,
      gapRegionMinusHub: regionCount - hubSum,
      gapRegionMinusAllCities: regionCount - allCitySum,
    },
    reproduces:
      regionCount > 0 &&
      hubSum > 0 &&
      regionCount - hubSum > 0 &&
      omitted.filter((c) => Number(c.active_count ?? 0) > 0).length > 0 &&
      omittedNamed.length === 0,
  }
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

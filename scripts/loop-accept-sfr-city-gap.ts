/**
 * Accept fleet 5439b87e after production READY: region pulse vs city table
 * names omitted cities and the TIGER remainder.
 *
 *   npx tsx scripts/loop-accept-sfr-city-gap.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { namePulseCityRemainder, pulseCityHrefSlug } from '../lib/market/pulse-city-remainder'

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
] as const

const SURFACES = [
  'https://ryan-realty.com/housing-market',
  'https://ryan-realty.com/housing-market/central-oregon',
  'https://ryan-realty.com/housing-market/annual-review',
] as const

async function fetchHtml(url: string) {
  const res = await fetch(url, { redirect: 'follow', cache: 'no-store' })
  const html = await res.text()
  return { url, status: res.status, html }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const [regionRes, cityRes, pages] = await Promise.all([
    sb
      .from('market_pulse_live')
      .select('geo_type,geo_slug,geo_label,property_type,active_count,updated_at,methodology_version')
      .eq('geo_type', 'region')
      .eq('geo_slug', 'central-oregon')
      .eq('property_type', 'A')
      .maybeSingle(),
    sb
      .from('market_pulse_live')
      .select('geo_type,geo_slug,geo_label,property_type,active_count')
      .eq('geo_type', 'city')
      .eq('property_type', 'A')
      .order('geo_label'),
    Promise.all(SURFACES.map(fetchHtml)),
  ])
  if (regionRes.error) throw new Error(regionRes.error.message)
  if (cityRes.error) throw new Error(cityRes.error.message)

  const regionCount = Number(regionRes.data?.active_count ?? 0)
  const cities = (cityRes.data ?? []).map((c) => ({
    label: String(c.geo_label),
    active: Number(c.active_count ?? 0),
    slug: pulseCityHrefSlug(String(c.geo_slug || c.geo_label)),
  }))
  const named = namePulseCityRemainder({
    regionActive: regionCount,
    displayedLabels: HUB_LABELS,
    allCities: cities,
  })

  const pageResults = pages.map((page) => {
    const omittedNamed = named.omitted.filter((city) => page.html.includes(city.label))
    const omittedLinked = named.omitted.filter((city) =>
      page.html.includes(`/housing-market/${city.slug}`),
    )
    const remainderNamed =
      named.remainder != null && named.remainder > 0
        ? page.html.includes('sit outside a city-boundary row') ||
          page.html.includes('Outside city rows') ||
          page.html.includes(`${named.remainder.toLocaleString('en-US')} more`)
        : true
    const tumaloNamed = page.html.includes('Tumalo')
    const ok =
      page.status === 200 &&
      omittedNamed.length === named.omitted.length &&
      omittedLinked.length === named.omitted.length &&
      remainderNamed &&
      tumaloNamed
    return {
      url: page.url,
      status: page.status,
      omittedNamed: omittedNamed.map((c) => c.label),
      omittedMissing: named.omitted
        .filter((c) => !omittedNamed.includes(c))
        .map((c) => c.label),
      omittedLinked: omittedLinked.map((c) => c.slug),
      remainderNamed,
      tumaloNamed,
      ok,
    }
  })

  const out = {
    fetchedAt: new Date().toISOString(),
    pulse: {
      region: regionCount,
      methodology: regionRes.data?.methodology_version ?? null,
      updatedAt: regionRes.data?.updated_at ?? null,
      omitted: named.omitted,
      remainder: named.remainder,
      displayedSum: named.displayedSum,
      allCitySum: named.allCitySum,
    },
    pages: pageResults,
    accept: pageResults.every((p) => p.ok) && named.omitted.length > 0,
  }
  console.log(JSON.stringify(out, null, 2))
  if (!out.accept) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

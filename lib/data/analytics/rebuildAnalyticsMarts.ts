/**
 * Rebuild analytics_mart_* from closed CO sales.
 *
 * In-process implementation for /api/cron/rebuild-analytics-marts — Vercel
 * serverless does not ship scripts/, so spawn() of the CLI never wrote a row
 * (SPEC §1.8). Local CLI: scripts/analytics/rebuild-analytics-marts.mjs.
 *
 * Office share writes office_id from analytics_dim_office when the MLS string
 * matches canonical_name ∪ aliases. "No Office" is not inserted.
 *
 * Tumalo and Crooked River Ranch are not MLS City values (0 rows) and are
 * excluded from the closed-city IN list. Crooked River (no "Ranch") stays —
 * it is a real MLS City (AUDIT F16).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { ANALYTICS_CO_CITIES_PROPER } from '@/lib/data/analytics/co-cities'

export const PERMANENT_ZERO_MLS_CITY_LABELS = ['Tumalo', 'Crooked River Ranch'] as const

export function analyticsClosedCityLabels(): string[] {
  const drop = new Set<string>(PERMANENT_ZERO_MLS_CITY_LABELS)
  return ANALYTICS_CO_CITIES_PROPER.filter((c) => !drop.has(c))
}

export function normOfficeKey(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function isMlsNoOffice(name: string): boolean {
  return /^no office$/i.test(String(name || '').trim())
}

type DimOffice = {
  office_id: string
  canonical_name: string
  aliases: string[] | null
}

export type OfficeDimIndex = {
  byExact: Map<string, DimOffice>
  byNorm: Map<string, DimOffice>
}

export function buildOfficeDimIndex(dims: DimOffice[]): OfficeDimIndex {
  const byExact = new Map<string, DimOffice>()
  const byNorm = new Map<string, DimOffice>()
  for (const d of dims) {
    const names = [d.canonical_name, ...(d.aliases ?? [])]
    for (const n of names) {
      const t = String(n || '').trim()
      if (!t) continue
      const el = t.toLowerCase()
      if (!byExact.has(el)) byExact.set(el, d)
      const nk = normOfficeKey(t)
      if (nk && !byNorm.has(nk)) byNorm.set(nk, d)
    }
  }
  return { byExact, byNorm }
}

export function resolveOfficeId(officeName: string, index: OfficeDimIndex): string | null {
  const t = String(officeName || '').trim()
  if (!t || isMlsNoOffice(t)) return null
  return index.byExact.get(t.toLowerCase())?.office_id ?? index.byNorm.get(normOfficeKey(t))?.office_id ?? null
}

function typeScope(pt: string | null | undefined): 'sfr' | 'multi' | 'land' | 'other' {
  if (pt === 'A') return 'sfr'
  if (pt === 'B' || pt === 'C') return 'multi'
  if (pt === 'D') return 'land'
  return 'other'
}

function median(nums: number[]): number | null {
  if (!nums.length) return null
  const a = [...nums].sort((x, y) => x - y)
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2
}

const FEATURE_KEYS = ['fireplace', 'garage', 'association'] as const

function hasFeature(
  row: {
    fireplace_yn?: boolean | null
    fireplaces_total?: number | null
    garage_yn?: boolean | null
    association_yn?: boolean | null
  },
  key: (typeof FEATURE_KEYS)[number],
): boolean {
  if (key === 'fireplace') {
    return row.fireplace_yn === true || Number(row.fireplaces_total) > 0
  }
  if (key === 'garage') return row.garage_yn === true
  if (key === 'association') return row.association_yn === true
  return false
}

type ClosedRow = {
  ClosePrice: number | null
  City: string | null
  PropertyType: string | null
  ListOfficeName: string | null
  buyer_office_name: string | null
  CloseDate: string | null
  fireplace_yn: boolean | null
  fireplaces_total: number | null
  garage_yn: boolean | null
  association_yn: boolean | null
}

async function fetchClosedYear(sb: SupabaseClient, year: number, cities: string[]): Promise<ClosedRow[]> {
  const rows: ClosedRow[] = []
  let from = 0
  const page = 1000
  for (;;) {
    const { data, error } = await sb
      .from('listings')
      .select(
        'ClosePrice,City,PropertyType,ListOfficeName,buyer_office_name,CloseDate,fireplace_yn,fireplaces_total,garage_yn,association_yn',
      )
      .ilike('StandardStatus', '%Closed%')
      .gte('ClosePrice', 1000)
      .not('CloseDate', 'is', null)
      .in('City', cities)
      .gte('CloseDate', `${year}-01-01`)
      .lte('CloseDate', `${year}-12-31`)
      .order('ListingKey', { ascending: true })
      .range(from, from + page - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    rows.push(...(data as ClosedRow[]))
    if (data.length < page) break
    from += page
  }
  return rows
}

async function loadOfficeDims(sb: SupabaseClient): Promise<OfficeDimIndex> {
  const dims: DimOffice[] = []
  let from = 0
  const page = 1000
  for (;;) {
    const { data, error } = await sb
      .from('analytics_dim_office')
      .select('office_id,canonical_name,aliases')
      .range(from, from + page - 1)
    if (error) throw new Error(`dim office: ${error.message}`)
    if (!data?.length) break
    dims.push(...(data as DimOffice[]))
    if (data.length < page) break
    from += page
  }
  return buildOfficeDimIndex(dims)
}

async function rebuildYear(
  sb: SupabaseClient,
  year: number,
  cities: string[],
  officeIndex: OfficeDimIndex,
): Promise<{ year: number; n: number; officeIdSet: number; officeRows: number }> {
  const rows = await fetchClosedYear(sb, year, cities)

  const buckets: Record<string, number[]> = {
    all: [],
    sfr: [],
    multi: [],
    land: [],
    other: [],
  }
  const typeBreak: Record<string, number> = {}
  for (const r of rows) {
    const p = Number(r.ClosePrice)
    if (!Number.isFinite(p)) continue
    buckets.all!.push(p)
    buckets[typeScope(r.PropertyType)]!.push(p)
    const t = r.PropertyType || 'unknown'
    typeBreak[t] = (typeBreak[t] || 0) + 1
  }

  const computedAt = new Date().toISOString()
  const marketRows: Record<string, unknown>[] = Object.entries(buckets).map(([type_scope, prices]) => ({
    geo_type: 'region',
    geo_slug: 'central-oregon',
    year,
    type_scope,
    sold_count: prices.length,
    total_volume: prices.reduce((a, b) => a + b, 0),
    median_close: median(prices),
    mean_close: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
    property_type_breakdown: type_scope === 'all' ? typeBreak : {},
    methodology: 'closed_cte+service_area_v1',
    computed_at: computedAt,
  }))

  const byCity = new Map<
    string,
    {
      all: number[]
      sfr: number[]
      multi: number[]
      land: number[]
      other: number[]
      typeBreak: Record<string, number>
    }
  >()
  for (const r of rows) {
    const p = Number(r.ClosePrice)
    if (!Number.isFinite(p)) continue
    const city = (r.City || '').trim()
    if (!city) continue
    const slug = city.toLowerCase().replace(/\s+/g, '-')
    if (!byCity.has(slug)) {
      byCity.set(slug, { all: [], sfr: [], multi: [], land: [], other: [], typeBreak: {} })
    }
    const b = byCity.get(slug)!
    b.all.push(p)
    b[typeScope(r.PropertyType)].push(p)
    const t = r.PropertyType || 'unknown'
    b.typeBreak[t] = (b.typeBreak[t] || 0) + 1
  }
  for (const [slug, c] of byCity) {
    for (const [type_scope, prices] of Object.entries({
      all: c.all,
      sfr: c.sfr,
      multi: c.multi,
      land: c.land,
      other: c.other,
    })) {
      if (!prices.length) continue
      marketRows.push({
        geo_type: 'city',
        geo_slug: slug,
        year,
        type_scope,
        sold_count: prices.length,
        total_volume: prices.reduce((a, b) => a + b, 0),
        median_close: median(prices),
        mean_close: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
        property_type_breakdown: type_scope === 'all' ? c.typeBreak : {},
        methodology: 'closed_cte+service_area_v1',
        computed_at: computedAt,
      })
    }
  }

  const { error: mErr } = await sb.from('analytics_mart_market_annual').upsert(marketRows, {
    onConflict: 'geo_type,geo_slug,year,type_scope',
  })
  if (mErr) throw new Error(`market mart: ${mErr.message}`)

  let officeIdSet = 0
  let officeRows = 0
  for (const side of ['list', 'buy'] as const) {
    const map = new Map<string, { n: number; vol: number }>()
    for (const r of rows) {
      const name =
        side === 'list' ? (r.ListOfficeName || '').trim() : (r.buyer_office_name || '').trim()
      if (!name || isMlsNoOffice(name)) continue
      const p = Number(r.ClosePrice) || 0
      if (!map.has(name)) map.set(name, { n: 0, vol: 0 })
      const e = map.get(name)!
      e.n++
      e.vol += p
    }
    const totalN = rows.length
    const totalVol = buckets.all!.reduce((a, b) => a + b, 0)
    const ranked = [...map.entries()]
      .map(([office_name, v]) => ({
        office_name,
        office_id: resolveOfficeId(office_name, officeIndex),
        sides_count: v.n,
        total_volume: v.vol,
        volume_share_pct: totalVol ? (100 * v.vol) / totalVol : null,
        unit_share_pct: totalN ? (100 * v.n) / totalN : null,
      }))
      .sort((a, b) => b.total_volume - a.total_volume)
      .map((row, i) => ({
        geo_type: 'region',
        geo_slug: 'central-oregon',
        year,
        type_scope: 'all',
        side,
        office_name: row.office_name,
        office_id: row.office_id,
        sides_count: row.sides_count,
        total_volume: row.total_volume,
        volume_share_pct: row.volume_share_pct,
        unit_share_pct: row.unit_share_pct,
        rank_volume: i + 1,
        methodology: 'closed_cte+service_area_v1',
        computed_at: computedAt,
      }))
    officeIdSet += ranked.filter((r) => r.office_id).length
    officeRows += ranked.length

    await sb
      .from('analytics_mart_office_share_annual')
      .delete()
      .eq('geo_type', 'region')
      .eq('geo_slug', 'central-oregon')
      .eq('year', year)
      .eq('type_scope', 'all')
      .eq('side', side)

    const chunk = 200
    for (let i = 0; i < ranked.length; i += chunk) {
      const slice = ranked.slice(i, i + chunk)
      const { error } = await sb.from('analytics_mart_office_share_annual').insert(slice)
      if (error) throw new Error(`office mart ${side}: ${error.message}`)
    }
  }

  const marketN = buckets.all!.length
  const marketVol = buckets.all!.reduce((a, b) => a + b, 0)
  const featureRows = FEATURE_KEYS.map((feature_key) => {
    const prices: number[] = []
    for (const r of rows) {
      const p = Number(r.ClosePrice)
      if (!Number.isFinite(p)) continue
      if (hasFeature(r, feature_key)) prices.push(p)
    }
    return {
      geo_type: 'region',
      geo_slug: 'central-oregon',
      year,
      type_scope: 'all',
      feature_key,
      sold_count: prices.length,
      total_volume: prices.reduce((a, b) => a + b, 0),
      median_close: median(prices),
      mean_close: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
      market_sold_count: marketN,
      market_volume: marketVol,
      unit_share_pct: marketN ? (100 * prices.length) / marketN : null,
      volume_share_pct: marketVol ? (100 * prices.reduce((a, b) => a + b, 0)) / marketVol : null,
      methodology: 'closed_cte+service_area_v1+feature_typed_v1',
      computed_at: computedAt,
    }
  })
  const { error: fErr } = await sb.from('analytics_mart_feature_annual').upsert(featureRows, {
    onConflict: 'geo_type,geo_slug,year,type_scope,feature_key',
  })
  if (fErr) {
    console.warn('feature mart upsert skipped:', fErr.message)
  }

  if (year === 2024) {
    const all = marketRows.find((r) => r.type_scope === 'all' && r.geo_type === 'region')
    const edaN = 5707
    const nErr = Math.abs(Number(all?.sold_count) - edaN) / edaN
    if (nErr >= 0.005) {
      throw new Error(`PARITY FAIL sold_count ${String(all?.sold_count)} vs ${edaN}`)
    }
  }

  return { year, n: rows.length, officeIdSet, officeRows }
}

export async function rebuildAnalyticsMarts(opts: {
  fromYear: number
  toYear: number
  supabase: SupabaseClient
}): Promise<{
  fromYear: number
  toYear: number
  years: { year: number; n: number; officeIdSet: number; officeRows: number }[]
}> {
  const cities = analyticsClosedCityLabels()
  const officeIndex = await loadOfficeDims(opts.supabase)
  const years = []
  for (let y = opts.fromYear; y <= opts.toYear; y++) {
    years.push(await rebuildYear(opts.supabase, y, cities, officeIndex))
  }
  return { fromYear: opts.fromYear, toYear: opts.toYear, years }
}

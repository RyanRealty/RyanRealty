/**
 * The parcel layer's nightly refresh.
 *
 * A county's cadastre is not a one-time load: lots are partitioned, replatted
 * and merged. But it is a SMALL change. Measured against Deschutes on
 * 2026-09-02: 3 lots edited in the week, 31 in the month, 1,462 so far this
 * year, out of 109,505. So the job asks the county what it edited since our
 * last clean run and pulls only those, rather than the county again.
 *
 * The cutoff lives in public.taxlot_refreshes, not in this code: a job that
 * guesses its own window silently misses a night. Every run is recorded, and a
 * run that could not read part of its window is marked not-ok, so the next one
 * re-covers it.
 *
 * Server only. The write RPC is service-role.
 */
import 'server-only'

export type TaxlotDeltaLayer = {
  /** Where the edit stamp lives. Not always the layer the geometry lives in. */
  url: string
  dateField: string
  idField: string
}

export type TaxlotCounty = {
  county: string
  label: string
  /** The authoritative geometry layer. */
  url: string
  source: string
  fields: { id: string; map: string | null; dial: string | null }
  delta: TaxlotDeltaLayer
}

/**
 * Deschutes. The geometry comes from the OpenData layer, which holds exactly
 * one row per lot; the edit stamp comes from the DIAL layer, which carries
 * AUTODATE but joins mailing records one-to-many. The write RPC dedupes, so
 * the join costs nothing here.
 */
export const TAXLOT_COUNTIES: Record<string, TaxlotCounty> = {
  deschutes: {
    county: 'deschutes',
    label: 'Deschutes',
    url: 'https://maps.deschutes.org/arcgis/rest/services/OpenData/LandFD/MapServer/2',
    source: "Deschutes County Assessor's Office, taxlot layer",
    fields: { id: 'TAXLOT', map: 'MAPNUMBER', dial: 'DIAL' },
    delta: {
      url: 'https://maps.deschutes.org/arcgis/rest/services/Dial2_Taxlots/MapServer/0',
      dateField: 'Taxlot_Assessor_Account.AUTODATE',
      idField: 'Taxlot_Assessor_Account.TAXLOT',
    },
  },
}

export type TaxlotRefreshResult = {
  ok: boolean
  county: string
  since: string
  changed: number
  written: number
  gaps: { taxlots: number; why: string }[]
}

type Creds = { url: string; key: string }

function creds(): Creds | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return url && key ? { url, key } : null
}

async function rpc<T>({ url, key }: Creds, name: string, body: unknown): Promise<T> {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${name} → HTTP ${res.status} ${text.slice(0, 220)}`)
  return (text ? JSON.parse(text) : null) as T
}

/** Which lots the county has edited since a date. */
async function changedTaxlots(layer: TaxlotCounty, sinceDate: string): Promise<string[]> {
  const u = new URL(`${layer.delta.url}/query`)
  u.searchParams.set('where', `${layer.delta.dateField} > date '${sinceDate}'`)
  u.searchParams.set('outFields', layer.delta.idField)
  u.searchParams.set('returnGeometry', 'false')
  u.searchParams.set('f', 'json')
  const res = await fetch(u, { cache: 'no-store' })
  if (!res.ok) throw new Error(`delta → HTTP ${res.status}`)
  const body = (await res.json()) as {
    error?: unknown
    features?: { attributes?: Record<string, unknown> }[]
  }
  if (body.error) throw new Error(`delta → ${JSON.stringify(body.error).slice(0, 200)}`)
  const ids = (body.features ?? [])
    .map((f) => String(f.attributes?.[layer.delta.idField] ?? '').trim())
    .filter(Boolean)
  return [...new Set(ids)]
}


/**
 * Esri rings to a GeoJSON polygon. The county's GeoJSON writer refuses some
 * lots outright — a donut parcel answers HTTP 400 as geojson and returns
 * perfectly as Esri json — and those were 46 of 207 changed lots in a
 * three-month window, so this fallback is not an edge case.
 *
 * Esri gives one flat list of rings with no nesting: a clockwise ring is an
 * outer boundary and a counter-clockwise one is a hole. Signed area tells them
 * apart, and each hole joins the last outer ring opened.
 */
function ringsToGeoJson(rings: number[][][]): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  const area = (r: number[][]): number => {
    let a = 0
    for (let i = 1; i < r.length; i += 1) a += r[i - 1]![0]! * r[i]![1]! - r[i]![0]! * r[i - 1]![1]!
    return a / 2
  }
  const polys: number[][][][] = []
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 4) continue
    if (area(ring) < 0) polys.push([ring])
    else if (polys.length > 0) polys[polys.length - 1]!.push(ring)
    else polys.push([ring])
  }
  if (polys.length === 0) return null
  return polys.length === 1
    ? ({ type: 'Polygon', coordinates: polys[0] } as GeoJSON.Polygon)
    : ({ type: 'MultiPolygon', coordinates: polys } as GeoJSON.MultiPolygon)
}


/** The same lots as Esri rings, converted here, when GeoJSON is refused. */
async function esriFallback(layer: TaxlotCounty, list: string) {
  const res = await fetch(`${layer.url}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      where: `${layer.fields.id} IN (${list})`,
      outFields: [layer.fields.id, layer.fields.map, layer.fields.dial].filter(Boolean).join(','),
      returnGeometry: 'true',
      outSR: '4326',
      f: 'json',
    }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`geometry (esri) → HTTP ${res.status}`)
  const body = (await res.json()) as {
    error?: unknown
    features?: { attributes?: Record<string, unknown>; geometry?: { rings?: number[][][] } }[]
  }
  if (body.error) throw new Error(`geometry → ${JSON.stringify(body.error).slice(0, 200)}`)
  return (body.features ?? []).flatMap((f) => {
    const geometry = ringsToGeoJson(f.geometry?.rings ?? [])
    return geometry ? [{ properties: f.attributes ?? {}, geometry }] : []
  })
}

/** The geometry for a named set of lots, from the authoritative layer. */
async function geometryFor(layer: TaxlotCounty, taxlots: string[]) {
  const list = taxlots.map((t) => `'${t.replace(/'/g, "''")}'`).join(',')
  // POST, not a query string: a hundred quoted ids exceeds what the service
  // will accept in a URL, and a batch that fails leaves a lot with a stale
  // shape and nothing to say so.
  const res = await fetch(`${layer.url}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      where: `${layer.fields.id} IN (${list})`,
      outFields: [layer.fields.id, layer.fields.map, layer.fields.dial].filter(Boolean).join(','),
      returnGeometry: 'true',
      outSR: '4326',
      f: 'geojson',
    }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`geometry → HTTP ${res.status}`)
  const body = (await res.json()) as {
    error?: unknown
    features?: { properties?: Record<string, unknown>; geometry?: { type?: string } }[]
  }
  const features = body.error ? await esriFallback(layer, list) : (body.features ?? [])
  return features.flatMap((f) => {
    const props = f.properties ?? {}
    const id = String(props[layer.fields.id] ?? '').trim()
    const geom = f.geometry
    if (!id || !geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) return []
    return [
      {
        taxlot: id,
        map_number: layer.fields.map ? (props[layer.fields.map] ?? null) : null,
        dial_url: layer.fields.dial ? (props[layer.fields.dial] ?? null) : null,
        geojson: geom,
      },
    ]
  })
}

/**
 * Run the refresh for one county. `sinceOverride` is for a backfill; normally
 * the cutoff comes from the ledger, already stepped back a few days because an
 * assessor's edit stamp can land after the edit.
 */
export async function refreshTaxlots(
  countyKey: string,
  sinceOverride?: string,
): Promise<TaxlotRefreshResult> {
  const layer = TAXLOT_COUNTIES[countyKey]
  if (!layer) throw new Error(`no taxlot layer declared for "${countyKey}"`)
  const c = creds()
  if (!c) throw new Error('Supabase service role is not configured')

  const cutoff =
    sinceOverride ??
    String(await rpc<string>(c, 'taxlot_refresh_cutoff', { p_county: layer.county, p_overlap_days: 3 }))
  const since = cutoff.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error(`bad cutoff "${cutoff}"`)

  const changed = await changedTaxlots(layer, since)
  let written = 0
  const gaps: { taxlots: number; why: string }[] = []

  /**
   * One batch, halving on failure. The service refuses a request whose
   * RESPONSE it cannot serialise — one very large multipart lot is enough —
   * so a fixed batch size either wastes round trips or loses lots. Halving
   * finds the boundary, and a single lot that still fails is recorded as a
   * gap rather than dropped in silence.
   */
  const write = async (batch: string[], depth = 0): Promise<void> => {
    try {
      const rows = await geometryFor(layer, batch)
      if (rows.length > 0) {
        written += await rpc<number>(c, 'upsert_taxlots', {
          p_county: layer.county,
          p_source: layer.source,
          p_source_url: layer.url,
          p_features: rows,
          // The authoritative layer answers in WGS84 when asked; the bulk
          // export does not, which is why the RPC takes a projection at all.
          p_srid: 4326,
        })
      }
    } catch (err) {
      if (batch.length === 1 || depth > 8) {
        gaps.push({ taxlots: batch.length, why: err instanceof Error ? err.message : String(err) })
        return
      }
      const mid = Math.ceil(batch.length / 2)
      await write(batch.slice(0, mid), depth + 1)
      await write(batch.slice(mid), depth + 1)
    }
  }

  for (let i = 0; i < changed.length; i += 40) {
    await write(changed.slice(i, i + 40))
  }

  await rpc(c, 'record_taxlot_refresh', {
    p_county: layer.county,
    p_mode: 'delta',
    p_since: `${since}T00:00:00Z`,
    p_changed: changed.length,
    p_written: written,
    p_gaps: gaps,
    p_note: null,
  })

  return { ok: gaps.length === 0, county: layer.county, since, changed: changed.length, written, gaps }
}

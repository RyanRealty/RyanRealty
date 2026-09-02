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
 * THAT ONLY WORKS WHERE A COUNTY STAMPS ITS EDITS. Deschutes does. Klamath,
 * Josephine and Medford do not — no edit date, and Klamath's Sync capability
 * turns out to carry no change tracking. There is nothing to ask them for, so
 * those three are swept whole from the CLI on a cadence, and this job's job is
 * to notice when one has gone stale and say which command fixes it. A county
 * that quietly stops updating is the failure this guards against.
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
  /** What the layer actually covers. Not every source is a whole county. */
  coverage: string
  /**
   * Present only where the county stamps a row with an edit date. Without one
   * there is nothing to ask "what changed", and the county is swept instead.
   */
  delta?: TaxlotDeltaLayer
  /**
   * Declared instead of `delta`. `everyDays` is how long a sweep may go stale
   * before this job says so out loud.
   */
  sweep?: { everyDays: number }
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
    coverage: 'the whole county',
    delta: {
      url: 'https://maps.deschutes.org/arcgis/rest/services/Dial2_Taxlots/MapServer/0',
      dateField: 'Taxlot_Assessor_Account.AUTODATE',
      idField: 'Taxlot_Assessor_Account.TAXLOT',
    },
  },

  /*
   * The other three counties we carry listings in publish NO per-row edit
   * date, so no delta exists to run. Klamath advertises Sync, but asked for
   * changes directly it answers "Change tracking is not enabled", and its two
   * date fields are one publish date repeated on every row. These are swept
   * whole by scripts/gis/import-taxlots.mjs; this job's part is to say so when
   * a sweep has gone stale, so a county cannot rot quietly.
   *
   * Sixty days: measured churn on a cadastre is a few lots a week out of a
   * hundred thousand, so a two-month-old sweep is still an accurate map. The
   * point of the deadline is to notice a county we forgot, not to chase edits.
   */
  klamath: {
    county: 'klamath',
    label: 'Klamath',
    url: 'https://services.arcgis.com/H6Mh1bySxR4oHx6x/arcgis/rest/services/KC_Taxlots/FeatureServer/1',
    source: 'Klamath County GIS, taxlot layer',
    fields: { id: 'PROP_ID', map: 'MapNumber', dial: null },
    coverage: 'the whole county',
    sweep: { everyDays: 60 },
  },
  josephine: {
    county: 'josephine',
    label: 'Josephine',
    url: 'https://services3.arcgis.com/qwqIu50nUr6wRrbz/arcgis/rest/services/JoCo_Taxlot/FeatureServer/0',
    source: 'Josephine County GIS, taxlot layer',
    fields: { id: 'ACCOUNT', map: 'MapNum', dial: null },
    coverage: 'the whole county',
    sweep: { everyDays: 60 },
  },
  jackson: {
    county: 'jackson',
    label: 'Jackson',
    url: 'https://maps.medfordmaps.org/arcgis/rest/services/Public/Taxlots_with_SiteAddresses_Service/FeatureServer/1',
    source: 'City of Medford GIS, taxlots within the city',
    fields: { id: 'ACCOUNT', map: 'MAPNUM', dial: null },
    coverage: 'the City of Medford only, not all of Jackson County',
    sweep: { everyDays: 60 },
  },
}

export type TaxlotRefreshResult = {
  ok: boolean
  county: string
  since: string
  changed: number
  written: number
  gaps: { taxlots: number; why: string }[]
  /** How the county is kept current. A sweep county runs no work here. */
  mode?: 'delta' | 'sweep'
  /** Set on a sweep county: what this job checked and what it found. */
  sweptDaysAgo?: number | null
  note?: string
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

/**
 * Days since this county's last clean whole-layer sweep, or null if it has
 * never had one.
 *
 * A single filtered row off the refresh ledger, read through PostgREST with
 * the service key this module already holds. It is operational state about our
 * own jobs — not listing or market data — so it belongs here rather than
 * behind the page DAL, and it is a one-row lookup, not an aggregate.
 */
async function daysSinceSweep({ url, key }: Creds, county: string): Promise<number | null> {
  const q = new URLSearchParams({
    select: 'ran_at',
    county: `eq.${county}`,
    mode: 'eq.full',
    ok: 'is.true',
    order: 'ran_at.desc',
    limit: '1',
  })
  const res = await fetch(`${url}/rest/v1/taxlot_refreshes?${q}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`taxlot_refreshes → HTTP ${res.status}`)
  const rows = (await res.json()) as { ran_at?: string }[]
  const at = rows[0]?.ran_at
  if (!at) return null
  const ms = Date.now() - new Date(at).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.floor(ms / 86_400_000)
}

/**
 * Which lots the county has edited since a date. Takes the delta layer rather
 * than the county, so a county that declares none cannot reach this at all.
 */
async function changedTaxlots(delta: TaxlotDeltaLayer, sinceDate: string): Promise<string[]> {
  const u = new URL(`${delta.url}/query`)
  u.searchParams.set('where', `${delta.dateField} > date '${sinceDate}'`)
  u.searchParams.set('outFields', delta.idField)
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
    .map((f) => String(f.attributes?.[delta.idField] ?? '').trim())
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

  // A county with no edit stamp has no delta to run. Report how stale its last
  // whole-layer sweep is instead: the job's whole value here is that a county
  // we forgot becomes visible rather than quietly serving a two-year-old map.
  if (!layer.delta) {
    const days = await daysSinceSweep(c, layer.county)
    const limit = layer.sweep?.everyDays ?? 60
    const fresh = days != null && days <= limit
    return {
      ok: fresh,
      county: layer.county,
      since: '',
      changed: 0,
      written: 0,
      gaps: [],
      mode: 'sweep',
      sweptDaysAgo: days,
      note:
        days == null
          ? `${layer.label} has never been swept. Run: node scripts/gis/import-taxlots.mjs --county ${layer.county} --write`
          : fresh
            ? `${layer.label} swept ${days} days ago, covering ${layer.coverage}. This county publishes no edit date, so there is no delta to run.`
            : `${layer.label} was last swept ${days} days ago, past its ${limit}-day limit. Run: node scripts/gis/import-taxlots.mjs --county ${layer.county} --write`,
    }
  }

  const cutoff =
    sinceOverride ??
    String(await rpc<string>(c, 'taxlot_refresh_cutoff', { p_county: layer.county, p_overlap_days: 3 }))
  const since = cutoff.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error(`bad cutoff "${cutoff}"`)

  const changed = await changedTaxlots(layer.delta, since)
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

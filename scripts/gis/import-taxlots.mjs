#!/usr/bin/env node
/**
 * Tax lot polygons from a county's own open ArcGIS layer into public.taxlots.
 *
 * Deschutes publishes every parcel at OpenData/LandFD/MapServer/2 and describes
 * it as "all parcels in Deschutes County, as found on the county Assessor's
 * Maps" — 109,505 of them, measured 2026-09-02. That is an assessor's record,
 * NOT a survey; every surface that draws one carries the disclaimer.
 *
 * Paging is by OBJECTID window, not resultOffset: this service refuses an
 * unbounded geometry query (`where=1=1` with returnGeometry answers HTTP 400)
 * but answers a bounded id range happily, and its ids are contiguous 1..N. So
 * a county is ~110 round trips of 1,000. Each page goes to
 * public.upsert_taxlots in one call rather than one call per parcel.
 *
 * Usage:
 *   node scripts/gis/import-taxlots.mjs --county deschutes            # dry run
 *   node scripts/gis/import-taxlots.mjs --county deschutes --write
 *   node scripts/gis/import-taxlots.mjs --county deschutes --write --limit 5000
 *
 * Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local. The write RPC
 * is service-role only; nothing public writes parcels.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const WORKDIR = path.join(ROOT, '.taxlot-work')

function mkdirSyncSafe(dir) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('node:fs').mkdirSync(dir, { recursive: true })
  } catch {
    /* created by the download that follows */
  }
}

/**
 * One entry per county we can read. `id` is the county's own tax lot field and
 * `map` its assessor map sheet; a county that names them differently declares
 * that here rather than in the code below.
 */
const COUNTIES = {
  deschutes: {
    label: 'Deschutes',
    url: 'https://maps.deschutes.org/arcgis/rest/services/OpenData/LandFD/MapServer/2',
    source: "Deschutes County Assessor's Office, taxlot layer",
    fields: { id: 'TAXLOT', map: 'MAPNUMBER', dial: 'DIAL' },
    pageSize: 1000,
    /**
     * The delta layer. LandFD/2 carries no edit stamp, so a refresh asks the
     * DIAL layer, which does: `AUTODATE` is the assessor's own edit date. It
     * joins mailing records one-to-many, so it over-reports rows — harmless
     * here because upsert_taxlots dedupes a batch to one row per lot.
     * Churn measured 2026-09-02: 3 lots in the last week, 31 in a month,
     * 1,462 so far this year, against 109,505 in the county.
     */
    /**
     * The county's whole-layer GeoJSON export. Ships in EPSG:3857, which the
     * upsert reprojects — nothing here guesses a projection.
     */
    bulk: {
      url: 'https://data-deschutes.opendata.arcgis.com/api/download/v1/items/901cdd4a5ca24cc3b72cc8e3e0f11f02/geojson?layers=0',
      srid: 3857,
      fields: { id: 'TAXLOT', map: 'MAPNUMBER', dial: 'DIAL' },
    },
    delta: {
      url: 'https://maps.deschutes.org/arcgis/rest/services/Dial2_Taxlots/MapServer/0',
      dateField: 'Taxlot_Assessor_Account.AUTODATE',
      fields: { id: 'Taxlot_Assessor_Account.TAXLOT', map: null, dial: null },
    },
  },
}

const args = process.argv.slice(2)
function arg(name, fallback = null) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const WRITE = args.includes('--write')
const COUNTY = (arg('county', 'deschutes') || '').toLowerCase()
const LIMIT = Number(arg('limit', '0')) || 0
// Resume: skip the first N windows on a rerun.
const FROM = Number(arg('from', '0')) || 0
// Delta mode: only the lots the county has edited since a date. `--since auto`
// asks the refresh ledger for the cutoff.
const SINCE = arg('since', null)
// Page size override: the service answers 400 on a window holding a very large
// multipart lot, and a smaller page steps around it faster than bisection.
const PAGE = Number(arg('page', '0')) || 0
// Bulk mode: the county's own whole-layer export. One 123 MB file in twelve
// seconds against 438 paged requests the service serves slowly through the
// large-lot ranges. This is how the initial load should be done; the paged
// walk survives for a county that publishes no bulk item.
const BULK = args.includes('--bulk')
const BULK_FILE = arg('file', null)

function log(msg) {
  process.stdout.write(`[taxlots] ${msg}\n`)
}

function env() {
  const file = path.join(ROOT, '.env.local')
  const text = readFileSync(file, 'utf8')
  const read = (key) => {
    const m = text.match(new RegExp(`^${key}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : null
  }
  const url = read('NEXT_PUBLIC_SUPABASE_URL') ?? read('SUPABASE_URL')
  const key = read('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('.env.local is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return { url, key }
}

async function countFeatures(layer) {
  const u = new URL(`${layer.url}/query`)
  u.searchParams.set('where', '1=1')
  u.searchParams.set('returnCountOnly', 'true')
  u.searchParams.set('f', 'json')
  const res = await fetch(u)
  if (!res.ok) throw new Error(`count → HTTP ${res.status}`)
  const body = await res.json()
  if (typeof body.count !== 'number') throw new Error(`count → ${JSON.stringify(body).slice(0, 200)}`)
  return body.count
}

/** Every object id the layer holds, in one call, so the pager knows its window. */
async function fetchIds(layer) {
  const u = new URL(`${layer.url}/query`)
  u.searchParams.set('where', '1=1')
  u.searchParams.set('returnIdsOnly', 'true')
  u.searchParams.set('f', 'json')
  const res = await fetch(u)
  if (!res.ok) throw new Error(`ids → HTTP ${res.status}`)
  const body = await res.json()
  const ids = body.objectIds
  if (!Array.isArray(ids) || ids.length === 0) throw new Error(`ids → ${JSON.stringify(body).slice(0, 200)}`)
  const field = body.objectIdFieldName || 'OBJECTID'
  return { ids: ids.sort((a, b) => a - b), field }
}

/**
 * One page, as GeoJSON in WGS84, bounded by an object id window. `f=geojson` is
 * asked for by name so the rings arrive wound the way PostGIS reads them; a
 * service that answers with an Esri envelope instead fails loudly rather than
 * writing nonsense.
 */
async function fetchWindowOnce(layer, field, lo, hi) {
  const u = new URL(`${layer.url}/query`)
  u.searchParams.set('where', `${field}>=${lo} AND ${field}<=${hi}`)
  u.searchParams.set('outFields', [layer.fields.id, layer.fields.map, layer.fields.dial].filter(Boolean).join(','))
  u.searchParams.set('returnGeometry', 'true')
  u.searchParams.set('outSR', '4326')
  u.searchParams.set('f', 'geojson')
  const res = await fetch(u)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = await res.json()
  if (body.error) throw new Error(JSON.stringify(body.error).slice(0, 200))
  if (!Array.isArray(body.features)) throw new Error('no features array')
  return body.features
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * One window, with the two things a county ArcGIS service needs from a client:
 * a retry, because it answers 400 under load; and a bisection, because one
 * window holding a very large multipart lot can exceed what it will serialise.
 * A window that still fails after both is RETURNED as a gap rather than
 * swallowed — a silent hole in a parcel layer is a wrong map.
 */
async function fetchWindow(layer, field, lo, hi, gaps, depth = 0) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetchWindowOnce(layer, field, lo, hi)
    } catch (err) {
      if (attempt === 2) {
        if (hi - lo < 8 || depth > 6) {
          gaps.push({ lo, hi, why: err instanceof Error ? err.message : String(err) })
          return []
        }
        const mid = Math.floor((lo + hi) / 2)
        const left = await fetchWindow(layer, field, lo, mid, gaps, depth + 1)
        const right = await fetchWindow(layer, field, mid + 1, hi, gaps, depth + 1)
        return [...left, ...right]
      }
      await sleep(600 * (attempt + 1))
    }
  }
  return []
}


/**
 * Esri rings to a GeoJSON polygon. The county's GeoJSON writer refuses some
 * lots outright — a donut parcel answers HTTP 400 as geojson and returns
 * perfectly as Esri json — and those were 46 of 207 changed lots in a
 * three-month window, so the fallback is not an edge case.
 *
 * Esri gives one flat list of rings with no nesting: a clockwise ring is an
 * outer boundary and a counter-clockwise one is a hole. Signed area tells them
 * apart, and each hole joins the last outer ring opened.
 */
function ringsToGeoJson(rings) {
  const area = (r) => {
    let a = 0
    for (let i = 1; i < r.length; i += 1) a += r[i - 1][0] * r[i][1] - r[i][0] * r[i - 1][1]
    return a / 2
  }
  const polys = []
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 4) continue
    if (area(ring) < 0) polys.push([ring])
    else if (polys.length > 0) polys[polys.length - 1].push(ring)
    else polys.push([ring])
  }
  if (polys.length === 0) return null
  return polys.length === 1
    ? { type: 'Polygon', coordinates: polys[0] }
    : { type: 'MultiPolygon', coordinates: polys }
}

function toRow(feature, layer) {
  const p = feature.properties ?? {}
  const id = String(p[layer.fields.id] ?? '').trim()
  if (!id) return null
  const geom = feature.geometry
  if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) return null
  return {
    taxlot: id,
    map_number: p[layer.fields.map] != null ? String(p[layer.fields.map]) : null,
    dial_url: layer.fields.dial && p[layer.fields.dial] != null ? String(p[layer.fields.dial]) : null,
    geojson: geom,
  }
}

async function upsert({ url, key }, county, layer, rows, srid = 4326) {
  const res = await fetch(`${url}/rest/v1/rpc/upsert_taxlots`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_county: county,
      p_source: layer.source,
      p_source_url: layer.url,
      p_features: rows,
      p_srid: srid,
    }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`upsert → HTTP ${res.status} ${text.slice(0, 300)}`)
  return Number(text) || 0
}

/** How many lots the county says changed since a date, and which. */
async function fetchChangedIds(layer, sinceIso) {
  const d = layer.delta
  if (!d) throw new Error('no delta layer declared for this county')
  const u = new URL(`${d.url}/query`)
  u.searchParams.set('where', `${d.dateField} > date '${sinceIso}'`)
  u.searchParams.set('outFields', d.fields.id)
  u.searchParams.set('returnGeometry', 'false')
  u.searchParams.set('f', 'json')
  const res = await fetch(u)
  if (!res.ok) throw new Error(`delta → HTTP ${res.status}`)
  const body = await res.json()
  if (body.error) throw new Error(`delta → ${JSON.stringify(body.error).slice(0, 200)}`)
  const ids = (body.features ?? [])
    .map((f) => String(f.attributes?.[d.fields.id] ?? '').trim())
    .filter(Boolean)
  return [...new Set(ids)]
}

/** The geometry for a named set of lots, from the authoritative layer. */
async function fetchByTaxlots(layer, taxlots) {
  const list = taxlots.map((t) => `'${t.replace(/'/g, "''")}'`).join(',')
  const form = new URLSearchParams({
    where: `${layer.fields.id} IN (${list})`,
    outFields: [layer.fields.id, layer.fields.map, layer.fields.dial].filter(Boolean).join(','),
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
  })
  const res = await fetch(`${layer.url}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  if (!res.ok) throw new Error(`by-taxlot → HTTP ${res.status}`)
  const body = await res.json()
  if (!body.error) return body.features ?? []

  // The GeoJSON writer refused these lots; ask for Esri rings instead.
  form.set('f', 'json')
  const alt = await fetch(`${layer.url}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  if (!alt.ok) throw new Error(`by-taxlot (esri) → HTTP ${alt.status}`)
  const altBody = await alt.json()
  if (altBody.error) throw new Error(`by-taxlot → ${JSON.stringify(altBody.error).slice(0, 200)}`)
  return (altBody.features ?? []).flatMap((f) => {
    const geometry = ringsToGeoJson(f.geometry?.rings ?? [])
    return geometry ? [{ type: 'Feature', properties: f.attributes ?? {}, geometry }] : []
  })
}

async function rpc({ url, key }, name, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${name} → HTTP ${res.status} ${text.slice(0, 240)}`)
  return text ? JSON.parse(text) : null
}

/**
 * The refresh: ask the county what it edited since our last clean run, pull
 * only those lots, and write the run to the ledger so the next one knows its
 * cutoff. A full re-ingest is the fallback, not the routine.
 */
async function runDelta(layer, creds) {
  let sinceIso = SINCE
  if (SINCE === 'auto') {
    if (!creds) throw new Error('--since auto needs --write, because the cutoff lives in the ledger')
    const cutoff = await rpc(creds, 'taxlot_refresh_cutoff', { p_county: COUNTY, p_overlap_days: 3 })
    sinceIso = String(cutoff).slice(0, 10)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(sinceIso))) {
    throw new Error(`--since wants YYYY-MM-DD or "auto", got "${SINCE}"`)
  }

  const changed = await fetchChangedIds(layer, sinceIso)
  log(`${layer.label}: ${changed.length} lot(s) edited since ${sinceIso}`)
  if (!WRITE) {
    log(`DRY RUN — would refresh ${changed.length}. First few: ${changed.slice(0, 5).join(', ') || 'none'}`)
    return
  }
  if (changed.length === 0) {
    await rpc(creds, 'record_taxlot_refresh', {
      p_county: COUNTY, p_mode: 'delta', p_since: `${sinceIso}T00:00:00Z`,
      p_changed: 0, p_written: 0, p_gaps: [], p_note: 'nothing changed',
    })
    log('nothing changed; ledger updated')
    return
  }

  let written = 0
  const gaps = []
  // Halve on failure: the service refuses a request whose response it cannot
  // serialise, and one large multipart lot is enough to trip it.
  const write = async (batch, depth = 0) => {
    try {
      const features = await fetchByTaxlots(layer, batch)
      const rows = features.map((f) => toRow(f, layer)).filter(Boolean)
      if (rows.length > 0) written += await upsert(creds, COUNTY, layer, rows, 4326)
    } catch (err) {
      if (batch.length === 1 || depth > 8) {
        gaps.push({ taxlots: batch.length, ids: batch, why: err instanceof Error ? err.message : String(err) })
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

  await rpc(creds, 'record_taxlot_refresh', {
    p_county: COUNTY, p_mode: 'delta', p_since: `${sinceIso}T00:00:00Z`,
    p_changed: changed.length, p_written: written, p_gaps: gaps, p_note: null,
  })
  log(`delta done: ${changed.length} changed, ${written} written${gaps.length ? `, ${gaps.length} gap(s)` : ''}`)
  for (const g of gaps.slice(0, 3)) log(`  gap of ${g.taxlots} (${(g.ids || []).join(',')}): ${g.why}`)
  if (gaps.length > 0) process.exitCode = 1
}

/**
 * The initial load, from the county's own export. Streaming a 123 MB document
 * would be tidier; parsing it whole is honest about what it costs and needs no
 * parser dependency, so the script asks for the heap it needs.
 */
async function runBulk(layer, creds) {
  const { createWriteStream, existsSync, statSync } = await import('node:fs')
  const { Readable } = await import('node:stream')
  const { pipeline } = await import('node:stream/promises')
  const b = layer.bulk
  if (!b) throw new Error(`no bulk export declared for ${layer.label}`)

  const file = BULK_FILE ?? path.join(WORKDIR, `${COUNTY}-taxlots.geojson`)
  if (!existsSync(file)) {
    mkdirSyncSafe(WORKDIR)
    log(`downloading the whole layer → ${path.relative(ROOT, file)}`)
    const res = await fetch(b.url)
    if (!res.ok) throw new Error(`bulk download → HTTP ${res.status}`)
    await pipeline(Readable.fromWeb(res.body), createWriteStream(file))
  }
  log(`reading ${(statSync(file).size / 1024 / 1024).toFixed(1)} MB from ${path.relative(ROOT, file)}`)

  const doc = JSON.parse(readFileSync(file, 'utf8'))
  const feats = doc.features ?? []
  const declared = String(doc.crs?.properties?.name ?? '')
  const srid = declared.includes('3857') ? 3857 : declared.includes('4326') ? 4326 : b.srid
  log(`${feats.length.toLocaleString('en-US')} features, CRS ${declared || 'undeclared'} → treating as EPSG:${srid}`)

  const rows = feats
    .map((f) => toRow(f, { fields: b.fields }))
    .filter(Boolean)
  log(`${rows.length.toLocaleString('en-US')} usable, ${(feats.length - rows.length).toLocaleString('en-US')} skipped`)
  if (!WRITE) {
    log('DRY RUN — pass --write to upsert.')
    return
  }

  let written = 0
  const batch = 1000
  for (let i = 0; i < rows.length; i += batch) {
    written += await upsert(creds, COUNTY, layer, rows.slice(i, i + batch), srid)
    if ((i / batch) % 10 === 0 || i + batch >= rows.length) {
      log(`${Math.min(i + batch, rows.length).toLocaleString('en-US')} / ${rows.length.toLocaleString('en-US')} — ${written.toLocaleString('en-US')} written`)
    }
  }
  await rpc(creds, 'record_taxlot_refresh', {
    p_county: COUNTY, p_mode: 'full', p_since: null,
    p_changed: rows.length, p_written: written, p_gaps: [], p_note: 'bulk export',
  })
  log(`bulk done: ${written.toLocaleString('en-US')} written`)
}

async function main() {
  const layer = COUNTIES[COUNTY]
  if (!layer) throw new Error(`no layer declared for county "${COUNTY}" — known: ${Object.keys(COUNTIES).join(', ')}`)

  if (BULK) {
    await runBulk(layer, WRITE ? env() : null)
    return
  }

  if (SINCE) {
    await runDelta(layer, WRITE ? env() : null)
    return
  }

  const total = await countFeatures(layer)
  const { ids, field } = await fetchIds(layer)
  log(`${layer.label}: ${total.toLocaleString('en-US')} parcels published, ${ids.length.toLocaleString('en-US')} object ids, at ${layer.url}`)
  const target = LIMIT > 0 ? Math.min(LIMIT, ids.length) : ids.length
  if (!WRITE) log('DRY RUN — pass --write to upsert. Reading two windows to prove the shape.')

  const creds = WRITE ? env() : null
  let read = 0
  let written = 0
  let skipped = 0
  const step = PAGE > 0 ? PAGE : layer.pageSize
  const windows = []
  for (let i = 0; i < target; i += step) {
    windows.push([ids[i], ids[Math.min(i + step - 1, target - 1)]])
  }

  const gaps = []
  for (let i = FROM; i < (WRITE ? windows.length : Math.min(FROM + 2, windows.length)); i += 1) {
    const [lo, hi] = windows[i]
    const features = await fetchWindow(layer, field, lo, hi, gaps)
    read += features.length
    const rows = features.map((f) => toRow(f, layer)).filter(Boolean)
    skipped += features.length - rows.length

    if (WRITE) {
      written += await upsert(creds, COUNTY, layer, rows)
      if (i % 10 === 0 || i === windows.length - 1) {
        log(`window ${i + 1}/${windows.length} — ${read.toLocaleString('en-US')} read, ${written.toLocaleString('en-US')} written`)
      }
    } else {
      const sample = rows[0]
      log(`window ${i} (${lo}-${hi}): ${features.length} read, ${rows.length} usable${sample ? ` — first: ${sample.taxlot} (${sample.geojson.type})` : ''}`)
    }
  }

  log(`done: ${read.toLocaleString('en-US')} read, ${written.toLocaleString('en-US')} written, ${skipped} skipped (no id or not a polygon)`)
  if (gaps.length > 0) {
    log(`GAPS: ${gaps.length} id range(s) the service would not answer — these parcels are NOT loaded:`)
    for (const g of gaps.slice(0, 20)) log(`  ${g.lo}-${g.hi}: ${g.why}`)
    process.exitCode = 1
  }
  if (!WRITE) log('Nothing was written.')
}

main().catch((err) => {
  process.stderr.write(`[taxlots] ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})

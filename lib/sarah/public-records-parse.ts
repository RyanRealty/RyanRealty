/**
 * Pure parsers for Sarah's public-records tools. No network.
 *
 * DIAL HTML is a user-initiated single-account read (not a crawl).
 * Never copy owner or mailing names into a reply.
 */
export type ParsedDialPermit = {
  id: string
  type: string | null
  name: string | null
  date: string | null
  year: number | null
  status: string | null
}

export type ParsedDialPermitsPage = {
  account: string | null
  taxlot: string | null
  situs: string | null
  cityNote: string | null
  permits: ParsedDialPermit[]
  sourceUrl: string
}

const PERSON_NAME_RE =
  /\b[A-Z][A-Z'-]+,\s+[A-Z][A-Z'.-]+(?:\s+[A-Z][A-Z'.-]*)*(?:\s*&\s*[A-Z][A-Z'.-]+)?\b/
const STRUCTURE_RE =
  /\b(shop|workshop|garage|adu|accessory|outbuilding|barn|shed|studio|addition|dwelling|house|storage|carport|pole barn)\b/i

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function mmddyyyyToIso(v: string): string | null {
  const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, mo, d, y] = m
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function yearFrom(iso: string | null, raw: string): number | null {
  if (iso) return Number(iso.slice(0, 4))
  const m = raw.match(/\b(19|20)\d{2}\b/)
  return m ? Number(m[0]) : null
}

function cleanPermitName(raw: string | null): string | null {
  if (!raw) return null
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return null
  if (PERSON_NAME_RE.test(text)) return STRUCTURE_RE.test(text) ? text.replace(PERSON_NAME_RE, '').trim() || null : null
  if (/\b(LLC|INC|CORP|LP|TRUST|HOMES|VILLAGE|MEADOWS)\b/i.test(text) && !STRUCTURE_RE.test(text)) return null
  return text
}

function permitTypeFromId(id: string, fallback: string | null): string | null {
  const city = id.match(/^\d{3}-\d{2}-\d{6}-([A-Z]+)$/i)
  if (city) {
    const code = city[1].toUpperCase()
    if (code === 'STR' || code === 'BLD' || code === 'B') return 'Building'
    if (code === 'DWL') return 'Dwelling'
    if (code === 'ADU') return 'Accessory dwelling'
    return fallback
  }
  const county = id.match(/^247-?([A-Z]{1,2})\d+/i)
  if (county) {
    const letter = county[1].toUpperCase()
    if (letter === 'B') return 'Building'
    if (letter === 'S') return 'Onsite septic'
    if (letter === 'E') return 'Electrical'
    if (letter === 'P') return 'Plumbing'
    if (letter === 'M') return 'Mechanical'
  }
  return fallback
}

export function parseDialPermitsHtml(html: string, sourceUrl: string): ParsedDialPermitsPage {
  const flat = html.replace(/\s+/g, ' ')
  const account =
    flat.match(/\bAccount:\s*(\d{4,10})\b/i)?.[1] ??
    sourceUrl.match(/\/Real\/Permits\/(\d+)/i)?.[1] ??
    null
  const taxlot = flat.match(/\bMap and Taxlot:\s*([A-Z0-9]+)\b/i)?.[1] ?? null
  const situs = flat.match(/\bSitus Address:\s*([^<]{8,80}?)\s+Tax Status/i)?.[1]?.trim() ?? null
  const cityNote = /responsible for land use and permits/i.test(flat)
    ? stripTags(flat.match(/<p[^>]*>[^<]*responsible for land use and permits[\s\S]{0,240}<\/p>/i)?.[0] ?? '')
    : null

  const permits: ParsedDialPermit[] = []
  const seen = new Set<string>()

  for (const tableHtml of html.match(/<table[^>]*>[\s\S]*?<\/table>/gi) ?? []) {
    for (const tr of tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
      const cells = [...tr.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) => stripTags(m[1] ?? ''))
      if (cells.length < 3) continue
      if (/permit id/i.test(cells[0] ?? '')) continue
      const id = (cells[0] ?? '').trim()
      if (!/^\d{3}-\d{2}-\d{4,}|^247-?/i.test(id)) continue
      if (seen.has(id)) continue
      seen.add(id)
      const date = mmddyyyyToIso(cells[3] ?? '')
      permits.push({
        id,
        type: permitTypeFromId(id, cells[1] || null),
        name: cleanPermitName(cells[2] ?? null),
        date,
        year: yearFrom(date, cells[3] ?? ''),
        status: cells[4]?.trim() || null,
      })
    }
  }

  if (permits.length === 0) {
    for (const m of flat.matchAll(/\b(\d{3}-\d{2}-\d{6}-[A-Z]{2,4}|247-?[A-Z]{1,2}\d{2,8})\b/gi)) {
      const id = m[1]
      if (seen.has(id)) continue
      seen.add(id)
      permits.push({
        id,
        type: permitTypeFromId(id, null),
        name: null,
        date: null,
        year: yearFrom(null, id),
        status: null,
      })
    }
  }

  return { account, taxlot, situs, cityNote: cityNote || null, permits, sourceUrl }
}

export function pickShopPermit(permits: ParsedDialPermit[]): ParsedDialPermit | null {
  return (
    permits.find((p) => p.name && STRUCTURE_RE.test(p.name) && /shop|workshop|outbuilding|barn|shed/i.test(p.name)) ??
    permits.find((p) => p.name && STRUCTURE_RE.test(p.name)) ??
    null
  )
}

export function activePermits(permits: ParsedDialPermit[]): ParsedDialPermit[] {
  return permits.filter((p) => !/void|withdrawn|canceled|cancelled/i.test(p.status ?? ''))
}

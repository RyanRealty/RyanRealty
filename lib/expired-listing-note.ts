/**
 * Pure CRM-note formatter for expired-listing capture.
 * Numbers and dates come from the listings row + listing_history only.
 * Never invents a price cut.
 */

export type ExpiredNoteListing = {
  ListingKey: string
  ListNumber: string | null
  StandardStatus: string
  status_change_timestamp: string
  StreetNumber: string | null
  StreetName: string | null
  City: string
  PostalCode: string | null
  ListPrice: number | string | null
  OriginalListPrice: number | string | null
  CumulativeDaysOnMarket: number | string | null
  OnMarketDate?: string | null
  ListDate?: string | null
  ListAgentName: string | null
  list_agent_email: string | null
  PropertyType: string | null
  BedroomsTotal: number | string | null
  BathroomsTotal: number | string | null
  TotalLivingAreaSqFt: number | string | null
  SubdivisionName: string | null
}

export type ExpiredNoteOwner = {
  taxlot?: string | null
  ownerName?: string
  ownerMailingAddress?: string
  ownerEmail?: string
  ownerPhone?: string
  allPhones?: Array<{ value: string; type?: string; dnc?: boolean }>
  allEmails?: string[]
  complianceTags?: string[]
  notes?: string
}

export type ExpiredNoteHistoryRow = {
  event?: string | null
  event_date?: string | null
  price?: number | null
  price_change?: number | null
  description?: string | null
  raw?: unknown
}

export type PriceDropLine = {
  date: string
  from: number
  to: number
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function isoDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = String(raw).trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

function usd(n: number): string {
  return `$${new Intl.NumberFormat('en-US').format(Math.round(n))}`
}

function rawRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
}

/** OnMarketDate wins; ListDate is the fallback. Null when neither is a date. */
export function resolveOnMarketDate(l: Pick<ExpiredNoteListing, 'OnMarketDate' | 'ListDate'>): string | null {
  return isoDate(l.OnMarketDate) ?? isoDate(l.ListDate)
}

/**
 * Prefer CumulativeDaysOnMarket. When it is null, count calendar days from
 * the on-market date to status_change_timestamp. Never guess a start date.
 */
export function resolveDaysOnMarket(
  l: Pick<ExpiredNoteListing, 'CumulativeDaysOnMarket' | 'OnMarketDate' | 'ListDate' | 'status_change_timestamp'>,
): number | null {
  const stored = num(l.CumulativeDaysOnMarket)
  if (stored != null) return Math.round(stored)
  const start = resolveOnMarketDate(l)
  const end = isoDate(l.status_change_timestamp)
  if (!start || !end) return null
  const startMs = Date.parse(`${start}T00:00:00.000Z`)
  const endMs = Date.parse(`${end}T00:00:00.000Z`)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null
  return Math.round((endMs - startMs) / 86_400_000)
}

function fieldName(raw: Record<string, unknown>): string {
  return String(raw.Field ?? raw.field ?? '').trim()
}

function isListPriceField(field: string): boolean {
  const f = field.toLowerCase()
  return f === 'listprice' || f === 'currentprice' || f === 'list price'
}

/** Documented price drops only. Empty history → empty list. Never invents a cut. */
export function priceDropsFromHistory(rows: ExpiredNoteHistoryRow[]): PriceDropLine[] {
  const drops: PriceDropLine[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const raw = rawRecord(row.raw)
    const date = isoDate(row.event_date) ?? isoDate(typeof raw.Date === 'string' ? raw.Date : null)
    if (!date) continue

    const field = fieldName(raw)
    const priceField = isListPriceField(field) || field === ''
    if (!priceField) continue

    let from = num(raw.PreviousValue as number | string | null)
    let to = num(raw.NewValue as number | string | null)
    if (from == null || to == null) {
      const price = num(row.price) ?? num(raw.Price as number | string | null) ?? num(raw.PriceAtEvent as number | string | null)
      const change = num(row.price_change) ?? num(raw.PriceChange as number | string | null)
      if (price != null && change != null && change < 0) {
        to = price
        from = price - change
      }
    }

    if (from == null || to == null) continue
    if (to >= from) continue

    const key = `${date}:${from}:${to}`
    if (seen.has(key)) continue
    seen.add(key)
    drops.push({ date, from, to })
  }
  drops.sort((a, b) => a.date.localeCompare(b.date))
  return drops
}

export function formatPriceDropLine(drop: PriceDropLine): string {
  return `${drop.date}: ${usd(drop.from)} → ${usd(drop.to)}`
}

function otherHistoryLines(rows: ExpiredNoteHistoryRow[], dropKeys: Set<string>): string[] {
  const lines: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const raw = rawRecord(row.raw)
    const date = isoDate(row.event_date) ?? isoDate(typeof raw.Date === 'string' ? raw.Date : null)
    if (!date) continue
    const field = fieldName(raw)
    if (isListPriceField(field)) continue
    const from = num(raw.PreviousValue as number | string | null)
    const to = num(raw.NewValue as number | string | null)
    if (from != null && to != null && to < from) {
      if (dropKeys.has(`${date}:${from}:${to}`)) continue
    }

    let text: string | null = null
    const event = typeof row.event === 'string' ? row.event.trim() : ''
    const prev = raw.PreviousValue != null ? String(raw.PreviousValue).trim() : ''
    const next = raw.NewValue != null ? String(raw.NewValue).trim() : ''
    if (field && prev && next) {
      text = `${field}: ${prev} → ${next}`
    } else if (event && /new\s*listing/i.test(event)) {
      text = 'Listed'
    } else if (typeof row.description === 'string' && row.description.trim()) {
      text = row.description.trim()
    } else if (event) {
      text = event
    }
    if (!text) continue
    const line = `${date}: ${text}`
    if (seen.has(line)) continue
    seen.add(line)
    lines.push(line)
  }
  lines.sort((a, b) => a.localeCompare(b))
  return lines
}

function hasReachableOwnerContact(owner: ExpiredNoteOwner): boolean {
  const email = owner.ownerEmail?.trim()
  if (email && /@/.test(email) && !/@placeholder\.ryan-realty\.com$/i.test(email)) return true
  const digits = (owner.ownerPhone ?? '').replace(/\D/g, '')
  return digits.length >= 10
}

export function buildListingNote(
  l: ExpiredNoteListing,
  owner: ExpiredNoteOwner,
  history: ExpiredNoteHistoryRow[] = [],
): string {
  const lines: string[] = []
  const addr = `${l.StreetNumber ?? ''} ${l.StreetName ?? ''}`.trim()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'
  lines.push(`EXPIRED LISTING ALERT. ${l.StandardStatus} on ${l.status_change_timestamp.slice(0, 10)}.`)
  lines.push('')
  lines.push(`Property: ${addr}, ${l.City}, OR ${l.PostalCode ?? ''}`)
  lines.push(`MLS #: ${l.ListNumber ?? l.ListingKey}`)
  if (l.SubdivisionName) lines.push(`Community: ${l.SubdivisionName}`)
  if (owner.taxlot) lines.push(`County taxlot: ${owner.taxlot}`)
  lines.push('')
  const lp = num(l.ListPrice)
  const olp = num(l.OriginalListPrice)
  if (lp != null) lines.push(`Last list price: ${usd(lp)}`)
  if (olp != null && lp != null && olp !== lp) {
    const drop = olp - lp
    const dropPct = ((drop / olp) * 100).toFixed(1)
    lines.push(`Original list: ${usd(olp)} (dropped ${usd(drop)}, ${dropPct}%)`)
  }
  const onMarket = resolveOnMarketDate(l)
  if (onMarket) lines.push(`On market: ${onMarket}`)
  const dom = resolveDaysOnMarket(l)
  if (dom != null) lines.push(`Days on market: ${dom} days`)

  const drops = priceDropsFromHistory(history)
  if (drops.length > 0) {
    lines.push('')
    for (const drop of drops) lines.push(formatPriceDropLine(drop))
  }
  const dropKeys = new Set(drops.map((d) => `${d.date}:${d.from}:${d.to}`))
  const other = otherHistoryLines(history, dropKeys)
  if (other.length > 0) {
    lines.push('')
    lines.push('Listing history:')
    for (const line of other) lines.push(line)
  }

  lines.push('')
  if (l.BedroomsTotal) lines.push(`Beds: ${l.BedroomsTotal}`)
  if (l.BathroomsTotal) lines.push(`Baths: ${l.BathroomsTotal}`)
  const sqft = num(l.TotalLivingAreaSqFt)
  if (sqft) lines.push(`Living area: ${new Intl.NumberFormat('en-US').format(Math.round(sqft))} sqft`)
  lines.push('')
  lines.push(`Prior list agent: ${l.ListAgentName ?? 'unknown'}${l.list_agent_email ? ` (${l.list_agent_email})` : ''}`)
  lines.push('')
  lines.push('OWNER CONTACT')
  if (owner.ownerName) lines.push(`Name: ${owner.ownerName}`)
  if (owner.ownerMailingAddress) lines.push(`Mailing: ${owner.ownerMailingAddress}`)
  if (owner.ownerEmail) lines.push(`Email: ${owner.ownerEmail}`)
  if (owner.ownerPhone) lines.push(`Phone: ${owner.ownerPhone}`)
  if (owner.allPhones && owner.allPhones.length > 1) {
    lines.push(`All phones: ${owner.allPhones.map((p) => `${p.value}${p.dnc ? ' (DNC)' : ''}`).join(', ')}`)
  }
  if (owner.allEmails && owner.allEmails.length > 1) {
    lines.push(`All emails: ${owner.allEmails.join(', ')}`)
  }
  if (!hasReachableOwnerContact(owner)) {
    lines.push('No verified email or phone yet. Do not cold-call until skip trace completes.')
  }
  if (owner.complianceTags?.length) {
    lines.push(`Compliance: ${owner.complianceTags.join(', ')}`)
  }
  if (owner.notes) {
    lines.push('')
    lines.push(`Lookup detail: ${owner.notes}`)
  }
  lines.push('')
  lines.push(`Expired LP: ${siteUrl}/lp/expired-listing`)
  if (l.ListNumber) {
    lines.push(`MLS history: ${siteUrl}/homes-for-sale/listing/${l.ListNumber}`)
  }
  return lines.join('\n')
}

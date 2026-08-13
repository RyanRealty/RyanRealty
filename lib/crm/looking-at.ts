/**
 * Looking-at wake (D3 / A4) — pure copy + keying.
 *
 * Locked SMS: `{name} is looking at {address}.` plus the person link.
 * Key: crm_people.id (not FUB). One ping per person+listing per session.
 * Unidentified / no specific home / no address = no queue.
 * Same rail as other broker alerts. No fifth inbox.
 */

export const BROKER_ALERT_MAILBOXES = new Set([
  'matt@ryan-realty.com',
  'rebeccapeterson@ryan-realty.com',
  'paul@ryan-realty.com',
])

export type LookingAtRaw = {
  personId: number
  listingKey: string
  occurredAt: string
  listingStreet?: string | null
  pageUrl?: string | null
}

export type LookingAtCollapsed = {
  personId: number
  listingKey: string
  address: string
  occurredAt: string
}

/** Timeline kind. queueBrokerAlert stores `alert:{kind}:{personId}`. */
export function lookingAtDedupeKind(sessionId: string, listingKey: string): string {
  return `return-visit:${sessionId.trim()}:${listingKey.trim()}`
}

/** Locked broker SMS. Two lines. Nothing else. */
export function lookingAtAlertBody(name: string, address: string, personId: number): string {
  const who = name.trim() || 'Someone'
  const home = address.trim()
  return `${who} is looking at ${home}.\nhttps://ryan-realty.com/admin/people/${personId}`
}

/** Today row title — same sentence as the SMS first line. */
export function lookingAtTodayTitle(name: string, address: string): string {
  const who = name.trim() || 'Someone'
  return `${who} is looking at ${address.trim()}.`
}

export function lookingAtCanQueue(input: {
  crmPersonId: number | null | undefined
  sessionId: string | null | undefined
  listingKey: string | null | undefined
  address: string | null | undefined
}): boolean {
  const id = Number(input.crmPersonId)
  if (!Number.isFinite(id) || id <= 0) return false
  if (!String(input.sessionId ?? '').trim()) return false
  if (!String(input.listingKey ?? '').trim()) return false
  if (!String(input.address ?? '').trim()) return false
  return true
}

export function formatLookingAtAddress(input: {
  street?: string | null
  streetNumber?: string | null
  streetName?: string | null
}): string | null {
  const fromParts = [input.streetNumber, input.streetName]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim()
  const street = fromParts || (input.street ?? '').trim()
  return street || null
}

export function listingKeyFromPageUrl(pageUrl: string | null | undefined): string | null {
  if (!pageUrl) return null
  try {
    const path = new URL(pageUrl.startsWith('http') ? pageUrl : `https://ryan-realty.com${pageUrl}`)
      .pathname.toLowerCase()
      .replace(/\/+$/, '')
    const segs = path.split('/').filter(Boolean)
    if (segs[0] === 'listing' && segs[1] && segs[1] !== 'by-address' && segs[1] !== 'by-key') {
      return decodeURIComponent(segs[1])
    }
    if (segs[0] === 'homes-for-sale' && segs.length >= 3) {
      const m = segs[segs.length - 1].match(/(\d{6,})$/)
      if (m) return m[1]
    }
  } catch {
    return null
  }
  return null
}

export function addressFromListingUrl(
  pageUrl: string | null | undefined,
  listingKey: string,
): string | null {
  if (!pageUrl || !listingKey.trim()) return null
  try {
    const u = new URL(pageUrl.startsWith('http') ? pageUrl : `https://ryan-realty.com${pageUrl}`)
    const segs = u.pathname.split('/').filter(Boolean)
    const last = segs[segs.length - 1] ?? ''
    const mlsEscaped = listingKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const withoutMls = last
      .replace(new RegExp(`-${mlsEscaped}$`, 'i'), '')
      .replace(/-[a-z0-9]{16,}$/i, '')
    const raw = withoutMls.replace(/-/g, ' ').trim()
    if (!raw) return null
    return titleCaseStreet(raw)
  } catch {
    return null
  }
}

export function resolveLookingAtAddress(
  row: Pick<LookingAtRaw, 'listingKey' | 'listingStreet' | 'pageUrl'>,
  addressByMls: ReadonlyMap<string, string> = new Map(),
): string | null {
  return (
    formatLookingAtAddress({ street: row.listingStreet }) ||
    addressByMls.get(row.listingKey.trim()) ||
    addressFromListingUrl(row.pageUrl, row.listingKey) ||
    null
  )
}

/**
 * One row per identified person: the newest listing_view that names a home.
 * Unidentified (personId <= 0) and rows with no address are dropped.
 */
export function collapseLookingAtByPerson(
  events: readonly LookingAtRaw[],
  addressByMls: ReadonlyMap<string, string> = new Map(),
): LookingAtCollapsed[] {
  const sorted = [...events].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
  const seen = new Set<number>()
  const out: LookingAtCollapsed[] = []
  for (const ev of sorted) {
    if (!Number.isFinite(ev.personId) || ev.personId <= 0) continue
    if (seen.has(ev.personId)) continue
    const listingKey = ev.listingKey.trim()
    if (!listingKey) continue
    const address = resolveLookingAtAddress(ev, addressByMls)
    if (!address) continue
    seen.add(ev.personId)
    out.push({
      personId: ev.personId,
      listingKey,
      address,
      occurredAt: ev.occurredAt,
    })
  }
  return out
}

function titleCaseStreet(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => {
      if (!w) return w
      if (/^\d/.test(w)) return w
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(' ')
}

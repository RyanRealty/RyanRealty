/**
 * people-list-utils — PURE helpers for the §05 People list rebuild
 * (docs/fub-crm-spec/05-people-list-and-bulk-actions.md).
 *
 * Framework-free so the FUB formatting conventions unit-test under the node
 * vitest env: the `Nov 13th '25` date format (§6 col 5), the relative-recency
 * variant (`6 days ago`), the sidebar count K-abbreviation (§3.2: `17K`, no
 * badge at 0), and the column-chooser catalog (§8).
 */

/** Ordinal suffix for a day-of-month (1st, 2nd, 3rd, 4th … 11th–13th th). */
export function ordinal(day: number): string {
  const rem100 = day % 100
  if (rem100 >= 11 && rem100 <= 13) return `${day}th`
  switch (day % 10) {
    case 1: return `${day}st`
    case 2: return `${day}nd`
    case 3: return `${day}rd`
    default: return `${day}th`
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * FUB list-date convention (§6 / §13): recent dates render relative
 * ("6 days ago"), older ones as `Nov 13th '25` (abbreviated month, ordinal
 * day, 2-digit year with apostrophe). `now` injectable for tests.
 */
export function fmtFubDate(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const days = Math.floor((now.getTime() - d.getTime()) / 86400e3)
  if (days >= 0 && days < 1) return 'today'
  if (days >= 1 && days < 14) return `${days} ${days === 1 ? 'day' : 'days'} ago`
  const yy = String(d.getFullYear() % 100).padStart(2, '0')
  return `${MONTHS[d.getMonth()]} ${ordinal(d.getDate())} '${yy}`
}

/**
 * Sidebar count badge (§3.2): ≥1000 abbreviates to `NK`; 0 renders NO badge
 * (null); 1–999 renders the integer string.
 */
export function fmtSidebarCount(count: number | null | undefined): string | null {
  if (count == null || count === 0) return null
  if (count >= 1000) return `${Math.round(count / 1000)}K`
  return String(count)
}

/** Dotted brand phone format (541.213.6706). */
export function fmtPhoneDotted(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(-10)
  if (d.length !== 10) return raw
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
}

// ── Column chooser catalog (§8) ──────────────────────────────────────────────

export type PeopleColumnKey =
  | 'leadScore' | 'agent' | 'lastVisit' | 'phone' | 'email' | 'lastActivity'
  | 'tags' | 'created' | 'stage' | 'source' | 'price' | 'timeframe'

export type PeopleColumnDef = {
  key: PeopleColumnKey
  label: string
  /** §8 section header the field lives under in the chooser. */
  section: 'Details' | 'Assigned' | 'Website activity' | 'Communication'
}

/** Every choosable column. Name is locked-on and not listed here. */
export const PEOPLE_COLUMNS: readonly PeopleColumnDef[] = [
  { key: 'leadScore', label: 'Lead Score', section: 'Details' },
  { key: 'agent', label: 'Agent', section: 'Assigned' },
  { key: 'lastVisit', label: 'Last Visit', section: 'Website activity' },
  { key: 'phone', label: 'Phone', section: 'Details' },
  { key: 'email', label: 'Email', section: 'Details' },
  { key: 'lastActivity', label: 'Last Activity', section: 'Details' },
  { key: 'tags', label: 'Tags', section: 'Details' },
  { key: 'created', label: 'Created', section: 'Details' },
  { key: 'stage', label: 'Stage', section: 'Details' },
  { key: 'source', label: 'Source', section: 'Details' },
  { key: 'price', label: 'Price', section: 'Details' },
  { key: 'timeframe', label: 'Timeframe', section: 'Details' },
] as const

/** §6: the default All People column set (after the locked Name column). */
export const DEFAULT_PEOPLE_COLUMNS: readonly PeopleColumnKey[] = [
  'leadScore', 'agent', 'lastVisit', 'phone', 'email', 'lastActivity', 'tags',
] as const

/** localStorage key for the per-list saved column configuration (§8). */
export function columnStorageKey(viewId: number | null): string {
  return `crm.people.columns.${viewId ?? 'all'}`
}

/** Parse a stored column config back to valid keys, or null when unusable. */
export function parseStoredColumns(rawJson: string | null): PeopleColumnKey[] | null {
  if (!rawJson) return null
  try {
    const arr = JSON.parse(rawJson)
    if (!Array.isArray(arr)) return null
    const valid = new Set(PEOPLE_COLUMNS.map((c) => c.key as string))
    const keys = arr.filter((k): k is PeopleColumnKey => typeof k === 'string' && valid.has(k))
    return keys.length > 0 ? keys : null
  } catch {
    return null
  }
}

// ── Lead source options (§16 Add Person / §14.3 Update Source) ──────────────
// The account's configured lead sources (config, not stats — new values still
// arrive organically from the lead-capture pipelines).

export const LEAD_SOURCE_OPTIONS = [
  'Ryan-Realty.com', 'Zillow', 'Realtor.com', 'Referral', 'Sphere', 'Open House',
  'Expired Listing', 'FSBO', 'Facebook', 'Google', 'Inbound call', 'Import', 'Manual entry',
] as const

// ── Timeframe options (§14.3 item 10) ────────────────────────────────────────

export const TIMEFRAME_OPTIONS = [
  '0-3 Months', '3-6 Months', '6-12 Months', '12+ Months', 'No Plans',
] as const

// ── Last Activity icon mapping (§6 col 8 / §13) ─────────────────────────────

export type ActivityIconKind = 'view' | 'inquiry' | 'message' | 'call' | 'lead' | 'other'

/** Map a crm_timeline kind onto the §13 activity icon family. */
export function activityIconKind(kind: string | null | undefined): ActivityIconKind {
  switch (kind) {
    case 'page_view':
    case 'property_view':
    case 'website_visit':
      return 'view'
    case 'inquiry':
    case 'form_submission':
    case 'property_inquiry':
      return 'inquiry'
    case 'email_in':
    case 'sms_in':
      return 'message'
    case 'call':
    case 'voicemail':
      return 'call'
    case 'lead_created':
      return 'lead'
    default:
      return 'other'
  }
}

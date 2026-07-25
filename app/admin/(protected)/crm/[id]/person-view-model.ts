/**
 * Person-workspace view model (spec-03 / W5.1).
 *
 * Pure mapping between the person-detail DAL payloads and the props the three
 * §07 columns render. Extracted from page.tsx so the route file stays an
 * assembly shell: every function here is deterministic, free of `await`, and
 * unit-testable without a request context.
 *
 * Nothing in this file reads data. Fetching stays in page.tsx (which owns the
 * DAL imports the page-dal gate checks for); this module only reshapes what the
 * page already has in hand.
 */
import { formatDate } from '@/lib/format/date'
import { timelineEmailBody } from '@/lib/crm/email-body'
import { mergeTagOptions } from '@/lib/data/crm/getPersonDetailExtras'
import { CRM_STAGES, CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import type { SidebarData } from '@/components/admin/crm/person-detail/PersonSidebar'
import type { TimelineItem } from '@/components/admin/crm/person-detail/PersonCenterColumn'

/** Sources offered in the sidebar picker on top of whatever the row already carries. */
const SOURCE_PRESETS = [
  'Google',
  'Zillow',
  'Realtor.com',
  'Import',
  'Referral',
  'Ryan-Realty.com',
  'inbound-call',
  'Expired Listing Cron',
  'FSBO',
]

type ContactPointLike = {
  kind: string
  value: string
  label?: string | null
  status?: string | null
  is_primary?: boolean | null
}

type RelationshipLike = { relatedPersonId: number | null; name: string; label: string }

type TimelineRowLike = {
  id: string | number
  kind: string
  ts: string
  title?: string | null
  body?: string | null
  broker?: string | null
  source?: string | null
  starred?: boolean | null
  payload?: Record<string, unknown> | null
}

/** Per-label open/click rollup keyed by the email's timeline title. */
export type EmailEngagement = Record<string, { opens: number; lastOpen: string | null; clicks: number }>

// ── formatting ───────────────────────────────────────────────────────────────

/** Currency rounded to the nearest thousand (CLAUDE.md §2: `$895,000`). */
export function usd(n: number | null | undefined): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  return `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}`
}

/** Coarse "how long ago" for the sidebar's last-communication + source recency lines. */
export function fmtAgoLong(iso: string | null, now: number = Date.now()): string | null {
  if (!iso) return null
  const days = Math.floor((now - new Date(iso).getTime()) / 86400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'a day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.round(days / 30)
  return months === 1 ? 'a month ago' : `${months} months ago`
}

export function fmtPhoneParen(d: string): string {
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d
}

/** Human label for a saved search's stored filter blob. */
export function describeSearch(filters: Record<string, unknown> | null): string {
  if (!filters) return 'Saved search'
  const f = filters as Record<string, unknown>
  const num = (v: unknown) =>
    typeof v === 'number'
      ? v
      : typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))
        ? Number(v)
        : null
  const parts: string[] = []
  const where = (f.city ?? f.neighborhood ?? f.subdivision ?? f.area ?? f.location) as string | undefined
  if (where) parts.push(String(where))
  const min = num(f.minPrice ?? f.priceMin ?? f.min_price)
  const max = num(f.maxPrice ?? f.priceMax ?? f.max_price)
  if (min && max) parts.push(`${usd(min)}–${usd(max)}`)
  else if (max) parts.push(`up to ${usd(max)}`)
  else if (min) parts.push(`${usd(min)}+`)
  const beds = num(f.beds ?? f.minBeds ?? f.bedrooms)
  if (beds) parts.push(`${beds}+ bd`)
  const baths = num(f.baths ?? f.minBaths ?? f.bathrooms)
  if (baths) parts.push(`${baths}+ ba`)
  const type = (f.propertyType ?? f.type ?? f.homeType) as string | undefined
  if (type) parts.push(String(type))
  return parts.length ? parts.join(' · ') : 'All listings'
}

/**
 * Display name. Many imported leads carry a placeholder like
 * "Lead someone@example.com" — strip the prefix so the header shows the address
 * cleanly instead of the placeholder.
 */
export function resolveDisplayName(name: string | null | undefined, personId: number): string {
  const raw = name ?? `Contact #${personId}`
  return /^lead\s+\S+@\S+$/i.test(raw) ? raw.replace(/^lead\s+/i, '') : raw
}

/** Inquiry date for the Info tab — when the lead row was created. */
export function resolveInquiryDate(timeline: TimelineRowLike[]): string | null {
  const created = timeline.find((t) => t.kind === 'lead_created')?.ts ?? null
  return created ? formatDate(created, { month: 'short', day: 'numeric' }) : null
}

// ── rollups ──────────────────────────────────────────────────────────────────

/** Fold email_open / email_click timeline rows into a per-label engagement map. */
export function buildEmailEngagement(timeline: TimelineRowLike[]): EmailEngagement {
  const engagement: EmailEngagement = {}
  for (const t of timeline) {
    if (t.kind !== 'email_open' && t.kind !== 'email_click') continue
    const pl = (t.payload ?? {}) as { label?: string }
    const key = (pl.label ?? t.title ?? '').trim()
    if (!key) continue
    const e = (engagement[key] ??= { opens: 0, lastOpen: null, clicks: 0 })
    if (t.kind === 'email_open') {
      e.opens++
      if (!e.lastOpen || t.ts > e.lastOpen) e.lastOpen = t.ts
    } else {
      e.clicks++
    }
  }
  return engagement
}

/**
 * Center-column timeline rows. Engagement-only kinds are folded into the
 * email_out rows they belong to (via buildEmailEngagement) rather than rendered
 * as their own entries.
 */
export function buildTimelineItems(
  timeline: TimelineRowLike[],
  engagement: EmailEngagement,
): TimelineItem[] {
  return timeline
    .filter((t) => t.kind !== 'email_open' && t.kind !== 'email_click' && t.kind !== 'sms_click')
    .map((t) => {
      const eng = engagement[(t.title ?? '').trim()]
      return {
        id: t.id,
        kind: t.kind,
        ts: t.ts,
        title: t.title,
        body: t.body ? timelineEmailBody(t.body) : null,
        broker: t.broker,
        source: t.source,
        starred: Boolean(t.starred),
        payload: (t.payload ?? {}) as Record<string, unknown>,
        opens: t.kind === 'email_out' ? eng?.opens : undefined,
        clicks: t.kind === 'email_out' ? eng?.clicks : undefined,
      }
    }) as TimelineItem[]
}

// ── sidebar ──────────────────────────────────────────────────────────────────

/** §07a left sidebar props, assembled from the person row + its side loads. */
export function buildSidebarData(input: {
  person: Record<string, unknown> & { id: number }
  displayName: string
  contactPoints: ContactPointLike[]
  relationships: RelationshipLike[]
  pondOptions: SidebarData['pondOptions']
  tagOptions: Array<{ key: string; label: string }>
  campaigns: string[]
  actingBroker: string | null
  canDelete: boolean
  lastCommunicationAt: string | null
  now?: number
}): SidebarData {
  const p = input.person as Record<string, unknown>
  const addr0 = (Array.isArray(p.addresses) ? (p.addresses as unknown[])[0] : null) as Record<
    string,
    unknown
  > | null
  const source = (p.source ?? null) as string | null
  const tags = Array.isArray(p.tags) ? (p.tags as string[]) : []
  const price = p.price
  const createdAt = (p.created_at ?? null) as string | null

  return {
    personId: input.person.id,
    name: input.displayName,
    firstName: (p.first_name ?? null) as string | null,
    lastName: (p.last_name ?? null) as string | null,
    pictureUrl: (p.picture_url ?? null) as string | null,
    lastCommunicationLabel: input.lastCommunicationAt
      ? `Last communication ${fmtAgoLong(input.lastCommunicationAt, input.now)}`
      : null,
    phones: input.contactPoints
      .filter((c) => c.kind === 'phone')
      .map((c) => ({
        value: c.value,
        label: c.label && c.label.trim() ? c.label : 'Mobile',
        bad: c.status === 'bad',
        isPrimary: !!c.is_primary,
        display: fmtPhoneParen(c.value),
      })),
    emails: input.contactPoints
      .filter((c) => c.kind === 'email')
      .map((c) => ({ value: c.value, isPrimary: !!c.is_primary, status: c.status ?? 'active' })),
    address: addr0
      ? {
          street: String(addr0.street ?? addr0.address1 ?? ''),
          city: String(addr0.city ?? ''),
          state: String(addr0.state ?? ''),
          zip: String(addr0.zip ?? addr0.code ?? addr0.postal_code ?? ''),
        }
      : null,
    relationships: input.relationships.map((r) => ({
      relatedPersonId: r.relatedPersonId,
      name: r.name,
      label: r.label,
    })),
    stage: (p.stage ?? null) as SidebarData['stage'],
    stageOptions: [...CRM_STAGES],
    assignedBroker: (p.assigned_broker ?? null) as SidebarData['assignedBroker'],
    brokerOptions: CRM_BROKERS.map((b) => ({ value: b, label: CRM_BROKER_DISPLAY[b] })),
    pondOptions: input.pondOptions,
    pondId: (p.pond_id ?? null) as number | null,
    actingBroker: input.actingBroker,
    source,
    sourceOptions: [...new Set([...(source ? [source] : []), ...SOURCE_PRESETS])],
    sourceRecency: fmtAgoLong(createdAt, input.now),
    price: typeof price === 'number' ? price : price ? Number(price) : null,
    timeframe: (p.timeframe ?? null) as string | null,
    tags,
    tagOptions: mergeTagOptions(input.tagOptions, tags),
    campaigns: input.campaigns,
    lenderName: (p.lender_name ?? null) as string | null,
    background: (p.background ?? null) as SidebarData['background'],
    socialLinks: [],
    groups: [],
    canDelete: input.canDelete,
  } as SidebarData
}

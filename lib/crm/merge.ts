/**
 * CRM merge-field system (§13.3) — the canonical token catalog + resolver.
 *
 * MERGE_TOKENS is the catalog every picker renders. renderCrmMerge is the ONE
 * resolver every send path and preview runs. HISTORY: until 2026-07-01 the
 * picker advertised ~30 tokens while the resolver replaced ~5 — the other ~25
 * went out LITERALLY in delivered email (confirmed bug, CRM_BUILD_MISSION
 * "FIX: merge fields"). The resolver now takes the full context it needs
 * (person + agent + sender + company + property + lender + lead source) and
 * resolves EVERY catalog token. lib/crm/merge.test.ts asserts every
 * MERGE_TOKENS entry resolves against a full context.
 *
 * Resolution rules:
 *   - A token with a real value resolves to that value.
 *   - A token whose data is unknown/empty stays LITERAL — so
 *     findUnresolvedMergeTokens still surfaces it as a composer warning and
 *     the fail-closed gate still blocks automated sends of broken copy.
 *     (Exception: %contact_first_name% falls back to 'there' — long-standing
 *     deliberate behavior for greeting lines.)
 *   - Custom-field tokens (%customX%) resolve from person.custom.
 *
 * Server send paths build the context via lib/crm/merge-context.ts
 * (buildMergeContext) so agent/sender/company always resolve from real data.
 */
import { formatDate } from '@/lib/format/date'

export type MergeToken = {
  token: string
  label: string
  group: 'contact' | 'agent' | 'sender' | 'company' | 'lender' | 'property' | 'lead_source' | 'cma' | 'other'
}

export const MERGE_TOKENS: MergeToken[] = [
  // CONTACT
  { token: '%contact_first_name%', label: 'First name', group: 'contact' },
  { token: '%contact_last_name%', label: 'Last name', group: 'contact' },
  { token: '%contact_email%', label: 'Email', group: 'contact' },
  { token: '%contact_phone%', label: 'Phone', group: 'contact' },
  { token: '%contact_stage%', label: 'Stage', group: 'contact' },
  { token: '%contact_address_street%', label: 'Street', group: 'contact' },
  { token: '%contact_address_city%', label: 'City', group: 'contact' },
  { token: '%contact_address_state%', label: 'State', group: 'contact' },
  { token: '%contact_address_zip%', label: 'Zip', group: 'contact' },
  { token: '%contact_address_full%', label: 'Full address', group: 'contact' },

  // AGENT (assigned agent on the contact)
  { token: '%agent_first_name%', label: 'Agent first name', group: 'agent' },
  { token: '%agent_last_name%', label: 'Agent last name', group: 'agent' },
  { token: '%agent_email%', label: 'Agent email', group: 'agent' },
  { token: '%agent_phone%', label: 'Agent phone', group: 'agent' },
  { token: '%agent_title%', label: 'Agent title', group: 'agent' },
  { token: '%agent_brokerage%', label: 'Brokerage', group: 'agent' },
  { token: '%agent_website%', label: 'Website', group: 'agent' },

  // SENDER (the broker actually sending, may differ from assigned agent)
  { token: '%sender_first_name%', label: 'Sender first name', group: 'sender' },
  { token: '%sender_last_name%', label: 'Sender last name', group: 'sender' },
  { token: '%sender_email%', label: 'Sender email', group: 'sender' },
  { token: '%sender_phone%', label: 'Sender phone', group: 'sender' },

  // COMPANY
  { token: '%company_name%', label: 'Company name', group: 'company' },
  { token: '%company_address%', label: 'Company address', group: 'company' },

  // LENDER
  { token: '%lender_first_name%', label: 'Lender first name', group: 'lender' },
  { token: '%lender_last_name%', label: 'Lender last name', group: 'lender' },
  { token: '%lender_email%', label: 'Lender email', group: 'lender' },
  { token: '%lender_phone%', label: 'Lender phone', group: 'lender' },

  // PROPERTY / listing context
  { token: '%customSellerPropertyAddress%', label: 'Seller property address', group: 'property' },
  { token: '%customPropertyAddress%', label: 'Property address', group: 'property' },
  { token: '%address%', label: 'Address (short)', group: 'property' },
  { token: '%property_price%', label: 'Listing price', group: 'property' },
  { token: '%property_mls_number%', label: 'MLS number', group: 'property' },
  { token: '%last_viewed_address%', label: 'Last viewed address', group: 'property' },

  // LEAD SOURCE
  { token: '%lead_source_name%', label: 'Lead source', group: 'lead_source' },
  { token: '%lead_source_campaign%', label: 'Campaign', group: 'lead_source' },

  // CMA
  { token: '%cma_link%', label: 'CMA link', group: 'cma' },

  // OTHER
  { token: '%greeting%', label: 'Greeting', group: 'other' },
]

/** The person fields the resolver reads. Every field optional — a caller that
 *  selects fewer columns simply leaves the matching tokens literal. */
export type MergePersonLike = {
  first_name?: string | null
  last_name?: string | null
  name?: string | null
  stage?: string | null
  source?: string | null
  lender_name?: string | null
  /** crm_people.emails jsonb — [{ value, isPrimary }] */
  emails?: unknown
  /** crm_people.phones jsonb — [{ value, isPrimary }] */
  phones?: unknown
  /** crm_people.addresses jsonb — [{ street, city, state, code|zip }] */
  addresses?: unknown
  custom?: Record<string, unknown>
}

/** A person-shaped party (broker or lender) as the resolver consumes it. */
export type MergePartyInfo = {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  title?: string | null
  brokerage?: string | null
  website?: string | null
}

/** Everything beyond the person the resolver may need. All optional — send
 *  paths build it with buildMergeContext (lib/crm/merge-context.ts). */
export type MergeContext = {
  agent?: MergePartyInfo | null
  sender?: MergePartyInfo | null
  company?: { name?: string | null; address?: string | null } | null
  lender?: MergePartyInfo | null
  property?: {
    address?: string | null
    price?: string | null
    mlsNumber?: string | null
    lastViewedAddress?: string | null
  } | null
  leadSource?: { name?: string | null; campaign?: string | null } | null
  /** Timezone for %greeting% (defaults to America/Los_Angeles). */
  timeZone?: string | null
  /** The send-time clock for %greeting%. renderCrmMerge is PURE (hydration-
   *  safe): without a caller-supplied clock, %greeting% stays literal.
   *  buildMergeContext stamps it server-side on every send path. */
  now?: Date
}

/** Trimmed string or null (empty/whitespace/nullish → null). */
function val(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s || null
}

/** Primary entry from a crm_people jsonb contact list ([{value,isPrimary}]). */
function primaryValue(list: unknown): string | null {
  if (!Array.isArray(list)) return null
  const sorted = [...(list as Array<{ value?: unknown; isPrimary?: unknown }>)].sort(
    (a, b) => Number(!!b?.isPrimary) - Number(!!a?.isPrimary),
  )
  return val(sorted[0]?.value)
}

type AddressLike = { street?: unknown; city?: unknown; state?: unknown; code?: unknown; zip?: unknown }

function firstAddress(list: unknown): AddressLike | null {
  if (!Array.isArray(list) || list.length === 0) return null
  return (list as AddressLike[])[0] ?? null
}

/** "Good morning" / "Good afternoon" / "Good evening" in the given timezone.
 *  Routed through the canonical lib/format/date helper (ci:date-format). */
export function greetingFor(now: Date, timeZone: string): string {
  let hour: number
  try {
    hour = Number(
      formatDate(now, {
        month: undefined,
        day: undefined,
        year: undefined,
        hour: 'numeric',
        hour12: false,
        timeZone,
      }),
    )
  } catch {
    hour = now.getHours()
  }
  if (!Number.isFinite(hour)) hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** Split a display name into first + last ("Matt Ryan" → ["Matt","Ryan"]). */
export function splitName(name: string | null | undefined): { first: string | null; last: string | null } {
  const s = (name ?? '').trim()
  if (!s) return { first: null, last: null }
  const parts = s.split(/\s+/)
  return { first: parts[0] ?? null, last: parts.length > 1 ? parts.slice(1).join(' ') : null }
}

/**
 * Resolve every merge token in `text` against the person + context.
 * Tokens whose data is unknown/empty stay LITERAL (the composer warning +
 * fail-closed automated-send gate catch them); %contact_first_name% keeps its
 * long-standing 'there' fallback.
 */
export function renderCrmMerge(
  text: string,
  person: MergePersonLike,
  ctx?: MergeContext,
): string {
  const nameSplit = splitName(person.name)
  const first = val(person.first_name) ?? nameSplit.first ?? 'there'
  const last = val(person.last_name) ?? nameSplit.last

  const addr = firstAddress(person.addresses)
  const street = val(addr?.street)
  const city = val(addr?.city)
  const state = val(addr?.state)
  const zip = val(addr?.code) ?? val(addr?.zip)
  const fullAddress = [street, [city, state].filter(Boolean).join(' '), zip]
    .filter(Boolean)
    .join(', ') || null

  const customAddress =
    val(person.custom?.customSellerPropertyAddress) ??
    val(person.custom?.customPropertyAddress) ??
    val(ctx?.property?.address)
  const cmaLink = val(person.custom?.cmaLink)

  const lenderSplit = splitName(person.lender_name)
  const agent = ctx?.agent ?? null
  const sender = ctx?.sender ?? null
  const lender = ctx?.lender ?? null

  // Pure: no ambient Date read — %greeting% resolves only when the caller
  // supplies the send-time clock (buildMergeContext always does).
  const greeting = ctx?.now ? greetingFor(ctx.now, ctx?.timeZone || 'America/Los_Angeles') : null

  // Token → resolved value; null keeps the token literal.
  const map: Record<string, string | null> = {
    // CONTACT
    '%contact_first_name%': first,
    '%contact_last_name%': last,
    '%contact_email%': primaryValue(person.emails),
    '%contact_phone%': primaryValue(person.phones),
    '%contact_stage%': val(person.stage),
    '%contact_address_street%': street,
    '%contact_address_city%': city,
    '%contact_address_state%': state,
    '%contact_address_zip%': zip,
    '%contact_address_full%': fullAddress,
    // AGENT
    '%agent_first_name%': val(agent?.firstName),
    '%agent_last_name%': val(agent?.lastName),
    '%agent_email%': val(agent?.email),
    '%agent_phone%': val(agent?.phone),
    '%agent_title%': val(agent?.title),
    '%agent_brokerage%': val(agent?.brokerage) ?? val(ctx?.company?.name),
    '%agent_website%': val(agent?.website),
    // SENDER
    '%sender_first_name%': val(sender?.firstName),
    '%sender_last_name%': val(sender?.lastName),
    '%sender_email%': val(sender?.email),
    '%sender_phone%': val(sender?.phone),
    // COMPANY
    '%company_name%': val(ctx?.company?.name),
    '%company_address%': val(ctx?.company?.address),
    // LENDER (context first, then the person's lender_name split)
    '%lender_first_name%': val(lender?.firstName) ?? lenderSplit.first,
    '%lender_last_name%': val(lender?.lastName) ?? lenderSplit.last,
    '%lender_email%': val(lender?.email),
    '%lender_phone%': val(lender?.phone),
    // PROPERTY
    '%customSellerPropertyAddress%': customAddress,
    '%customPropertyAddress%': customAddress,
    '%address%': customAddress,
    '%property_price%': val(ctx?.property?.price),
    '%property_mls_number%': val(ctx?.property?.mlsNumber),
    '%last_viewed_address%': val(ctx?.property?.lastViewedAddress),
    // LEAD SOURCE
    '%lead_source_name%': val(ctx?.leadSource?.name) ?? val(person.source),
    '%lead_source_campaign%': val(ctx?.leadSource?.campaign),
    // CMA
    '%cma_link%': cmaLink,
    // OTHER
    '%greeting%': greeting,
    // Legacy aliases (older seeded copy + crons)
    '%first%': first,
    '{{first_name}}': first,
    '{{firstName}}': first,
    '{{address}}': customAddress,
    '{{cma_link}}': cmaLink,
  }

  let out = text
  for (const [token, value] of Object.entries(map)) {
    if (value !== null && out.includes(token)) out = out.replaceAll(token, value)
  }

  // Generic custom-field tokens (%customBuyerSearchAreas%, {{customX}}, …) —
  // resolved from person.custom; unknown/empty tokens stay literal so the
  // composer's unresolved-token warning can catch them before send.
  const custom = (k: string): string | null => val(person.custom?.[k])
  return out
    .replace(/%(custom[A-Za-z0-9_]+)%/g, (m, k: string) => custom(k) ?? m)
    .replace(/\{\{(custom[A-Za-z0-9_]+)\}\}/g, (m, k: string) => custom(k) ?? m)
}

/**
 * Stamp the assigned broker onto every public ryan-realty.com link in an
 * outbound message. The ?agent= param sets the 90-day rr_agent_attribution
 * cookie (AgentAttributionBridge), so the site features THAT broker in lead
 * routing and broker-facing CTAs when the lead clicks through from CRM
 * comms. Admin links and links that already carry an agent are untouched.
 */
export function attributeSiteLinks(
  text: string,
  brokerSlug: string | null | undefined,
  fubPersonId?: number | null,
): string {
  const slug = (brokerSlug ?? '').trim()
  const fuid = typeof fubPersonId === 'number' && Number.isInteger(fubPersonId) && fubPersonId > 0 ? String(fubPersonId) : ''
  if (!slug && !fuid) return text
  return text.replace(/https:\/\/(?:www\.)?ryan-realty\.com[^\s"'<)\]]*/g, (url) => {
    if (url.includes('/admin')) return url
    let out = url
    // Agent attribution — routes the lead to the broker whose email this is.
    if (slug && !/[?&]agent=/.test(out)) out += (out.includes('?') ? '&' : '?') + 'agent=' + encodeURIComponent(slug)
    // Recipient identity — every click on a link WE sent stamps ?_fuid=<id>, so
    // FubIdentityBridge cookies this browser to the contact and backfills their
    // anonymous sessions. This is what turns "Anonymous · Portland" into a name.
    if (fuid && !/[?&]_fuid=/.test(out)) out += (out.includes('?') ? '&' : '?') + '_fuid=' + fuid
    return out
  })
}

/** Merge tokens still present after rendering — surfaced as a composer warning
 *  and (since 2026-06-13) a hard fail-closed gate before any automated send.
 *  Covers %x% / %word% (single char allowed — the {{}} arm always did), {{x}},
 *  Mailchimp *|X|*, and ${x}. Bare [x] / {x} are intentionally NOT matched:
 *  they collide with normal prose + markdown and would block legitimate copy. */
export function findUnresolvedMergeTokens(text: string): string[] {
  const hits = new Set<string>()
  const re = /%[A-Za-z][A-Za-z0-9_]*%|\{\{[A-Za-z][A-Za-z0-9_]*\}\}|\*\|[A-Za-z][A-Za-z0-9_]*\|\*|\$\{[A-Za-z][A-Za-z0-9_]*\}/g
  for (const m of text.matchAll(re)) hits.add(m[0])
  return [...hits]
}

/** True when the template references the CMA link merge token. */
export function referencesCmaLink(text: string): boolean {
  return text.includes('%cma_link%') || text.includes('{{cma_link}}')
}

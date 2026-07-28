import 'server-only'

/**
 * Batch classification for the worklist (spec 07 §7 — bounded reads).
 *
 * The per-row path (get.ts `build*RowSkeleton`) issues a cmas/slug lookup + a
 * relist `listings` query + an isSuppressed read PER ROW. Over the full ~160-row
 * set that is ~500 round-trips per page load (the original hang + stack overflow).
 * These helpers resolve the same doc-state + compliance for the WHOLE set in a
 * fixed handful of batched queries, matched in memory. Used only by list.ts;
 * getProspect (single row) keeps the simple per-row path.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { slugifyAddress } from '@/lib/cma/address-slug'
import { TAG_CHANNEL } from '@/lib/crm/suppressions'
import {
  blockAllChannels,
  expectedDocTypeFor,
  hasSendableEmail,
  hasSendablePhone,
  mergeChannelSentState,
  PROSPECT_CHANNELS,
  type ProspectChannel,
  type ProspectChannelBlocks,
  type ProspectComplianceState,
  type ProspectDocState,
  type ProspectKind,
} from './types'

type Sb = ReturnType<typeof createServiceClient>
type RawRow = Record<string, unknown>

function num(v: unknown): number | null {
  return v == null ? null : Number(v)
}
function baseOfSlug(slug: string): string {
  return slug.replace(/--v\d+$/, '')
}
function versionOfSlug(slug: string): number {
  const m = /--v(\d+)$/.exec(slug)
  return m ? Number(m[1]) : 1
}
function isBuiltStatus(status: string | null, htmlPath: string | null): boolean {
  return (
    (status === 'draft' || status === 'finalized' || status === 'delivered') &&
    !!htmlPath &&
    !htmlPath.startsWith('pending:')
  )
}

interface CmaLite {
  id: string
  slug: string
  docType: string
  status: string | null
  htmlPath: string | null
  recommendedList: number | null
}

// ── Doc state, batched ──────────────────────────────────────────────────────

export async function resolveDocsBatch(
  kind: ProspectKind,
  rows: RawRow[],
): Promise<Map<string, ProspectDocState>> {
  const out = new Map<string, ProspectDocState>()
  const sb = createServiceClient()
  const idKey = kind === 'expired' ? 'listing_key' : 'fsbo_url'
  const expected = expectedDocTypeFor(kind)

  // ONE cmas read (the table is ~170 rows total; project only what we classify).
  const { data: cmaData, error: cmaErr } = await sb
    .from('cmas')
    .select('id, slug, doc_type, status, html_path, recommended_list')
  if (cmaErr) console.error('[prospecting] resolveDocsBatch cmas read failed:', cmaErr.message)
  const cmas: CmaLite[] = ((cmaData ?? []) as RawRow[]).map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    docType: String(r.doc_type ?? 'cma'),
    status: (r.status as string | null) ?? null,
    htmlPath: (r.html_path as string | null) ?? null,
    recommendedList: num(r.recommended_list),
  }))
  const byId = new Map<string, CmaLite>(cmas.map((c) => [c.id, c]))
  const byBase = new Map<string, CmaLite[]>()
  for (const c of cmas) {
    const b = baseOfSlug(c.slug)
    const arr = byBase.get(b)
    if (arr) arr.push(c)
    else byBase.set(b, [c])
  }

  // ONE open/killed actions read for building/failed states (target = cma:<slug>).
  const { data: actData } = await sb
    .from('marketing_brain_actions')
    .select('target, status, killed_reason')
    .eq('action_type', 'content:cma')
    .in('status', ['pending', 'in_production', 'killed'])
  const actionBySlug = new Map<string, { status: string; killedReason: string | null }>()
  for (const a of (actData ?? []) as RawRow[]) {
    const target = String(a.target ?? '')
    if (!target.startsWith('cma:')) continue
    actionBySlug.set(target.slice(4).toLowerCase(), {
      status: String(a.status ?? ''),
      killedReason: (a.killed_reason as string | null) ?? null,
    })
  }

  const pickForBase = (base: string): CmaLite | null => {
    const group = byBase.get(base)
    if (!group || group.length === 0) return null
    // Prefer the highest-version BUILT doc of the expected type; else the highest-version built of any type.
    const built = group.filter((c) => isBuiltStatus(c.status, c.htmlPath))
    const expectedBuilt = built.filter((c) => c.docType === expected)
    const pool = expectedBuilt.length ? expectedBuilt : built.length ? built : group
    return pool.slice().sort((a, b) => versionOfSlug(b.slug) - versionOfSlug(a.slug))[0] ?? null
  }

  for (const raw of rows) {
    const id = String(raw[idKey])
    const cmaId = (raw.cma_id as string | null) ?? null
    // Channel-aware sent-state: the row is "sent" when EITHER channel sent.
    // outreach_email_sent_at is absent pre-migration (feature-detected select)
    // — undefined coerces to null and the state stays SMS-only.
    const smsSentAt = (raw.outreach_sms_sent_at as string | null) ?? null
    const emailSentAt = (raw.outreach_email_sent_at as string | null | undefined) ?? null
    const sent = mergeChannelSentState(smsSentAt, emailSentAt)
    const sid = (raw.outreach_sms_sid as string | null) ?? null
    const street = (raw.street_address as string | null) ?? null
    const base = street ? slugifyAddress(street) : null

    const cma = (cmaId ? byId.get(cmaId) : null) ?? (base ? pickForBase(base) : null)

    if (cma && cma.docType === expected && isBuiltStatus(cma.status, cma.htmlPath)) {
      if (sent) {
        out.set(id, {
          state: 'sent',
          slug: cma.slug,
          docType: cma.docType,
          recommendedList: cma.recommendedList,
          sentAt: sent.sentAt,
          sid: sent.smsSentAt ? sid : null,
          smsSentAt: sent.smsSentAt,
          emailSentAt: sent.emailSentAt,
        })
      } else {
        out.set(id, { state: 'ready', slug: cma.slug, docType: cma.docType, status: cma.status ?? 'draft', recommendedList: cma.recommendedList })
      }
      continue
    }

    // No usable built doc of the expected type — is one building / failed?
    const slugForAction = cma?.slug ?? base
    const action = slugForAction ? actionBySlug.get(slugForAction) : undefined
    if (action) {
      if (action.status === 'killed') out.set(id, { state: 'failed', reason: action.killedReason })
      else out.set(id, { state: 'building', actionId: null })
      continue
    }
    out.set(id, { state: 'none' })
  }

  return out
}

// ── Compliance, batched ─────────────────────────────────────────────────────

// Derived from the ONE suppression mapping (M9) — per CHANNEL, never a single
// merged set. Never hand-copy these: a drift between the two lists is exactly
// the 2026-06-16 do-not-call → SMS incident. Lower-cased to match the
// case-insensitive tag scan below.
function tagsBlocking(channel: ProspectChannel): Set<string> {
  return new Set(
    TAG_CHANNEL.filter((m) => m.channels.includes('all') || m.channels.includes(channel)).map((m) =>
      m.tag.toLowerCase(),
    ),
  )
}
const TAGS_BY_CHANNEL: Record<ProspectChannel, Set<string>> = {
  sms: tagsBlocking('sms'),
  email: tagsBlocking('email'),
  call: tagsBlocking('call'),
}

/** Broker-facing reason for a tag, so the ribbon names the actual condition. */
const TAG_REASON: Record<string, string> = {
  'compliance:hard-stop': 'Compliance hard stop',
  'contact:do-not-call': 'On the do-not-call registry',
  'contact:do-not-text': 'Asked not to be texted',
  do_not_email: 'Asked not to be emailed',
  unsubscribed: 'Unsubscribed from email',
  bounced: 'Email bounced',
  complained: 'Marked an email as spam',
}
function reasonForTag(tag: string): string {
  return TAG_REASON[tag] ?? `Tag: ${tag}`
}

// Defense-in-depth (review F5): a structured skip-trace flag that names a
// dangerous condition blocks a send even if the writer forgot to also flip the
// compliance_hard_stop boolean. Matched case-insensitively against compliance_flags.
const DANGEROUS_FLAGS = new Set([
  'litigator',
  'deceased',
  'dnc',
  'dnc:tcpa',
  'do-not-call',
  'do_not_call',
  'do-not-text',
  'hard-stop',
])

function streetNumber(street: string | null): string | null {
  if (!street) return null
  const n = street.split(' ')[0]
  return n || null
}
function namePrefix(street: string | null): string {
  if (!street) return ''
  const n = street.split(' ')[0]
  return street.slice(n.length + 1).split(' ')[0]?.toUpperCase() ?? ''
}
function personIdOf(raw: RawRow): number | null {
  const a = raw.outreach_crm_person_id
  const b = raw.fub_person_id
  if (typeof a === 'number') return a
  if (typeof b === 'number') return b
  return null
}

export async function resolveComplianceBatch(
  kind: ProspectKind,
  rows: RawRow[],
): Promise<Map<string, ProspectComplianceState>> {
  const out = new Map<string, ProspectComplianceState>()
  const sb = createServiceClient()
  const idKey = kind === 'expired' ? 'listing_key' : 'fsbo_url'

  // ── Batch the relist read: one listings query scoped to the street numbers present.
  const nums = [...new Set(rows.map((r) => streetNumber(r.street_address as string | null)).filter((n): n is string => !!n))]
  const onMarketByNumber = new Map<string, Array<{ streetName: string; city: string; ts: string | null }>>()
  if (nums.length > 0) {
    const { data, error } = await sb
      .from('listings')
      .select('StreetNumber, StreetName, City, status_change_timestamp')
      .in('StreetNumber', nums)
      .in('StandardStatus', ['Active', 'Pending', 'Coming Soon'])
    if (error) {
      console.error('[prospecting] resolveComplianceBatch relist read failed:', error.message)
    } else {
      for (const l of (data ?? []) as RawRow[]) {
        const key = String(l.StreetNumber ?? '')
        const arr = onMarketByNumber.get(key) ?? []
        arr.push({
          streetName: String(l.StreetName ?? '').toUpperCase(),
          city: String(l.City ?? '').toUpperCase(),
          ts: (l.status_change_timestamp as string | null) ?? null,
        })
        onMarketByNumber.set(key, arr)
      }
    }
  }

  // ── Batch the suppression read: crm_suppressions + crm_people.tags for all
  // persons, resolved PER CHANNEL. A do-not-call contact blocks sms + call and
  // leaves email open; collapsing these into one set is the bug this replaces.
  const personIds = [...new Set(rows.map(personIdOf).filter((p): p is number => p != null))]
  const blockedByChannel: Record<ProspectChannel, Map<number, string>> = {
    sms: new Map(),
    email: new Map(),
    call: new Map(),
  }
  let suppressionReadFailed = false
  if (personIds.length > 0) {
    const [supRows, peopleRows] = await Promise.all([
      sb
        .from('crm_suppressions')
        .select('person_id, channel, reason')
        .in('person_id', personIds)
        .in('channel', ['all', 'sms', 'email', 'call']),
      sb.from('crm_people').select('id, tags').in('id', personIds),
    ])
    if (supRows.error || peopleRows.error) {
      // Fail-closed: every resolvable person is blocked on every channel.
      suppressionReadFailed = true
      console.error('[prospecting] resolveComplianceBatch suppression read failed:', supRows.error?.message ?? peopleRows.error?.message)
    } else {
      for (const s of supRows.data ?? []) {
        const pid = Number(s.person_id)
        const ch = String(s.channel ?? '')
        const why = `Opt-out on file (${String(s.reason ?? ch)})`
        for (const c of PROSPECT_CHANNELS) {
          if (ch === 'all' || ch === c) if (!blockedByChannel[c].has(pid)) blockedByChannel[c].set(pid, why)
        }
      }
      for (const p of peopleRows.data ?? []) {
        const pid = Number(p.id)
        const tags = ((p.tags as string[] | undefined) ?? []).map((t) => t.toLowerCase())
        for (const c of PROSPECT_CHANNELS) {
          const hit = tags.find((t) => TAGS_BY_CHANNEL[c].has(t))
          if (hit && !blockedByChannel[c].has(pid)) blockedByChannel[c].set(pid, reasonForTag(hit))
        }
      }
    }
  }

  for (const raw of rows) {
    const id = String(raw[idKey])
    const street = (raw.street_address as string | null) ?? null
    const city = String((raw.city as string | null) ?? '').toUpperCase()
    const personId = personIdOf(raw)
    const persistedHardStop = (raw.compliance_hard_stop as boolean | null) === true
    const flags = Array.isArray(raw.compliance_flags) ? (raw.compliance_flags as unknown[]).map((f) => String(f)) : []

    const dangerousFlag = flags.find((f) => DANGEROUS_FLAGS.has(f.toLowerCase())) ?? null
    // A dangerous skip-trace flag (litigator / deceased / DNC) and the persisted
    // compliance_hard_stop column are BOTH all-channel conditions.
    const allChannelReason = persistedHardStop
      ? 'Compliance hard stop on the record'
      : dangerousFlag
        ? `Skip-trace flag: ${dangerousFlag}`
        : suppressionReadFailed && personId != null
          ? 'Compliance check unavailable'
          : null

    const blockFor = (c: ProspectChannel) => {
      const why = personId != null ? (blockedByChannel[c].get(personId) ?? null) : null
      return { blocked: why != null, reason: why }
    }
    const channels: ProspectChannelBlocks = allChannelReason
      ? blockAllChannels(allChannelReason)
      : { sms: blockFor('sms'), email: blockFor('email'), call: blockFor('call') }

    const suppressedSms = channels.sms.blocked
    const hardStop = channels.sms.blocked

    // Relist match (in memory).
    const numKey = streetNumber(street)
    const prefix = namePrefix(street)
    const candidates = numKey ? onMarketByNumber.get(numKey) ?? [] : []
    const relisted = candidates.some((l) => {
      if (!l.streetName.startsWith(prefix) || l.city !== city) return false
      if (kind === 'fsbo') return true
      const scts = (raw.status_change_timestamp as string | null) ?? null
      return scts == null || (l.ts ?? '') > scts
    })

    const offMarket = kind === 'fsbo' ? ((raw.status as string | null) ?? 'active') !== 'active' : false
    const noPhone = !hasSendablePhone((raw.contact_phone as string | null) ?? null)
    const noEmail = !hasSendableEmail((raw.contact_email as string | null) ?? null)
    // A missing address is a reachability gap, not a compliance decision — but
    // the channel is still closed, so the map has to say so.
    if (noPhone) {
      for (const c of ['sms', 'call'] as ProspectChannel[]) {
        if (!channels[c].blocked) channels[c] = { blocked: true, reason: 'No phone on file' }
      }
    }
    if (noEmail && !channels.email.blocked) channels.email = { blocked: true, reason: 'No email on file' }

    const allChannelsBlocked = PROSPECT_CHANNELS.every((c) => channels[c].blocked)

    const reasons: string[] = []
    if (allChannelsBlocked) reasons.push('No open channel — do not contact')
    for (const c of PROSPECT_CHANNELS) {
      if (channels[c].blocked && channels[c].reason) reasons.push(`${c.toUpperCase()}: ${channels[c].reason}`)
    }
    if (relisted) reasons.push('Relisted in MLS')
    if (offMarket) reasons.push('Off market')

    out.set(id, {
      hardStop,
      flags,
      relisted,
      offMarket,
      suppressedSms,
      noPhone,
      noEmail,
      reasons,
      channels,
      allChannelsBlocked,
    })
  }

  return out
}

/**
 * Fail-closed relist check for the SEND path (review F2).
 *
 * The worklist's `resolveComplianceBatch` fails OPEN on a `listings` read error
 * (so a transient error doesn't paint every row "relisted" in the UI). The cold
 * send must fail CLOSED — a read error must BLOCK, never silently solicit a
 * property that may be back on the market. Returns `verifyFailed:true` on any
 * read error so the caller refuses. `expiryComparator` is the prospect's
 * off-market timestamp; for expired we only count on-market listings newer than
 * it, for fsbo any current on-market match blocks.
 */
export async function verifyNotRelisted(
  kind: ProspectKind,
  prospect: { street_address: string | null; city: string | null; expiryComparator: string | null },
): Promise<{ relisted: boolean; verifyFailed: boolean }> {
  if (!prospect.street_address) return { relisted: false, verifyFailed: false }
  try {
    const sb = createServiceClient()
    const numKey = streetNumber(prospect.street_address)
    if (!numKey) return { relisted: false, verifyFailed: false }
    const prefix = namePrefix(prospect.street_address)
    const city = String(prospect.city ?? '').toUpperCase()
    const { data, error } = await sb
      .from('listings')
      .select('StreetName, City, status_change_timestamp')
      .eq('StreetNumber', numKey)
      .in('StandardStatus', ['Active', 'Pending', 'Coming Soon'])
    if (error) {
      console.error('[prospecting] verifyNotRelisted read failed (fail-closed):', error.message)
      return { relisted: false, verifyFailed: true }
    }
    const relisted = ((data ?? []) as RawRow[]).some((l) => {
      if (!String(l.StreetName ?? '').toUpperCase().startsWith(prefix)) return false
      if (String(l.City ?? '').toUpperCase() !== city) return false
      if (kind === 'fsbo') return true
      return prospect.expiryComparator == null || String(l.status_change_timestamp ?? '') > prospect.expiryComparator
    })
    return { relisted, verifyFailed: false }
  } catch (e) {
    console.error('[prospecting] verifyNotRelisted threw (fail-closed):', e instanceof Error ? e.message : e)
    return { relisted: false, verifyFailed: true }
  }
}

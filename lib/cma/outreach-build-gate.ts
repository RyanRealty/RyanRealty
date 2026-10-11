/**
 * Expired and FSBO builds run the intake gate before any other work.
 *
 * Live status, then compliance, then a sendable email, then a cell whose
 * line type is mobile, wireless, or cell. Seller-form and lead-form CMAs
 * do not use this. The decision is decideProspectIntake. This module does
 * not send.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { getCmaAdminReviewRowBySlug } from '@/lib/data'
import { getPersonForCmaKickoff } from '@/lib/data/crm/cmaKickoff'
import { probeIntakeBackOnMarket } from '@/lib/data/prospecting/compliance'
import { hasSendableEmail } from '@/lib/data/prospecting/types'
import { isSuppressedByEmail } from '@/lib/crm/suppressions'
import { classifyCmaOrigin } from '@/lib/cma/origin'
import {
  decideProspectIntake,
  emailBlockedByFlags,
  type IntakePhone,
} from '@/lib/prospecting/intake-gate'
import type { CmaBuildInput } from '@/lib/cma/types'

export type OutreachKind = 'expired' | 'fsbo'

export type OutreachBuildDecision =
  | { ok: true }
  | { ok: false; reason: string }

const UNREADABLE = 'Live status could not be read. The CMA was not built.'
const ON_MARKET = 'This home is on the market. The CMA was not built.'
const LITIGATOR = 'The owner is marked as a litigator. The CMA was not built.'
const DECEASED = 'The owner is marked as deceased. The CMA was not built.'
const HARD_STOP = 'This owner is blocked for email. The CMA was not built.'
const SUPPRESSED = 'The owner email is suppressed. The CMA was not built.'
const SMS_BLOCKED = 'The cell cannot be texted. The CMA was not built.'
const NO_CHANNEL = 'There is no sendable owner email or cell. The CMA was not built.'
const ROW_UNREAD = 'The CMA row could not be read. The CMA was not built.'
const EMAIL_UNREAD = 'The email check could not be read. The CMA was not built.'

export function outreachOrigin(
  requestSource: string | null | undefined,
  docType?: string | null,
): OutreachKind | null {
  const origin = classifyCmaOrigin(requestSource, docType)
  return origin === 'expired' || origin === 'fsbo' ? origin : null
}

/** Street number and name, without the city that a persisted CMA address appends. */
export function outreachStreet(raw: string | null | undefined): string | null {
  const head = (raw ?? '').split(',')[0]?.trim() ?? ''
  return head || null
}

export function ownerPhonesFromPayload(raw: unknown): IntakePhone[] | null {
  if (!Array.isArray(raw)) return null
  const phones: IntakePhone[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const number = typeof row.number === 'string' ? row.number : null
    const value = typeof row.value === 'string' ? row.value : null
    if (!number && !value) continue
    phones.push({
      number,
      value,
      type: typeof row.type === 'string' ? row.type : null,
      dnc: row.dnc === true,
    })
  }
  return phones.length > 0 ? phones : null
}

export function decideOutreachBuild(input: {
  unreadable: boolean
  onMarket: boolean
  hardStop: boolean
  flags: readonly string[]
  email: string | null
  emailSuppressed: boolean
  phones: readonly IntakePhone[] | null
}): OutreachBuildDecision {
  if (input.unreadable) return { ok: false, reason: UNREADABLE }
  const flags = input.flags.map((flag) => flag.toLowerCase())
  const decision = decideProspectIntake({
    onMarket: input.onMarket,
    litigator: flags.includes('litigator'),
    deceased: flags.includes('deceased'),
    dncTcpa: flags.includes('dnc:tcpa'),
    dncPhone: flags.includes('dnc') || flags.includes('do-not-call') || flags.includes('do_not_call'),
    email: input.email,
    emailSuppressed: input.emailSuppressed,
    phones: input.phones,
  })
  if (decision.action === 'skip' && decision.reason === 'back-on-market') {
    return { ok: false, reason: ON_MARKET }
  }
  if (decision.action === 'skip' && decision.reason === 'litigator') {
    return { ok: false, reason: LITIGATOR }
  }
  if (decision.action === 'skip' && decision.reason === 'deceased') {
    return { ok: false, reason: DECEASED }
  }
  if (emailBlockedByFlags(input.flags, input.hardStop)) {
    return { ok: false, reason: HARD_STOP }
  }
  if (decision.action === 'skip' && decision.reason === 'email-suppressed') {
    return { ok: false, reason: SUPPRESSED }
  }
  if (decision.action === 'skip' && decision.reason === 'sms-blocked') {
    return { ok: false, reason: SMS_BLOCKED }
  }
  if (decision.action === 'skip') return { ok: false, reason: NO_CHANNEL }
  return { ok: true }
}

type ProspectRow = {
  street_address: string | null
  city: string | null
  comparator: string | null
  hardStop: boolean
  flags: string[]
  contactEmail: string | null
  contactPhone: string | null
}

function flagList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((flag): flag is string => typeof flag === 'string')
}

async function linkedKind(cmaId: string): Promise<OutreachKind | null> {
  const sb = createServiceClient()
  const [expired, fsbo] = await Promise.all([
    sb.from('expired_listings').select('id').eq('cma_id', cmaId).limit(1),
    sb.from('fsbo_listings').select('id').eq('cma_id', cmaId).limit(1),
  ])
  if (expired.error || fsbo.error) throw new Error(expired.error?.message ?? fsbo.error?.message ?? 'prospect read failed')
  if ((expired.data ?? []).length > 0) return 'expired'
  if ((fsbo.data ?? []).length > 0) return 'fsbo'
  return null
}

async function loadProspect(cmaId: string, kind: OutreachKind): Promise<ProspectRow | null> {
  const sb = createServiceClient()
  if (kind === 'expired') {
    const { data, error } = await sb
      .from('expired_listings')
      .select(
        'street_address, city, status_change_timestamp, compliance_hard_stop, compliance_flags, contact_email, contact_phone',
      )
      .eq('cma_id', cmaId)
      .limit(1)
    if (error) throw new Error(error.message)
    const row = (data ?? [])[0] as
      | {
          street_address?: string | null
          city?: string | null
          status_change_timestamp?: string | null
          compliance_hard_stop?: boolean | null
          compliance_flags?: unknown
          contact_email?: string | null
          contact_phone?: string | null
        }
      | undefined
    if (!row) return null
    return {
      street_address: row.street_address ?? null,
      city: row.city ?? null,
      comparator: row.status_change_timestamp ?? null,
      hardStop: row.compliance_hard_stop === true,
      flags: flagList(row.compliance_flags),
      contactEmail: row.contact_email ?? null,
      contactPhone: row.contact_phone ?? null,
    }
  }
  const { data, error } = await sb
    .from('fsbo_listings')
    .select('street_address, city, detected_at, compliance_hard_stop, compliance_flags, contact_email, contact_phone')
    .eq('cma_id', cmaId)
    .limit(1)
  if (error) throw new Error(error.message)
  const row = (data ?? [])[0] as
    | {
        street_address?: string | null
        city?: string | null
        detected_at?: string | null
        compliance_hard_stop?: boolean | null
        compliance_flags?: unknown
        contact_email?: string | null
        contact_phone?: string | null
      }
    | undefined
  if (!row) return null
  return {
    street_address: row.street_address ?? null,
    city: row.city ?? null,
    comparator: row.detected_at ?? null,
    hardStop: row.compliance_hard_stop === true,
    flags: flagList(row.compliance_flags),
    contactEmail: row.contact_email ?? null,
    contactPhone: row.contact_phone ?? null,
  }
}

async function parcelForListing(listingKey: string): Promise<string | null> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('listings')
    .select('parcel_number')
    .eq('ListingKey', listingKey)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const parcel = (data as { parcel_number?: string | null } | null)?.parcel_number ?? null
  const trimmed = (parcel ?? '').trim()
  return trimmed || null
}

function firstSendable(candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const email = (candidate ?? '').trim().toLowerCase()
    if (hasSendableEmail(email)) return email
  }
  return null
}

function phonesForBuild(
  typed: readonly IntakePhone[] | null | undefined,
  rawNumbers: Array<string | null | undefined>,
): IntakePhone[] {
  if (typed && typed.length > 0) return [...typed]
  const phones: IntakePhone[] = []
  for (const raw of rawNumbers) {
    const value = (raw ?? '').trim()
    if (!value) continue
    phones.push({ value, type: null, dnc: false })
  }
  return phones
}

/**
 * Refuse an expired or FSBO build that is back on the market, blocked, or
 * has no sendable email and no typed cell. Any other CMA proceeds.
 * A failed read refuses the build.
 */
export async function gateOutreachBuild(input: CmaBuildInput): Promise<OutreachBuildDecision> {
  const slug = input.slug.trim().toLowerCase()
  let row: Awaited<ReturnType<typeof getCmaAdminReviewRowBySlug>>
  try {
    row = await getCmaAdminReviewRowBySlug(slug)
  } catch {
    return { ok: false, reason: ROW_UNREAD }
  }
  let kind = outreachOrigin(input.requestSource, input.docType) ?? (row ? outreachOrigin(row.request_source as string | null, row.doc_type as string | null) : null)
  if (!kind && row?.id) {
    try {
      kind = await linkedKind(String(row.id))
    } catch {
      return { ok: false, reason: UNREADABLE }
    }
  }
  if (!kind) return { ok: true }

  let prospect: ProspectRow | null = null
  if (row?.id) {
    try {
      prospect = await loadProspect(String(row.id), kind)
    } catch {
      return { ok: false, reason: UNREADABLE }
    }
  }

  const listingKey = ((row?.subject_listing_key as string | null) ?? input.mlsNumber ?? '').trim()
  let parcel: string | null = null
  if (listingKey) {
    try {
      parcel = await parcelForListing(listingKey)
    } catch {
      return { ok: false, reason: UNREADABLE }
    }
  }

  const street = outreachStreet(prospect?.street_address) ?? outreachStreet(input.rawAddress) ?? outreachStreet(row?.subject_address as string | null)
  const city = prospect?.city ?? input.city ?? (row?.subject_city as string | null) ?? null
  const live = await probeIntakeBackOnMarket({
    kind,
    streetAddress: street,
    city,
    expiryComparator: prospect?.comparator ?? null,
    parcelNumber: parcel,
  })

  let email = firstSendable([
    input.client.email,
    (row?.client_email as string | null) ?? null,
    prospect?.contactEmail,
  ])
  if (!email && (input.personId ?? row?.person_id) != null) {
    try {
      const person = await getPersonForCmaKickoff(Number(input.personId ?? row?.person_id))
      email = firstSendable([person?.primaryEmail])
    } catch {
      return { ok: false, reason: EMAIL_UNREAD }
    }
  }
  let emailSuppressed = false
  if (email) {
    try {
      const sup = await isSuppressedByEmail(email, 'email')
      if (sup.reasons.some((reason) => reason.startsWith('email-suppression-check-failed'))) {
        return { ok: false, reason: EMAIL_UNREAD }
      }
      emailSuppressed = sup.suppressed
    } catch {
      return { ok: false, reason: EMAIL_UNREAD }
    }
  }

  return decideOutreachBuild({
    unreadable: live.unreadable,
    onMarket: live.onMarket,
    hardStop: prospect?.hardStop === true,
    flags: prospect?.flags ?? [],
    email,
    emailSuppressed,
    phones: phonesForBuild(input.ownerPhones, [
      input.client.phone,
      (row?.client_phone as string | null) ?? null,
      prospect?.contactPhone,
    ]),
  })
}

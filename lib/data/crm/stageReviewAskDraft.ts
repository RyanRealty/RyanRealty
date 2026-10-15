/**
 * Google review asks: the reads that decide who gets one, and the one writer.
 * NEVER SENDS (Matt 2026-10-14: each send needs his yes on that message).
 *
 * A staged ask is (1) a draft in the owner's CRM Drafts folder
 * (`crm_message_drafts`, /admin/messages?f=drafts), which only a broker's Send
 * click turns into an email or text, and (2) one `crm_timeline` ledger row
 * whose dedupe_key (unique index) records that this person was drafted for
 * this deal or pick. The ledger outlives the draft: after the draft is sent or
 * discarded, the closing path never drafts that person again.
 *
 * A broker-authored draft on the same (person, owner, channel) slot is left
 * alone (`skipped-existing-draft`); an ask already waiting is `already`.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { getDraftsForPeople, listDraftsForPeopleAnyOwner, upsertDraft, type MessageDraft } from '@/lib/data/crm/drafts'
import { isSuppressed } from '@/lib/crm/suppressions'
import {
  REVIEW_ASK_SUBJECT,
  SENT_REVIEW_LINK_MARKERS,
  decideReviewAsk,
  isReviewAskDraft,
  isSentReviewAsk,
  reviewAskConsentNeeds,
  reviewAskPrecheck,
  type ReviewAskChannel,
  type ReviewAskConsent,
  type ReviewAskDecision,
  type ReviewAskHistory,
  type ReviewAskPath,
  type ReviewAskPerson,
} from '@/lib/crm/review-ask'

const CHUNK = 200

type PersonRow = {
  id: number
  first_name: string | null
  name: string | null
  stage: string | null
  tags: string[] | null
  emails: Array<{ value?: string }> | null
  phones: Array<{ value?: string }> | null
  deleted: boolean | null
}

function values(list: Array<{ value?: string }> | null): string[] {
  return (Array.isArray(list) ? list : [])
    .map((e) => String(e?.value ?? '').trim())
    .filter((v) => v.length > 0)
}

function chunks<T>(list: readonly T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK))
  return out
}

function earliest(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a < b ? a : b
}

export type ReviewAskFacts = {
  person: ReviewAskPerson
  history: ReviewAskHistory
  /** The owner's draft slots, so the stager can tell an ask from a broker's own draft. */
  drafts: { email: MessageDraft | null; text: MessageDraft | null }
}

/**
 * Person, history and the owner's drafts for each id. Throws on any failed
 * read: an unreadable history must never look like "never asked".
 */
export async function getReviewAskFacts(
  personIds: readonly number[],
  ownerSlug: string,
): Promise<Map<number, ReviewAskFacts>> {
  const ids = [...new Set(personIds.filter((id) => Number.isInteger(id) && id > 0))]
  const out = new Map<number, ReviewAskFacts>()
  if (ids.length === 0) return out
  const sb = createServiceClient()

  const people = new Map<number, PersonRow>()
  const drafted = new Map<number, string>()
  const asked = new Map<number, string>()
  for (const part of chunks(ids)) {
    // Timeline reads page (G48): a long relationship can hold many "review"
    // subjects ("Offer Review", "for your review") before the filter drops them.
    const linkReads = SENT_REVIEW_LINK_MARKERS.map((marker) =>
      fetchPagedRows<{ person_id: number; kind: string; ts: string }>((from, to) =>
        sb
          .from('crm_timeline')
          .select('id,person_id,kind,ts')
          .in('person_id', part)
          .in('kind', ['email_out', 'sms_out'])
          .ilike('body', `%${marker}%`)
          .order('id', { ascending: true })
          .range(from, to),
      ),
    )
    const [p, ledger, byTitle, ...byLinks] = await Promise.all([
      sb.from('crm_people').select('id,first_name,name,stage,tags,emails,phones,deleted').in('id', part),
      fetchPagedRows<{ person_id: number; ts: string }>((from, to) =>
        sb
          .from('crm_timeline')
          .select('id,person_id,ts')
          .in('person_id', part)
          .like('dedupe_key', 'review-ask:%')
          .order('id', { ascending: true })
          .range(from, to),
      ),
      fetchPagedRows<{ person_id: number; kind: string; title: string | null; ts: string }>((from, to) =>
        sb
          .from('crm_timeline')
          .select('id,person_id,kind,title,ts')
          .in('person_id', part)
          .in('kind', ['email_out', 'sms_out'])
          .ilike('title', '%review%')
          .order('id', { ascending: true })
          .range(from, to),
      ),
      ...linkReads,
    ])
    for (const r of [p, ledger, byTitle, ...byLinks]) {
      if (r.error) throw new Error(`review-ask facts read failed: ${r.error.message}`)
    }
    for (const row of (p.data ?? []) as PersonRow[]) people.set(Number(row.id), row)
    // Any ledger row means drafted, even one whose ts did not come back.
    for (const row of ledger.rows) {
      drafted.set(row.person_id, earliest(drafted.get(row.person_id) ?? null, row.ts ?? null) ?? 'recorded')
    }
    for (const row of byTitle.rows) {
      if (isSentReviewAsk({ kind: row.kind, title: row.title, hasReviewLink: false })) {
        asked.set(row.person_id, earliest(asked.get(row.person_id) ?? null, row.ts ?? null) ?? 'recorded')
      }
    }
    for (const row of byLinks.flatMap((r) => r.rows)) {
      if (isSentReviewAsk({ kind: row.kind, title: null, hasReviewLink: true })) {
        asked.set(row.person_id, earliest(asked.get(row.person_id) ?? null, row.ts ?? null) ?? 'recorded')
      }
    }
  }

  // Every owner's drafts: an ask waiting in any broker's Drafts (the 2026-08-16
  // stager filed them under the deal broker) counts as pending; only the
  // owner's own slot decides whether a new draft can be written.
  const allDrafts = await listDraftsForPeopleAnyOwner(ids)
  const owner = ownerSlug.trim() || null
  for (const id of ids) {
    const row = people.get(id)
    if (!row) continue
    const mine = allDrafts.filter((d) => d.personId === id)
    const slot = {
      email: mine.find((d) => d.channel === 'email' && d.brokerSlug === owner) ?? null,
      text: mine.find((d) => d.channel === 'text' && d.brokerSlug === owner) ?? null,
    }
    const emailIsAsk = slot.email ? isReviewAskDraft(slot.email) : false
    const textIsAsk = slot.text ? isReviewAskDraft(slot.text) : false
    const askElsewhere = mine.some((d) => d.brokerSlug !== owner && isReviewAskDraft(d))
    out.set(id, {
      person: {
        id,
        firstName: row.first_name,
        name: row.name,
        stage: row.stage,
        tags: Array.isArray(row.tags) ? row.tags : [],
        emails: values(row.emails),
        phones: values(row.phones),
        deleted: row.deleted === true,
      },
      history: {
        draftedAt: drafted.get(id) ?? null,
        askedAt: asked.get(id) ?? null,
        pendingDraft: emailIsAsk || textIsAsk || askElsewhere,
        slotTaken: { email: !!slot.email && !emailIsAsk, text: !!slot.text && !textIsAsk },
      },
      drafts: slot,
    })
  }
  return out
}

/**
 * The full decision for one person: identity and history first, then only the
 * consent reads that can change the answer, through the send-time suppression
 * chokepoint (isSuppressed, fail closed).
 */
export async function decideReviewAskFor(facts: ReviewAskFacts, path: ReviewAskPath): Promise<ReviewAskDecision> {
  const skip = reviewAskPrecheck({ person: facts.person, history: facts.history, path })
  if (skip) return { stage: false, reason: skip }
  const needs = reviewAskConsentNeeds(facts.person)
  const consent: ReviewAskConsent = { emailBlocked: true, smsBlocked: true }
  if (needs.email) consent.emailBlocked = (await isSuppressed(facts.person.id, 'email')).suppressed
  if (consent.emailBlocked && needs.sms) consent.smsBlocked = (await isSuppressed(facts.person.id, 'sms')).suppressed
  return decideReviewAsk({ person: facts.person, history: facts.history, consent, path })
}

export type StageReviewAskResult =
  | { ok: true; action: 'created' | 'already' | 'skipped-existing-draft' }
  | { ok: false; error: string }

/** Record one drafted ask (idempotent on the ledger key). Never sends. */
export async function recordReviewAskLedger(input: {
  personId: number
  ownerSlug: string
  channel: ReviewAskChannel
  ledgerKey: string
  path: ReviewAskPath
  dealId: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await createServiceClient()
    .from('crm_timeline')
    .upsert(
      {
        person_id: input.personId,
        kind: 'system',
        title: 'Google review ask drafted, not sent',
        body:
          input.channel === 'email'
            ? 'The email waits in Drafts. Nothing goes out until it is opened and Send is pressed.'
            : 'The text waits in Drafts. Nothing goes out until it is opened and Send is pressed.',
        payload: { event: 'review_ask_drafted', path: input.path, dealId: input.dealId, channel: input.channel, owner: input.ownerSlug },
        broker: input.ownerSlug,
        source: 'review-ask',
        dedupe_key: input.ledgerKey,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Stage one ask: the draft, then its ledger row. Re-reads the owner's slot
 * first, so a broker who started a draft a moment ago keeps it.
 */
export async function stageReviewAskDraft(input: {
  personId: number
  ownerSlug: string
  channel: ReviewAskChannel
  body: string
  ledgerKey: string
  path: ReviewAskPath
  dealId?: string | null
}): Promise<StageReviewAskResult> {
  if (!Number.isInteger(input.personId) || input.personId <= 0) return { ok: false, error: 'personId is required' }
  if (!input.ownerSlug.trim()) return { ok: false, error: 'a draft owner is required' }
  const ledger = { ...input, dealId: input.dealId ?? null }

  let slot: { email: MessageDraft | null; text: MessageDraft | null }
  try {
    slot = (await getDraftsForPeople([input.personId], input.ownerSlug)).get(input.personId) ?? { email: null, text: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  const current = input.channel === 'email' ? slot.email : slot.text
  if (current) {
    if (!isReviewAskDraft(current)) return { ok: true, action: 'skipped-existing-draft' }
    const wrote = await recordReviewAskLedger(ledger)
    return wrote.ok ? { ok: true, action: 'already' } : wrote
  }

  const draft = await upsertDraft({
    personId: input.personId,
    brokerSlug: input.ownerSlug,
    channel: input.channel,
    subject: input.channel === 'email' ? REVIEW_ASK_SUBJECT : null,
    body: input.body,
  })
  if (!draft.ok) return { ok: false, error: draft.error }
  const wrote = await recordReviewAskLedger(ledger)
  if (!wrote.ok) return { ok: false, error: `draft saved, ledger not written: ${wrote.error}` }
  return { ok: true, action: 'created' }
}

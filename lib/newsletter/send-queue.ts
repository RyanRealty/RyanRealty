import 'server-only'
import { getNewsletter } from '@/lib/data/newsletter'
import { getActiveSubscribersForSend } from '@/lib/data/newsletter'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { isSuppressedByEmail } from '@/lib/crm/suppressions'
import { sendEmail } from '@/lib/resend'
import { attributeOutbound } from '@/lib/crm/attributed-links'
import { wrapNewsletterHtml, newsletterTextFooter } from '@/lib/email-templates/newsletter-shell'
import { htmlToPlainText } from '@/lib/email/prepare'
import {
  anyNewsletterEverSent,
  bumpScheduleSent,
  claimNewsletterForSending,
  claimQueuedBatch,
  finalizeNewsletter,
  finalizeRecipient,
  getAssignedBrokersByPersonId,
  getEngagementSets,
  getSendSchedule,
  getSendingNewsletters,
  getSubscriberSendMeta,
  insertQueuedRecipients,
  isNewsletterPaused,
  recipientStatusCounts,
  releaseNewsletterLock,
  requeueStaleClaims,
  sendWindowHealth,
  setNewsletterPaused,
  writeSendSchedule,
} from '@/lib/data/newsletter/queue'

// ── config ───────────────────────────────────────────────────────────────────

/** Bulk newsletter sends from the ISOLATED news. subdomain (audit A4 — was mail.). */
export const NEWSLETTER_FROM_ADDRESS = 'newsletter@news.ryan-realty.com'
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const KNOWN_BROKERS = new Set(['matt', 'rebecca', 'paul'])
/** Above this recipient count a send is "large" → tranched over days (§6.5). */
export const LARGE_SEND_THRESHOLD = 1000
const DRAIN_BATCH = 100
const DAY_MS = 24 * 60 * 60 * 1000
const STALE_CLAIM_MS = 15 * 60 * 1000 // a row stuck 'sending' >15min = a crashed claim
/** Deliverability circuit-breaker (§6.5 rule 4) — well below Google's 0.3% ceiling. */
const BOUNCE_RATE_MAX = 0.02
const COMPLAINT_RATE_MAX = 0.001
const BREAKER_MIN_SENT = 50 // don't trip on a tiny sample
/** Newsletter links live for 180 days — long enough for a late opener, not forever (T-5). */
const TOKEN_TTL_SECONDS = 180 * DAY_MS / 1000

function normalizeBroker(slug: string | null | undefined): string {
  const s = (slug ?? '').trim().toLowerCase()
  return KNOWN_BROKERS.has(s) ? s : 'matt'
}

function unsubUrl(token: string): string {
  return `${SITE_URL}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`
}

type BrokerIdentity = { slug: string; name: string; email: string | null }

async function loadBrokerMap(): Promise<Map<string, BrokerIdentity>> {
  const brokers = await getCrmBrokers()
  const map = new Map<string, BrokerIdentity>()
  for (const b of brokers) map.set(b.slug, { slug: b.slug, name: b.name, email: b.email })
  return map
}

// ── enqueue (approve) ──────────────────────────────────────────────────────────

export type EnqueueResult =
  | { ok: true; queued: number; brokerSplit: Record<string, number>; large: boolean }
  | { ok: false; error: string }

/**
 * Approve = ENQUEUE (spec §6 step 1). Wins the CAS lock, resolves the audience,
 * freezes each recipient's broker + engagement tier, inserts queued rows, and
 * writes the tranche schedule. The actual sending is the cron drain's job — this
 * returns immediately, so no 5,000-send in-request loop can time out (G-NL-9).
 */
export async function enqueueNewsletter(newsletterId: string): Promise<EnqueueResult> {
  const letter = await getNewsletter(newsletterId)
  if (!letter) return { ok: false, error: 'not_found' }
  if (!letter.body_html && !letter.body_text) return { ok: false, error: 'empty_body' }

  // CAS lock — a second concurrent approve gets null and aborts (S-1).
  const token = await claimNewsletterForSending(newsletterId)
  if (!token) return { ok: false, error: 'already_sending' }

  try {
    const segment = letter.audience?.startsWith('segment:')
      ? (letter.audience.slice('segment:'.length) as 'general' | 'buyer' | 'seller' | 'past-client')
      : undefined
    const audience = await getActiveSubscribersForSend({ segment })
    if (audience.length === 0) {
      await releaseNewsletterLock(newsletterId, 'draft') // S-14: no recipients → stays draft, not falsely sent
      return { ok: false, error: 'no_recipients' }
    }

    // Freeze broker + tier per recipient. Two batch reads, not one-per-subscriber.
    const personIds = audience.map((s) => s.crm_person_id).filter((n): n is number => Number.isFinite(n as number))
    const brokerByPerson = await getAssignedBrokersByPersonId(personIds)
    const { engaged, everSent } = await getEngagementSets()

    const brokerSplit: Record<string, number> = {}
    const rows = audience.map((s) => {
      const broker = normalizeBroker(s.crm_person_id ? brokerByPerson.get(s.crm_person_id) : null)
      const email = s.email.trim().toLowerCase()
      const tier = engaged.has(email) ? 1 : !everSent.has(email) ? 2 : 3
      brokerSplit[broker] = (brokerSplit[broker] ?? 0) + 1
      return { subscriber_id: s.id, email, broker, tier }
    })

    const queued = await insertQueuedRecipients(newsletterId, rows)

    // Tranche schedule (§6.5): small sends go out day 0; large sends tier across days.
    const large = rows.length > LARGE_SEND_THRESHOLD
    const warmup = !(await anyNewsletterEverSent())
    const tierCounts = new Map<number, number>()
    for (const r of rows) tierCounts.set(r.tier, (tierCounts.get(r.tier) ?? 0) + 1)
    await writeSendSchedule(newsletterId, computeSchedule(tierCounts, large, warmup))

    return { ok: true, queued, brokerSplit, large }
  } catch (err) {
    // Roll the lock back so a failed enqueue doesn't strand the newsletter (S-2).
    await releaseNewsletterLock(newsletterId, 'draft')
    return { ok: false, error: err instanceof Error ? err.message : 'enqueue_failed' }
  }
}

/**
 * Build the per-issue tranche plan (§6.5). Small sends: one day-0 row per tier
 * (everything goes immediately). Large sends: Tier 1 (engaged) day 0, Tier 2 (new)
 * days 1-2, Tier 3 (cold) days 3-6; a first-ever large send uses ramped warm-up
 * caps. Pure — unit-testable.
 */
export function computeSchedule(
  tierCounts: Map<number, number>,
  large: boolean,
  warmup: boolean,
): Array<{ day_index: number; tier: number; cap: number }> {
  const out: Array<{ day_index: number; tier: number; cap: number }> = []
  if (!large) {
    for (const [tier, n] of tierCounts) if (n > 0) out.push({ day_index: 0, tier, cap: n })
    return out
  }
  const daysForTier: Record<number, number[]> = { 1: [0], 2: [1, 2], 3: [3, 4, 5, 6] }
  const warmCaps = [500, 1000, 2000, 4000, 8000] // per-day ceiling while warming the domain
  for (const [tier, n] of tierCounts) {
    if (n <= 0) continue
    const days = daysForTier[tier] ?? [0]
    const per = Math.ceil(n / days.length)
    for (const d of days) {
      const cap = warmup && d < warmCaps.length ? Math.min(per, warmCaps[d]) : per
      out.push({ day_index: d, tier, cap })
    }
  }
  return out
}

// ── drain (cron) ─────────────────────────────────────────────────────────────

function breakerTripped(h: { sent: number; bounced: number; complained: number }): boolean {
  if (h.sent < BREAKER_MIN_SENT) return false
  return h.bounced / h.sent > BOUNCE_RATE_MAX || h.complained / h.sent > COMPLAINT_RATE_MAX
}

export type DrainReport = { newsletterId: string; sent: number; skipped: number; failed: number; paused?: boolean; finalized?: string | null }

/** Drain every newsletter currently mid-send. Called by the send cron each tick. */
export async function drainAllSending(nowMs = Date.now()): Promise<DrainReport[]> {
  const sending = await getSendingNewsletters()
  const reports: DrainReport[] = []
  for (const nl of sending) reports.push(await drainNewsletter(nl.id, nl.send_started_at, nowMs))
  return reports
}

/**
 * Drain ONE newsletter: recover crashed claims, check the circuit-breaker, then
 * for each schedule row whose tranche day has arrived and is under its cap, claim
 * a batch atomically and send it — re-checking suppression + active per row (S-8).
 */
export async function drainNewsletter(newsletterId: string, sendStartedAt: string | null, nowMs = Date.now()): Promise<DrainReport> {
  const report: DrainReport = { newsletterId, sent: 0, skipped: 0, failed: 0 }

  if (await isNewsletterPaused(newsletterId)) return { ...report, paused: true }
  await requeueStaleClaims(newsletterId, STALE_CLAIM_MS)

  const health = await sendWindowHealth(newsletterId)
  if (breakerTripped(health)) {
    await setNewsletterPaused(newsletterId, true)
    console.error(
      `[newsletter] CIRCUIT BREAKER tripped for ${newsletterId}: ${health.bounced} bounced / ${health.complained} complained of ${health.sent} sent. Auto-paused. Resume needs admin ok.`,
    )
    return { ...report, paused: true }
  }

  const letter = await getNewsletter(newsletterId)
  if (!letter) return report
  const schedule = (await getSendSchedule(newsletterId)).sort((a, b) => a.day_index - b.day_index || a.tier - b.tier)
  const brokers = await loadBrokerMap()
  const startMs = sendStartedAt ? Date.parse(sendStartedAt) : nowMs
  const currentDay = Math.max(0, Math.floor((nowMs - startMs) / DAY_MS))

  let processedThisRun = 0
  for (const row of schedule) {
    if (row.day_index > currentDay) continue // tranche day not arrived yet
    const remainingInDay = row.cap - row.sent_count
    if (remainingInDay <= 0) continue
    const batchSize = Math.min(remainingInDay, DRAIN_BATCH - processedThisRun)
    if (batchSize <= 0) break

    const claimed = await claimQueuedBatch(newsletterId, row.tier, batchSize)
    if (claimed.length === 0) continue
    const meta = await getSubscriberSendMeta(claimed.map((c) => c.subscriber_id).filter((s): s is string => Boolean(s)))

    let sentInBatch = 0
    for (const c of claimed) {
      const sm = c.subscriber_id ? meta.get(c.subscriber_id) : undefined
      // S-8: unsubscribe DURING the send.
      if (c.subscriber_id && (!sm || sm.status !== 'active')) {
        await finalizeRecipient(c.id, 'skipped', null)
        report.skipped++
        continue
      }
      // Suppression chokepoint, fail-closed (email-keyed covers unlinked subscribers).
      const sup = await isSuppressedByEmail(c.email, 'email')
      if (sup.suppressed) {
        await finalizeRecipient(c.id, 'skipped', null)
        report.skipped++
        continue
      }

      const token = sm?.unsubscribe_token
      if (!token) {
        // No unsubscribe token = can't send a compliant email. Skip, don't fail the batch.
        await finalizeRecipient(c.id, 'skipped', null)
        report.skipped++
        continue
      }
      const rendered = renderForRecipient(letter, c, brokers, token, sm?.crm_person_id ?? null)
      const res = await sendEmail({
        to: c.email,
        from: rendered.from,
        replyTo: rendered.replyTo ?? undefined,
        subject: letter.subject,
        html: rendered.html,
        text: rendered.text,
        headers: { 'List-Unsubscribe': `<${unsubUrl(token)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      })
      await finalizeRecipient(c.id, res.error ? 'failed' : 'sent', res.id ?? null)
      if (res.error) report.failed++
      else {
        report.sent++
        sentInBatch++
      }
    }
    await bumpScheduleSent(newsletterId, row.day_index, row.tier, sentInBatch)
    processedThisRun += claimed.length
    if (processedThisRun >= DRAIN_BATCH) break
  }

  report.finalized = await finalizeNewsletter(newsletterId)
  return report
}

/**
 * Per-recipient render (Phase 3: broker-FROZEN link attribution + From-name/reply
 * swap; Phase 4 adds the per-broker shell visual). The links carry ?agent=<the
 * recipient's frozen broker> and a broker-stamped tracking token — the core fix
 * over the old sender-slug attribution.
 */
export function renderForRecipient(
  letter: { body_html: string | null; body_text: string | null; preview_text: string | null; subject: string; id: string },
  recipient: { email: string; broker: string | null; subscriber_id: string | null },
  brokers: Map<string, BrokerIdentity>,
  unsubscribeToken: string,
  personId: number | null,
): { html: string | undefined; text: string; from: string; replyTo: string | null } {
  const slug = normalizeBroker(recipient.broker)
  const b = brokers.get(slug) ?? brokers.get('matt') ?? { slug: 'matt', name: 'Ryan Realty', email: null }
  const u = unsubUrl(unsubscribeToken)

  const wrapped = letter.body_html
    ? wrapNewsletterHtml({ bodyHtml: letter.body_html, previewText: letter.preview_text, unsubscribeUrl: u })
    : undefined
  // Links carry ?agent=<frozen recipient broker>; when the subscriber is linked to a
  // crm person, opens/clicks are tracked with the broker stamped into the token (§5/H1).
  const html = wrapped
    ? attributeOutbound(wrapped, {
        brokerSlug: slug,
        personId,
        emailKey: `newsletter:${letter.id}`,
        label: letter.subject,
        broker: slug,
        ttlSeconds: TOKEN_TTL_SECONDS,
      })
    : undefined

  const bodyText = letter.body_text?.trim() || htmlToPlainText(letter.body_html ?? '')
  const text = bodyText + newsletterTextFooter(u)
  const from = `${b.name} · Ryan Realty <${NEWSLETTER_FROM_ADDRESS}>`
  return { html, text, from, replyTo: b.email }
}

// ── reconcile (cron) ─────────────────────────────────────────────────────────

export type ReconcileReport = { newsletterId: string; action: 'finalized' | 'stalled' | 'draining'; detail?: string }

/**
 * Reconciler (§6 step 4): a tranched issue legitimately stays 'sending' for days,
 * so we finalize ONLY when no queued/sending rows remain. A STALL is queued rows
 * whose tranche day has already passed but nothing has sent — a real stuck drain,
 * distinct from normal waiting for tomorrow's tranche (S-15).
 */
export async function reconcileSending(nowMs = Date.now()): Promise<ReconcileReport[]> {
  const sending = await getSendingNewsletters()
  const out: ReconcileReport[] = []
  for (const nl of sending) {
    await requeueStaleClaims(nl.id, STALE_CLAIM_MS)
    const finalized = await finalizeNewsletter(nl.id)
    if (finalized) {
      out.push({ newsletterId: nl.id, action: 'finalized', detail: finalized })
      continue
    }
    // Still draining. Is it a stall? Queued rows whose tranche day has passed.
    const counts = await recipientStatusCounts(nl.id)
    const schedule = await getSendSchedule(nl.id)
    const startMs = nl.send_started_at ? Date.parse(nl.send_started_at) : nowMs
    const currentDay = Math.max(0, Math.floor((nowMs - startMs) / DAY_MS))
    const overdue = schedule.some((s) => s.day_index <= currentDay && s.sent_count < s.cap)
    if ((counts.queued ?? 0) > 0 && overdue) {
      out.push({ newsletterId: nl.id, action: 'stalled', detail: `${counts.queued} queued rows past their tranche day` })
      console.error(`[newsletter] STALL: ${nl.id} has ${counts.queued} queued rows past their tranche day but none sent.`)
    } else {
      out.push({ newsletterId: nl.id, action: 'draining', detail: `${counts.queued ?? 0} queued, waiting for the next tranche day` })
    }
  }
  return out
}

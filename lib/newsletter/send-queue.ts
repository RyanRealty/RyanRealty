import 'server-only'
import { getNewsletter } from '@/lib/data/newsletter'
import { getActiveSubscribersForSend } from '@/lib/data/newsletter'
import { normalizeAgentSlug } from '@/lib/agent-attribution'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { isSuppressedByEmail } from '@/lib/crm/suppressions'
import { sendEmail } from '@/lib/resend'
import { attributeOutbound } from '@/lib/crm/attributed-links'
import { wrapNewsletterHtml, newsletterTextFooter, type SenderBroker } from '@/lib/email-templates/newsletter-shell'
import { htmlToPlainText } from '@/lib/email/prepare'
import { getLatestDeliverability, deliverabilityVerdict } from '@/lib/data/deliverability'
import { getDueScheduledNewsletterIds } from '@/lib/data/newsletter/scheduled'
import { editionEmailFiguresCurrent } from '@/lib/data/newsletter/current-issue'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'
import {
  anyNewsletterEverSent,
  bulkActivateSubscribers,
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
  getSubscribersByEmails,
  insertQueuedRecipients,
  isNewsletterPaused,
  recipientStatusCounts,
  releaseNewsletterLock,
  requeueStaleClaims,
  sendWindowHealth,
  setNewsletterPaused,
  writeSendSchedule,
  queuedCountsByTier,
  clearUnsentQueue,
} from '@/lib/data/newsletter/queue'

// ── config ───────────────────────────────────────────────────────────────────

/** Bulk newsletter sends from the ISOLATED news. subdomain (audit A4 — was mail.). */
export const NEWSLETTER_FROM_ADDRESS = 'newsletter@news.ryan-realty.com'
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
/** Above this recipient count a send is "large" → tranched over days (§6.5). */
export const LARGE_SEND_THRESHOLD = 1000
export const ONE_OFF_MAX = 5000 // hard cap on a single one-off blast (matches bulk-enroll)
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
  // Web slugs (paul-stevenson) and short slugs (paul) are the same broker.
  // Anything else is unassigned, and Matt signs.
  return normalizeAgentSlug(slug) ?? 'matt'
}

function unsubUrl(token: string): string {
  return `${SITE_URL}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`
}

/**
 * RFC 8058 one-click POST target (NL-H1). The List-Unsubscribe header points here —
 * the API route that actually processes the opt-out on POST — NOT at the visible RSC
 * page (which has no POST handler and 405s the provider's one-click). The human-facing
 * footer link keeps using unsubUrl (the confirm page).
 */
function oneClickUnsubUrl(token: string): string {
  return `${SITE_URL}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`
}

type BrokerIdentity = { slug: string; name: string; email: string | null; phone: string | null; title: string | null }

/**
 * Absolute-HTTPS headshots (email can't load relative/app assets) — all verified
 * reachable. The transparent .png cutouts are canonical (design system): they drop
 * cleanly onto the navy close card with no white box.
 */
const HEADSHOTS: Record<string, string> = {
  matt: 'https://ryan-realty.com/images/brokers/ryan-matt.png',
  rebecca: 'https://ryan-realty.com/images/brokers/peterson-rebecca.png',
  paul: 'https://ryan-realty.com/images/brokers/stevenson-paul.png',
}

/** Brand-voice phone format: 541.703.3095 (dotted). Returns the input if it can't parse 10 digits. */
function formatPhoneDotted(phone: string | null): string | null {
  if (!phone) return null
  const d = phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}` : phone
}

async function loadBrokerMap(): Promise<Map<string, BrokerIdentity>> {
  const brokers = await getCrmBrokers()
  const map = new Map<string, BrokerIdentity>()
  for (const b of brokers) {
    map.set(b.slug, {
      slug: b.slug,
      name: b.name,
      email: b.email,
      // Never the personal cell. A missing published line prints no number.
      phone: b.publishedPhone,
      title: b.title,
    })
  }
  return map
}

/** Build the per-recipient close identity from a broker (§5/A6). */
function senderBrokerFor(slug: string, brokers: Map<string, BrokerIdentity>): SenderBroker {
  const b = brokers.get(slug) ?? brokers.get('matt') ?? { slug: 'matt', name: 'Matt Ryan', email: null, phone: null, title: null }
  return {
    name: b.name,
    firstName: b.name.split(/\s+/)[0] || b.name,
    title: b.title,
    phone: formatPhoneDotted(b.phone),
    email: b.email,
    headshotUrl: HEADSHOTS[b.slug] ?? HEADSHOTS.matt,
    isOwner: b.slug === 'matt',
  }
}

// ── enqueue (approve) ──────────────────────────────────────────────────────────

export type EnqueueResult =
  | { ok: true; queued: number; brokerSplit: Record<string, number>; large: boolean }
  | { ok: false; error: string }

type HoldLetter = { id: string; created_by: string | null; citations: Array<{ fetched_at?: string }> | null }

/** How an enqueue treats a monthly report email found behind its report. */
export type EnqueueOptions = {
  /**
   * A person clicked send (Send now, a one-off list): have the draft writer
   * (lib/market-report/edition-email-draft.ts) settle the email on the spot.
   * The scheduled-send cron leaves it off and holds the email instead: it
   * retries every 2 minutes, and the writer runs at every publish and each
   * morning anyway.
   */
  settle?: boolean
}

/**
 * Null when the issue may go out. A monthly market report email whose report
 * was rebuilt after it was written never goes out on the earlier figures
 * (CLAUDE.md §0), whoever approved the send ('report_changed'). With `settle`,
 * the draft writer brings it up to its report first: the same printed figures
 * re-stamp it and it goes; new ones replace it with a draft on the current
 * figures ('report_replaced', and Matt is texted the new link); a report
 * taken down, or one the writer could not settle (it texts why), holds it.
 * 'report_check_failed' when the report could not be read.
 */
async function reportEmailHold(letter: HoldLetter, opts: EnqueueOptions): Promise<string | null> {
  try {
    if (await editionEmailFiguresCurrent(letter.created_by, letter.citations?.[0]?.fetched_at ?? null)) return null
    if (!opts.settle) {
      console.warn(`[send-queue] held report email ${letter.id}: its report was rebuilt after it was written`)
      return 'report_changed'
    }
    const { settleEditionEmailFor } = await import('@/lib/market-report/edition-email-draft')
    const outcome = await settleEditionEmailFor(letter.created_by)
    if (outcome?.status === 'replaced') return 'report_replaced'
    // Read it again: re-stamped, it goes; canceled (its report taken down, or
    // no new email could be built), it is no longer a live report email at all.
    const now = await getNewsletter(letter.id)
    if (now && !notSendable(now.status) && (await editionEmailFiguresCurrent(now.created_by, now.citations?.[0]?.fetched_at ?? null))) return null
    console.warn(`[send-queue] held report email ${letter.id}: ${outcome?.status ?? 'not settled'}`)
    return 'report_changed'
  } catch (err) {
    console.error('[send-queue] report email check', err instanceof Error ? err.message : err)
    return 'report_check_failed'
  }
}

/** A send claims only a draft or a scheduled issue; say which it is not. */
function notSendable(status: string): string | null {
  if (status === 'draft' || status === 'scheduled') return null
  return status === 'canceled' ? 'canceled' : status === 'failed' ? 'failed' : 'already_sending'
}

/**
 * Approve = ENQUEUE (spec §6 step 1). Wins the CAS lock, resolves the audience,
 * freezes each recipient's broker + engagement tier, inserts queued rows, and
 * writes the tranche schedule. The actual sending is the cron drain's job — this
 * returns immediately, so no 5,000-send in-request loop can time out (G-NL-9).
 */
export async function enqueueNewsletter(newsletterId: string, opts: EnqueueOptions = {}): Promise<EnqueueResult> {
  const letter = await getNewsletter(newsletterId)
  if (!letter) return { ok: false, error: 'not_found' }
  if (!letter.body_html && !letter.body_text) return { ok: false, error: 'empty_body' }
  const closed = notSendable(letter.status)
  if (closed) return { ok: false, error: closed }
  const hold = await reportEmailHold(letter, opts)
  if (hold) return { ok: false, error: hold }

  // CAS lock — a second concurrent approve gets null and aborts (S-1).
  const token = await claimNewsletterForSending(newsletterId, { listSend: true })
  if (!token) return { ok: false, error: 'already_sending' }

  try {
    // Start from nothing: what a failed earlier enqueue queued is not this one's.
    await clearUnsentQueue(newsletterId)
    const segment = letter.audience?.startsWith('segment:')
      ? (letter.audience.slice('segment:'.length) as 'general' | 'buyer' | 'seller' | 'past-client')
      : undefined
    const audience = await getActiveSubscribersForSend({ segment })
    if (audience.length === 0) {
      await releaseNewsletterLock(newsletterId, 'draft', token) // S-14: no recipients → stays draft, not falsely sent
      return { ok: false, error: 'no_recipients' }
    }

    // Pre-send reputation gate for a LARGE send (§6.5 rule 4 / G-NL-20). Block on a
    // LOW/BAD Gmail reputation or spam rate over the 0.30% ceiling; no Postmaster
    // data yet → 'warmup' (allowed — the tranche schedule ramps caps, never blasts).
    const large = audience.length > LARGE_SEND_THRESHOLD
    if (large) {
      const verdict = deliverabilityVerdict(await getLatestDeliverability())
      if (verdict.action === 'block') {
        await releaseNewsletterLock(newsletterId, 'draft', token)
        return { ok: false, error: `deliverability_block: ${verdict.reason}` }
      }
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
    // `large` was computed above (audience.length) for the reputation gate.
    const warmup = !(await anyNewsletterEverSent())
    const tierCounts = new Map<number, number>()
    for (const r of rows) tierCounts.set(r.tier, (tierCounts.get(r.tier) ?? 0) + 1)
    await writeSendSchedule(newsletterId, computeSchedule(tierCounts, large, warmup))

    return { ok: true, queued, brokerSplit, large }
  } catch (err) {
    // Roll the lock back so a failed enqueue doesn't strand the newsletter (S-2).
    await releaseNewsletterLock(newsletterId, 'draft', token)
    return { ok: false, error: err instanceof Error ? err.message : 'enqueue_failed' }
  }
}

/**
 * ONE-OFF bulk send: enqueue THIS issue to an explicit list of emails (not the
 * recurring subscriber audience). Compliance-critical — it must give every
 * recipient a real subscriber ROW first (that row carries the unsubscribe_token
 * the drain needs to render the one-click unsubscribe rail, required by CAN-SPAM
 * / RFC 8058), then reuse the EXACT enqueue machinery: freeze broker + tier,
 * insert queued rows, write the tranche schedule. The send cron drains these rows
 * through the SAME path — re-checking suppression + active per row and rendering per
 * broker. A one-off is capped at ONE_OFF_MAX and runs the SAME reputation gate +
 * warm-up tranching as a large audience send, so it can't bypass the deliverability
 * / circuit-breaker machinery (it used to: it hard-coded large=false).
 */
export async function enqueueNewsletterToEmails(
  newsletterId: string,
  emails: string[],
  opts: EnqueueOptions = {},
): Promise<{ ok: boolean; queued?: number; error?: string }> {
  const letter = await getNewsletter(newsletterId)
  if (!letter) return { ok: false, error: 'not_found' }
  if (!letter.body_html && !letter.body_text) return { ok: false, error: 'empty_body' }
  const closed = notSendable(letter.status)
  if (closed) return { ok: false, error: closed }

  const deduped = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')))]
  if (deduped.length === 0) return { ok: false, error: 'no_recipients' }
  if (deduped.length > ONE_OFF_MAX) return { ok: false, error: 'too_many_recipients' }
  const list = deduped
  const hold = await reportEmailHold(letter, opts)
  if (hold) return { ok: false, error: hold }

  // CAS lock — a concurrent send/one-off gets null and aborts (S-1).
  const token = await claimNewsletterForSending(newsletterId)
  if (!token) return { ok: false, error: 'already_sending' }

  try {
    // Start from nothing: what a failed earlier enqueue queued is not this one's.
    await clearUnsentQueue(newsletterId)
    // Compliance step (S-10): NEVER resurrect an opt-out. subscribeToNewsletter
    // reactivates any existing row to status='active', so we must exclude every
    // address that previously unsubscribed / bounced / complained BEFORE enrolling.
    // A one-off Matt pastes cannot override a recipient's prior opt-out — re-sending
    // to them is a CAN-SPAM violation. Only brand-new or already-active addresses
    // proceed. (The drain re-checks suppression per row too, but a plain unsubscribe
    // with no suppression row would slip through if we reactivated it here.)
    const preexisting = await getSubscribersByEmails(list)
    const optedOut = new Set(preexisting.filter((s) => s.status !== 'active').map((s) => s.email))
    const eligible = list.filter((e) => !optedOut.has(e))
    if (eligible.length === 0) {
      await releaseNewsletterLock(newsletterId, 'draft', token) // S-14
      return { ok: false, error: 'all_opted_out' }
    }

    // Guarantee a subscriber row per ELIGIBLE recipient BEFORE queueing, so each has
    // an unsubscribe_token. source='one-off' marks how they got on the list. One batch
    // upsert (P1/P2) — not a per-email loop that timed out near the cap. Then read the
    // ids back (filtered to active) to freeze broker + tier.
    await bulkActivateSubscribers(eligible, 'one-off', 'general')
    const subs = (await getSubscribersByEmails(eligible)).filter((s) => s.status === 'active')
    if (subs.length === 0) {
      await releaseNewsletterLock(newsletterId, 'draft', token) // S-14
      return { ok: false, error: 'no_recipients' }
    }

    // H1: a large one-off runs the SAME pre-send reputation gate as the audience send
    // (was skipped entirely). Block on LOW/BAD Gmail reputation or spam over ceiling.
    const large = subs.length > LARGE_SEND_THRESHOLD
    if (large) {
      const verdict = deliverabilityVerdict(await getLatestDeliverability())
      if (verdict.action === 'block') {
        await releaseNewsletterLock(newsletterId, 'draft', token)
        return { ok: false, error: `deliverability_block: ${verdict.reason}` }
      }
    }

    // Freeze broker + tier per recipient — identical logic to enqueueNewsletter.
    const personIds = subs.map((s) => s.crm_person_id).filter((n): n is number => Number.isFinite(n as number))
    const brokerByPerson = await getAssignedBrokersByPersonId(personIds)
    const { engaged, everSent } = await getEngagementSets()

    const rows = subs.map((s) => {
      const broker = normalizeBroker(s.crm_person_id ? brokerByPerson.get(s.crm_person_id) : null)
      const email = s.email.trim().toLowerCase()
      const tier = engaged.has(email) ? 1 : !everSent.has(email) ? 2 : 3
      return { subscriber_id: s.id, email, broker, tier }
    })

    const queued = await insertQueuedRecipients(newsletterId, rows)

    // Small one-off → day-0 (goes immediately). Large one-off → the SAME tranche +
    // warm-up ramp as the audience send, so a big pasted list doesn't blast the domain.
    const warmup = !(await anyNewsletterEverSent())
    const tierCounts = new Map<number, number>()
    for (const r of rows) tierCounts.set(r.tier, (tierCounts.get(r.tier) ?? 0) + 1)
    await writeSendSchedule(newsletterId, computeSchedule(tierCounts, large, warmup))

    return { ok: true, queued }
  } catch (err) {
    await releaseNewsletterLock(newsletterId, 'draft', token) // S-2: don't strand on a failed enqueue
    return { ok: false, error: err instanceof Error ? err.message : 'enqueue_failed' }
  }
}

/**
 * Build the per-issue tranche plan (§6.5). Small sends: one day-0 row per tier
 * (everything goes immediately). Large sends: Tier 1 (engaged) day 0, Tier 2 (new)
 * days 1-2, Tier 3 (cold) days 3-6; a first-ever large send uses ramped warm-up
 * caps, a ceiling per day for the issue. Every queued recipient gets a day:
 * what a ramp day cannot take carries to the days after (the drain claims only
 * against a row's cap, and an issue finalizes only when nothing is queued, so
 * a recipient with no row would hold it at 'sending' forever). Pure —
 * unit-testable.
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
  if (!warmup) {
    for (const [tier, n] of tierCounts) {
      if (n <= 0) continue
      const days = daysForTier[tier] ?? [0]
      const per = Math.ceil(n / days.length)
      for (const d of days) out.push({ day_index: d, tier, cap: per })
    }
    return out
  }
  // Warm-up: each ramp day's ceiling is for the whole issue, every tier on it
  // together (the ramp belongs to the issue: a second large issue sent in the
  // same week has its own). Tiers are laid out in order, engaged first. A tier
  // takes its even share of each of its days; its last day inside the ramp
  // also takes what the capped days before it could not, up to that day's
  // ceiling; and what is left carries to the following days, at most the
  // tier's even share a day past the ramp, as a steady send would. Every
  // queued recipient gets a day. (During a first warm-up nobody is engaged
  // yet, so the first sends go out on day 1.)
  const warmCaps = [500, 1000, 2000, 4000, 8000] // per-day ceiling while warming the domain
  const used = new Map<number, number>()
  const room = (d: number) => (d < warmCaps.length ? warmCaps[d]! - (used.get(d) ?? 0) : Number.POSITIVE_INFINITY)
  const put = (d: number, tier: number, cap: number) => {
    if (cap <= 0) return
    out.push({ day_index: d, tier, cap })
    used.set(d, (used.get(d) ?? 0) + cap)
  }
  for (const tier of [...tierCounts.keys()].sort((a, b) => a - b)) {
    const n = tierCounts.get(tier) ?? 0
    if (n <= 0) continue
    const days = daysForTier[tier] ?? [0]
    const per = Math.ceil(n / days.length)
    let left = n
    days.forEach((d, i) => {
      const absorbs = i === days.length - 1 && d < warmCaps.length
      const cap = Math.min(left, room(d), absorbs ? Number.POSITIVE_INFINITY : per)
      put(d, tier, cap)
      left -= Math.max(cap, 0)
    })
    for (let d = days[days.length - 1]! + 1; left > 0; d++) {
      const cap = Math.min(left, room(d), per)
      put(d, tier, cap)
      left -= Math.max(cap, 0)
    }
  }
  return out
}

// ── scheduled sends (cron) ───────────────────────────────────────────────────

/**
 * Enqueue every newsletter whose scheduled_at has arrived (§4.2 UC-R5). The admin
 * "Schedule" control set status='scheduled'; this promotes each due one via
 * enqueueNewsletter (which CAS-locks scheduled→sending, freezes brokers, writes the
 * queue). Called by the send cron each tick, before the drain.
 */
export async function enqueueDueScheduled(nowMs = Date.now()): Promise<{ enqueued: string[]; skipped: Array<{ id: string; error: string }> }> {
  const ids = await getDueScheduledNewsletterIds(new Date(nowMs).toISOString())
  const enqueued: string[] = []
  const skipped: Array<{ id: string; error: string }> = []
  for (const id of ids) {
    const r = await enqueueNewsletter(id)
    if (r.ok) enqueued.push(id)
    else skipped.push({ id, error: r.error })
  }
  return { enqueued, skipped }
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
    // §6.5 rule 4: auto-pause AND alert Matt (cooldown-deduped SMS rail).
    await queueBrokerHealthAlert({
      key: `newsletter-breaker:${newsletterId}`,
      body: `Newsletter auto-paused: ${health.bounced} bounced / ${health.complained} complained of ${health.sent} sent. Resume at ${SITE_URL}/admin/newsletters/${newsletterId}`,
      cooldownMinutes: 360,
    })
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
        headers: { 'List-Unsubscribe': `<${oneClickUnsubUrl(token)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
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
  const b = brokers.get(slug) ?? brokers.get('matt') ?? { slug: 'matt', name: 'Ryan Realty', email: null, phone: null, title: null }
  const u = unsubUrl(unsubscribeToken)

  const wrapped = letter.body_html
    ? wrapNewsletterHtml({
        bodyHtml: letter.body_html,
        previewText: letter.preview_text,
        unsubscribeUrl: u,
        senderBroker: senderBrokerFor(slug, brokers),
      })
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
    // One issue's failed read never stops the check of the others.
    try {
      await requeueStaleClaims(nl.id, STALE_CLAIM_MS)
      const finalized = await finalizeNewsletter(nl.id, nowMs)
      if (finalized) {
        out.push({ newsletterId: nl.id, action: 'finalized', detail: finalized })
        continue
      }
      // Paused (by Matt, or the deliverability breaker, which texts him itself):
      // waiting on a person, not stalled.
      if (nl.send_paused) {
        out.push({ newsletterId: nl.id, action: 'draining', detail: 'paused' })
        continue
      }
      // Still draining. Is it a stall? A row from a day already over, with room
      // under its cap, while its tier still has someone queued. Today's rows are
      // mid-drain (about 100 a tick), and a skipped or failed recipient never
      // counts toward sent_count, so a row sized to its tier can end below its
      // cap with nobody left to send.
      const counts = await recipientStatusCounts(nl.id)
      const schedule = await getSendSchedule(nl.id)
      const queuedByTier = await queuedCountsByTier(nl.id)
      const startMs = nl.send_started_at ? Date.parse(nl.send_started_at) : nowMs
      const currentDay = Math.max(0, Math.floor((nowMs - startMs) / DAY_MS))
      const overdue = schedule.some((s) => s.day_index < currentDay && s.sent_count < s.cap && (queuedByTier.get(s.tier) ?? 0) > 0)
      if ((counts.queued ?? 0) > 0 && overdue) {
        out.push({ newsletterId: nl.id, action: 'stalled', detail: `${counts.queued} queued rows past their tranche day` })
        console.error(`[newsletter] STALL: ${nl.id} has ${counts.queued} queued rows past their tranche day but none sent.`)
        // S-15: a real stuck drain pages Matt (deduped by cooldown), not just a log line.
        await queueBrokerHealthAlert({
          key: `newsletter-stall:${nl.id}`,
          body: `Newsletter send stalled: ${counts.queued} queued rows past their tranche day. Check ${SITE_URL}/admin/newsletters/${nl.id}`,
          cooldownMinutes: 360,
        })
      } else {
        out.push({ newsletterId: nl.id, action: 'draining', detail: `${counts.queued ?? 0} queued, waiting for the next tranche day` })
      }
    } catch (err) {
      console.error(`[newsletter] reconcile ${nl.id}`, err instanceof Error ? err.message : err)
      out.push({ newsletterId: nl.id, action: 'draining', detail: `check failed: ${err instanceof Error ? err.message : String(err)}` })
    }
  }
  return out
}

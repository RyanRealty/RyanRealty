/**
 * CMA delivery rail — the ONLY way a built CMA reaches a lead.
 *
 * One explicit, button-triggered path (never automatic):
 *   sendCmaToLead() — a real CRM send from the signing broker's own mailbox
 *   (Gmail DWD, same transport as the CRM composer), PDF attached,
 *   open/click instrumented, suppression checked (fails closed), and logged
 *   as email_out on the contact's CRM timeline. Replies thread straight back
 *   into the broker's inbox (and the CRM via mailbox sync).
 *
 *   If the Gmail DWD send fails (auth/scope/outage), the send automatically
 *   falls back to Resend so the lead still gets the CMA — the timeline row
 *   records which transport carried it. A send Gmail never confirmed does not
 *   fall back: it may already be delivered, so the broker checks Sent first.
 *
 * Requires the cmas row to be finalized (Matt approved the draft).
 * The Gmail-DRAFT path was retired 2026-07-07 per Matt's directive: sends go
 * out through the CRM, not through a manual Gmail draft review.
 *
 * The owner's slot (2026-09-29): when the recipient is an expired or FSBO owner
 * we track as a prospect, the send claims that owner's row, stamps it when the
 * email leaves, and refuses a second first contact. Before this, "Send now"
 * emailed six owners and left every prospect row reading "never emailed". See
 * lib/cma/prospect-send-claim.ts for the sequence and why it lives in the rail.
 */

import {
  getCmaAdminRowBySlug,
  getCmaBrokerBySlugOrEmail,
  getCmaProspectAsk,
  updateCmaRowFieldsBySlug,
  findCrmPersonIdByEmail,
  stampCmaLinkOnPerson,
  stampCmaPersonId,
  logCmaTimelineEvent,
} from '@/lib/data'
import { ensureNativeLead } from '@/lib/data/crm/ensureNativeLead'
import { CMA_DOC_ORIGIN } from '@/lib/cma/doc-links'
import { wrapBrandedEmail, brandedTextFooter } from '@/lib/email/shell'
import { brokerSendIdentity } from '@/lib/email/broker-identity'
import { attributeOutbound } from '@/lib/crm/attributed-links'
import { isSuppressed } from '@/lib/crm/suppressions'
import { CRM_BROKER_BY_EMAIL } from '@/lib/crm/constants'
import { sendEmail } from '@/lib/resend'
import { sendGmailMessage } from '@/lib/gmail-draft'
import { composeCmaFirstContact, type CmaFirstContactFacts } from '@/lib/cma/first-contact'
import { acquireCmaProspectLease, type CmaProspectLease } from '@/lib/cma/prospect-send-claim'
import { cmaFirstContactFactsForSend, cmaSendBrokerSlug } from '@/lib/cma/first-contact-for-send'
import { paragraphsForLetterBody, paragraphsToPlain, renderCmaLetterBlock } from '@/lib/cma/first-contact-render'
import { screenAddressForSolicitation } from '@/lib/cma/solicit-screen'
import { buildSignature } from '@/lib/crm/email-signature'
import { getBrokers } from '@/lib/data'
import { previewTextFromCustomBody } from '@/lib/cma/report-button'
import { classifyCmaOrigin, type CmaOrigin } from '@/lib/cma/origin'
import { resolveTheirPrice } from '@/lib/cma/queue-view'
import { formatPublishedPhone } from '@/lib/cma/format-phone'

/**
 * The letter's own origin is the PRODUCTION origin, never the env host — the
 * same rule lib/cma/doc-links.ts and lib/cma/cma-place-links.ts already follow,
 * and for the same reason: these URLs land in a stranger's inbox and outlive
 * every deploy. It is also correctness, not just hygiene: `attributeOutbound`
 * only attributes ryan-realty.com links, so a report button built on the
 * staging host loses its `?_pid=` and the recipient meets the consent bar
 * instead of the report they were sent (caught on the 2026-09-09 send walk,
 * where a worktree with the vercel host in .env.local mailed an unattributed
 * report link).
 */
const SITE_URL = CMA_DOC_ORIGIN
const MAX_PDF_BYTES = 25 * 1024 * 1024

export interface CmaSendContext {
  slug: string
  subjectAddress: string
  /** MLS ListingKey for this CMA. Null when the row has none. */
  subjectListingKey: string | null
  clientName: string | null
  clientEmail: string
  brokerRow: {
    slug: string
    displayName: string
    title: string
    email: string | null
    phone: string | null
    photoUrl: string | null
  }
  valueLow: number | null
  valueHigh: number | null
  recommendedList: number | null
  lastListPrice: number | null
  /** Decides the opening only. The pricing is identical across origins. */
  origin: CmaOrigin
  facts: CmaFirstContactFacts
}

async function resolveSendContext(
  slug: string,
): Promise<{ ctx: CmaSendContext | null; error: string | null }> {
  const row = await getCmaAdminRowBySlug(slug)
  if (!row) return { ctx: null, error: 'CMA not found' }
  const status = String(row.status ?? '')
  if (status !== 'finalized' && status !== 'delivered') {
    return { ctx: null, error: `This CMA is not approved yet (status ${status}). Approve it before sending.` }
  }
  const clientEmail = (row.client_email as string | null)?.trim().toLowerCase() ?? null
  if (!clientEmail) {
    return { ctx: null, error: 'This CMA has no client email on file. Add one on the review page first.' }
  }
  const brokerSlug = (row.broker_slug as string | null) ?? null
  const brokerRaw = await getCmaBrokerBySlugOrEmail({ slug: brokerSlug })
  const brokerRow = {
    slug: (brokerRaw?.slug as string) ?? 'matthew-ryan',
    displayName: (brokerRaw?.display_name as string) ?? 'Matt Ryan',
    title: (brokerRaw?.title as string) ?? 'Owner & Principal Broker',
    email: (brokerRaw?.email as string | null) ?? 'matt@ryan-realty.com',
    phone: formatPublishedPhone((brokerRaw?.twilio_number as string | null) ?? null),
    photoUrl: (brokerRaw?.photo_url as string | null) ?? null,
  }
  const origin = classifyCmaOrigin(
    (row.request_source as string | null) ?? null,
    (row.doc_type as string | null) ?? null,
  )
  const lastListPrice = resolveTheirPrice(
    origin,
    row.build_summary,
    await getCmaProspectAsk(String(row.id)),
  )
  const clientName = (row.client_name as string | null) ?? null
  const facts = await cmaFirstContactFactsForSend(row as Record<string, unknown>, {
    brokerName: brokerRow.displayName,
    lastListPrice,
    brokerSlug: cmaSendBrokerSlug(brokerRow.email),
  })
  return {
    ctx: {
      slug,
      subjectAddress: (row.subject_address as string) ?? slug,
      subjectListingKey: (row.subject_listing_key as string | null) ?? null,
      clientName,
      clientEmail,
      brokerRow,
      valueLow: (row.value_low as number | null) ?? null,
      valueHigh: (row.value_high as number | null) ?? null,
      recommendedList: (row.recommended_list as number | null) ?? null,
      origin,
      lastListPrice,
      facts,
    },
    error: null,
  }
}

/** Broker-composed override for the lead email (dashboard compose dialog).
 *  The report button, PDF attachment, branded shell, and signature stay —
 *  the override replaces the message paragraphs and optionally the subject. */
export interface CmaSendOverride {
  subject?: string | null
  bodyText?: string | null
}

function inboundFacts(ctx: CmaSendContext): CmaFirstContactFacts {
  return ctx.facts
}

/**
 * Turn the bare URLs the first-contact copy writes into links.
 *
 * TRAILING PUNCTUATION IS NOT PART OF THE URL. The copy puts URLs at the end of
 * sentences ("Reviews are at https://ryan-realty.com/reviews."), and the greedy
 * `[^\s<]+` match used to swallow the full stop — so every cold-origin CMA email
 * shipped with `href=".../reviews."` and `href=".../about."`, two 404s per send,
 * caught on the 2026-09-07 instrumentation audit by decoding the click tokens in
 * a delivered message. The punctuation is put back OUTSIDE the anchor so the
 * sentence still reads correctly.
 */
export function linkifyHttp(html: string): string {
  return html.replace(/https:\/\/[^\s<]+/g, (url) => {
    const trailing = url.match(/[.,;:!?]+$/)?.[0] ?? ''
    const clean = trailing ? url.slice(0, -trailing.length) : url
    return `<a href="${clean}">${clean}</a>${trailing}`
  })
}

/**
 * The broker's own signature, from the system (Matt 2026-09-09: "we will always
 * use my signature from the system"). Gmail-synced wins, then the signature they
 * saved in Settings, then the generated identity block — and every variant
 * carries the Oregon agency-pamphlet line, so the letter is compliant by
 * construction. Null only when the broker row cannot be read; the letter then
 * ships with the branded footer alone rather than a made-up sign-off.
 */
async function signatureFor(email: string | null): Promise<{ html: string; plain: string } | null> {
  const mailbox = (email ?? '').trim().toLowerCase()
  if (!mailbox) return null
  try {
    const brokers = await getBrokers()
    const broker = brokers.find((b) => (b.email ?? '').toLowerCase() === mailbox)
    return broker ? buildSignature(broker) : null
  } catch {
    return null
  }
}

export function buildLeadBody(
  ctx: CmaSendContext,
  override?: CmaSendOverride,
  signature?: { html: string; plain: string } | null,
): { html: string; text: string; subject: string } {
  const copy = composeCmaFirstContact(ctx.origin, inboundFacts(ctx))
  const subject = override?.subject?.trim() || copy.subject
  const raw = override?.bodyText?.trim() ?? ''
  const paragraphs = paragraphsForLetterBody({
    bodyText: raw || copy.bodyText,
    canonicalPlain: copy.bodyText,
    canonicalMarkers: copy.bodyMarkers,
    paragraphs: copy.paragraphs,
  })
  const letterPlain = paragraphsToPlain(paragraphs)
  const uneditedBody = !raw || raw === copy.bodyText.trim() || raw === copy.bodyMarkers.trim()
  const block = renderCmaLetterBlock({
    paragraphs,
    address: ctx.subjectAddress,
    slug: ctx.slug,
  })
  const bodyHtml = `
<div style="padding:32px 34px 8px;">
  ${block}
  ${signature?.html ?? ''}
</div>`
  const text = `${letterPlain}
${signature?.plain ?? ''}${brandedTextFooter()}`
  const html = wrapBrandedEmail({
    bodyHtml,
    previewText: uneditedBody ? copy.previewText : previewTextFromCustomBody(raw, copy.previewText),
    mastheadLine: copy.mastheadLine,
    heroUrl: null,
    // One close: the broker's own signature, appended above. The navy
    // "talk to" card would be a second sign-off under it (Matt 2026-09-09).
    senderBroker: null,
    unsubscribeUrl: null,
    audienceLine: null,
  })
  return { html, text, subject }
}

export interface SendCmaToLeadResult {
  ok: boolean
  error?: string
  /** Which rail carried the email: the broker's own mailbox, or the Resend fallback. */
  transport?: 'gmail' | 'resend'
  /** The broker mailbox the email went out from (gmail transport only). */
  mailbox?: string | null
  gmailMessageId?: string
  resendId?: string
  personId?: number | null
}

export interface SendCmaToLeadOptions {
  /**
   * The caller already holds the owner's email claim on the prospect row and will
   * stamp and finalize it itself. Set only by sendProspectingEmailIntro, which
   * claims under its own idempotency key before its guard chain and calls this
   * rail inside that claim. The rail then leaves the owner's row alone: a second
   * claim on the same row comes back `claimed_elsewhere` and would refuse the
   * caller's own send. No other caller may set it; lib/cma/prospect-send-claim.test.ts
   * holds the list.
   */
  callerHoldsProspectClaim?: boolean
}

/**
 * CRM send to the lead — from the signing broker's own mailbox (Gmail DWD),
 * with Resend as automatic fallback. Explicit-click only — never automatic.
 */
/** The default compose message (the link, signature, and footer append at send). */
function defaultComposeText(ctx: CmaSendContext): string {
  return composeCmaFirstContact(ctx.origin, inboundFacts(ctx)).bodyText
}

/**
 * Compose-dialog prefill: the default subject + message text (sans footer) and
 * the doc facts, so the broker edits from a working baseline. Read-only.
 */
export async function prepareCmaSendPreview(slug: string): Promise<
  | { ok: true; subject: string; bodyText: string; docUrl: string; clientEmail: string | null; clientName: string | null; subjectAddress: string }
  | { ok: false; error: string }
> {
  const { ctx, error } = await resolveSendContext(slug)
  if (!ctx) {
    // A draft is still previewable — the send itself finalizes first. Re-read
    // without the status gate for prefill purposes only.
    const row = await getCmaAdminRowBySlug(slug)
    if (!row) return { ok: false, error: error ?? 'Document not found' }
    // Archived is a terminal, hidden-from-the-rail state (mirrors
    // prepareBpoSendPreview's archived_at gate) — the dialog must never open
    // fully-prefilled-and-sendable only to have sendCmaToLead reject it with a
    // confusing "not approved yet" error. Block it here, at prepare time.
    if (String(row.status ?? '') === 'archived') {
      return { ok: false, error: 'This CMA is archived. Restore it before sending.' }
    }
    const brokerRaw = await getCmaBrokerBySlugOrEmail({ slug: (row.broker_slug as string | null) ?? null })
    const origin = classifyCmaOrigin(
      (row.request_source as string | null) ?? null,
      (row.doc_type as string | null) ?? null,
    )
    const lastListPrice = resolveTheirPrice(
      origin,
      row.build_summary,
      await getCmaProspectAsk(String(row.id)),
    )
    const brokerRow = {
      slug: (brokerRaw?.slug as string) ?? 'matthew-ryan',
      displayName: (brokerRaw?.display_name as string) ?? 'Matt Ryan',
      title: (brokerRaw?.title as string) ?? 'Owner & Principal Broker',
      email: (brokerRaw?.email as string | null) ?? 'matt@ryan-realty.com',
      phone: formatPublishedPhone((brokerRaw?.twilio_number as string | null) ?? null),
      photoUrl: (brokerRaw?.photo_url as string | null) ?? null,
    }
    const clientName = (row.client_name as string | null) ?? null
    const fakeCtx: CmaSendContext = {
      slug,
      subjectAddress: (row.subject_address as string) ?? slug,
      subjectListingKey: (row.subject_listing_key as string | null) ?? null,
      clientName,
      clientEmail: ((row.client_email as string | null) ?? '').trim().toLowerCase() || 'pending@placeholder',
      brokerRow,
      valueLow: (row.value_low as number | null) ?? null,
      valueHigh: (row.value_high as number | null) ?? null,
      recommendedList: (row.recommended_list as number | null) ?? null,
      origin,
      lastListPrice,
      facts: await cmaFirstContactFactsForSend(row as Record<string, unknown>, {
        brokerName: brokerRow.displayName,
        lastListPrice,
        brokerSlug: cmaSendBrokerSlug(brokerRow.email),
      }),
    }
    const body = buildLeadBody(fakeCtx)
    return {
      ok: true,
      subject: body.subject,
      bodyText: defaultComposeText(fakeCtx),
      docUrl: `${SITE_URL}/cma/${slug}`,
      clientEmail: ((row.client_email as string | null) ?? '').trim().toLowerCase() || null,
      clientName: (row.client_name as string | null) ?? null,
      subjectAddress: (row.subject_address as string) ?? slug,
    }
  }
  const body = buildLeadBody(ctx)
  return {
    ok: true,
    subject: body.subject,
    bodyText: defaultComposeText(ctx),
    docUrl: `${SITE_URL}/cma/${ctx.slug}`,
    clientEmail: ctx.clientEmail,
    clientName: ctx.clientName,
    subjectAddress: ctx.subjectAddress,
  }
}

/**
 * Send the stored CMA to its client. Every caller comes through here, so this is
 * where the guards live: solicitation screen, CRM contact, suppression, and the
 * owner's email slot (lib/cma/prospect-send-claim.ts). When the recipient is an
 * owner we track as a prospect, the send claims that owner's row before the PDF
 * renders and refuses on anything but a clean claim, stamps the provider id the
 * moment a rail takes the message, and finalizes after the delivered stamp. A
 * send that fails before anything leaves releases the claim.
 */
export async function sendCmaToLead(
  slug: string,
  override?: CmaSendOverride,
  options?: SendCmaToLeadOptions,
): Promise<SendCmaToLeadResult> {
  const { ctx, error } = await resolveSendContext(slug)
  if (!ctx) return { ok: false, error: error ?? 'CMA not sendable' }

  // SOLICITATION CHOKEPOINT, ahead of everything else (Matt 2026-09-09). A
  // for-sale-by-owner who has since listed with a broker, an expired owner who
  // relisted, and one whose home sold after it came off the market are all
  // off limits — the first two because the listing is someone else's, the
  // third because writing to them says we do not know the market. Fails
  // closed: an unreadable MLS blocks the send.
  if (ctx.origin === 'expired' || ctx.origin === 'fsbo') {
    const screen = await screenAddressForSolicitation({
      address: ctx.subjectAddress,
      city: ctx.facts.city ?? null,
      sinceIso: null,
      // Without the subject's own listing, "Lot 33" on the only row at the
      // address looks like an unknown unit and the screen refuses the send.
      subjectListingKey: ctx.subjectListingKey ?? null,
    })
    if (!screen.ok) {
      return { ok: false, error: `Not sent. ${screen.detail}` }
    }
  }

  // A send without a CRM contact is untracked (no pixel, no signed links, no
  // timeline). Find or create the contact the same way the drip does, then
  // fail closed if we still have no person.
  let personId = await findCrmPersonIdByEmail(ctx.clientEmail)
  const crmBrokerSlug = CRM_BROKER_BY_EMAIL[(ctx.brokerRow.email ?? '').toLowerCase()] ?? 'matt'
  if (!personId) {
    const lead = await ensureNativeLead({
      name: ctx.clientName,
      email: ctx.clientEmail,
      source: ctx.origin === 'expired' ? 'expired-outreach-queue' : ctx.origin === 'fsbo' ? 'fsbo-outreach' : 'cma-send',
      tags: [
        'audience:seller',
        ctx.origin === 'expired' ? 'intent:expired-listing' : ctx.origin === 'fsbo' ? 'intent:fsbo' : 'source:cma-send',
        ctx.origin === 'expired' ? 'source:expired-outreach-queue' : ctx.origin === 'fsbo' ? 'source:fsbo-outreach' : 'source:cma-send',
      ],
      assignedBroker: crmBrokerSlug,
    })
    personId = lead.personId > 0 ? lead.personId : null
  }
  if (!personId) {
    return {
      ok: false,
      error: 'Could not create a CRM contact for this email. The CMA was not sent — it would have gone out untracked.',
    }
  }
  // Persist before the PDF renders. The create path already stamped; an
  // existing CRM contact used to skip this, so the letter shipped without
  // `_pid`. A failed write must stop the send — logging and continuing is
  // how an untracked PDF left the shop.
  const stamped = await stampCmaPersonId(slug, personId)
  if (!stamped || stamped.ok !== true) {
    return {
      ok: false,
      error:
        stamped && stamped.ok === false
          ? `Could not save the contact on this CMA (${stamped.error}). The CMA was not sent — it would have gone out untracked.`
          : 'Could not save the contact on this CMA. The CMA was not sent — it would have gone out untracked.',
    }
  }
  ctx.facts.personId = personId

  // Suppression chokepoint (fails closed).
  const sup = await isSuppressed(personId, 'email')
  if (sup.suppressed) {
    return { ok: false, error: `This contact has opted out of email (${sup.reasons.join(', ')}).` }
  }

  // THE OWNER'S SLOT, before the PDF renders and after every refusal above.
  // If this recipient is an owner we track as a prospect (expired or FSBO, by
  // the build's link or, for a second CMA on the same house, by the MLS key),
  // claim that owner's email slot now. Anything but a clean claim refuses and
  // nothing leaves. Internal recipients, CMAs with no prospect row, and a
  // caller that already holds the claim get a no-op lease and send as before.
  // The finally settles it: released if nothing left, finalized if a rail took it.
  const acquired = await acquireCmaProspectLease({
    slug,
    recipientEmail: ctx.clientEmail,
    personId,
    origin: ctx.origin,
    callerHoldsClaim: options?.callerHoldsProspectClaim === true,
  })
  if (!acquired.ok) return { ok: false, error: acquired.error }
  const lease = acquired.lease
  try {
    return await deliverCmaToLead(ctx, { personId, crmBrokerSlug, override, lease })
  } finally {
    await lease.settle()
  }
}

/**
 * Everything from the PDF render to the delivered stamp, run inside the owner's
 * lease. A return before a rail is handed the message leaves the lease at its
 * default (pre-send), so the caller's finally releases the claim. From the
 * moment a rail is handed it the lease is in flight and the claim stays through
 * anything (Gmail never answering, a thrown error) unless every rail refuses for
 * certain. A rail taking the message marks it accepted the instant it returns,
 * which stamps the provider id on the owner's row before any other bookkeeping
 * can throw.
 */
async function deliverCmaToLead(
  ctx: CmaSendContext,
  args: {
    personId: number
    crmBrokerSlug: string
    override: CmaSendOverride | undefined
    lease: CmaProspectLease
  },
): Promise<SendCmaToLeadResult> {
  const { slug } = ctx
  const { personId, crmBrokerSlug, override, lease } = args

  // PDF. Dynamic import keeps puppeteer-core off admin page lambdas (NFT excludes it).
  let pdf: Buffer
  const cmaPdf = await import('@/lib/cma-pdf')
  try {
    const rendered = await cmaPdf.renderCmaPdfBuffer(slug)
    pdf = rendered.buffer
  } catch (e) {
    if (e instanceof cmaPdf.CmaNotFoundError) return { ok: false, error: 'CMA document not found for PDF render' }
    return { ok: false, error: `PDF render failed: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (pdf.byteLength > MAX_PDF_BYTES) {
    return { ok: false, error: 'The rendered PDF exceeds the 25 MB attachment cap.' }
  }

  // Suppression once more, right before the wire. The gate in sendCmaToLead ran
  // ahead of a PDF render that can take a while, and an opt-out that lands in
  // that window must still stop this email (the weekday drip re-checks before
  // its own send for the same reason). It is also what keeps this function, the
  // one that reaches the Resend rail below, carrying its own isSuppressed check,
  // which is the invariant ci:email-send-gated holds every sender to. Fails
  // closed; nothing has left, so the lease hands the owner's claim back.
  const supNow = await isSuppressed(personId, 'email')
  if (supNow.suppressed) {
    return { ok: false, error: `This contact has opted out of email (${supNow.reasons.join(', ')}).` }
  }

  const body = buildLeadBody(ctx, override, await signatureFor(ctx.brokerRow.email))
  const emailKey = `cma:${slug}`
  const trackedHtml = attributeOutbound(body.html, {
    brokerSlug: crmBrokerSlug,
    personId: personId ?? undefined,
    emailKey,
    label: body.subject,
    // Stamps the broker INTO the signed tracking token, so the open/click rows
    // this send produces carry `broker` instead of null. Without it every CMA
    // open and click landed unattributed in email_events and crm_timeline, and
    // per-broker engagement could not see them.
    broker: crmBrokerSlug,
  })

  // Primary rail: the signing broker's real mailbox (same DWD transport the
  // CRM composer uses). The lead gets a 1:1 email from matt@ryan-realty.com
  // (or the signing broker), and a reply threads straight back into the
  // broker's inbox — where the CRM mailbox sync picks it up.
  const brokerMailbox =
    ctx.brokerRow.email && /@ryan-realty\.com$/i.test(ctx.brokerRow.email)
      ? ctx.brokerRow.email
      : 'matt@ryan-realty.com'
  // From here a rail holds the message. Until a rail refuses for certain, any
  // exit, a thrown error included, keeps the owner's claim: the email may be out.
  lease.markSending()
  const gmailRes = await sendGmailMessage({
    to: ctx.clientEmail,
    subject: body.subject,
    bodyHtml: trackedHtml,
    bodyText: body.text,
    impersonateAs: brokerMailbox,
    attachments: [{ filename: `${slug}.pdf`, content: pdf, mimeType: 'application/pdf' }],
  })
  if (gmailRes.unconfirmed) {
    // The send left and Gmail never answered: the lead may already have the CMA.
    // Resend now could deliver it twice, so stop and let the broker check Sent.
    // The owner's claim is NOT released: the email may be out.
    console.error(`[sendCmaToLead] ${slug}: ${gmailRes.error} Not falling back to Resend.`)
    return { ok: false, error: gmailRes.error }
  }
  const transport: 'gmail' | 'resend' = gmailRes.ok ? 'gmail' : 'resend'
  const gmailMessageId = gmailRes.ok ? gmailRes.messageId : undefined
  const gmailThreadId = gmailRes.ok ? gmailRes.threadId : undefined
  const rfcMessageId = gmailRes.ok ? gmailRes.rfcMessageId : undefined
  if (!gmailRes.ok) {
    // Fallback rail: Resend. The lead still gets the CMA; the timeline row
    // records the degraded transport so the outage is visible.
    console.error(`[sendCmaToLead] Gmail send from ${brokerMailbox} failed (${gmailRes.error ?? 'unknown'}); falling back to Resend`)
  }
  // The suppression re-check above covers this fallback too — same function scope.
  // Named broker from (never the bare noreply@ default) so the fallback rail
  // matches the Gmail rail's identity — the lead sees the same sender either way.
  const fallbackIdentity = brokerSendIdentity(ctx.brokerRow.email)
  const fallback = gmailRes.ok ? null : await sendEmail({
    to: ctx.clientEmail,
    from: fallbackIdentity.from,
    subject: body.subject,
    html: trackedHtml,
    text: body.text,
    replyTo: ctx.brokerRow.email ?? 'matt@ryan-realty.com',
    attachments: [{ filename: `${slug}.pdf`, content: pdf }],
  })
  if (fallback?.error) {
    // Both rails refused: nothing left, so the owner's claim goes back.
    lease.markNotSent()
    return { ok: false, error: `Email send failed on both rails (Gmail: ${gmailRes.ok ? '' : gmailRes.error ?? 'unknown'}; Resend: ${fallback.error})` }
  }
  const resendId = fallback?.id

  // A rail took the message: it is out. Stamp the provider id on the owner's row
  // now, ahead of every other write below that could throw. A message-id-bearing
  // row reads as already sent, so nothing after this can lead to a second email.
  await lease.markAccepted({ messageId: gmailMessageId ?? resendId ?? null })

  const sentAt = new Date().toISOString()

  // The `sent` row in the unified email_events store — the anchor every other
  // event on this send hangs off.
  //
  // WHY IT MATTERS, not bookkeeping: Resend's delivered / bounced / complained /
  // unsubscribed webhook knows the provider message id and the recipient, and
  // NOTHING about `cma:<slug>`. recordEmailEvent backfills the key by looking up
  // the `sent` row for that message id (getSentEventByMessageId). With no `sent`
  // row this send had none to find, so every CMA bounce landed with
  // email_key = null / send_type = 'other' and could never be attributed to the
  // document that caused it. A bounce that cannot be traced to a CMA is a send
  // the queue reports as delivered when it was not (§0).
  //
  // Non-blocking on purpose: the email is already gone. A reporting-side failure
  // must never turn a completed send into an error the broker sees.
  try {
    const { recordEmailEvent } = await import('@/lib/crm/email-events')
    const rec = await recordEmailEvent({
      messageId: gmailMessageId ?? resendId ?? null,
      recipientEmail: ctx.clientEmail,
      personId,
      broker: crmBrokerSlug,
      sendType: 'cma',
      event: 'sent',
      emailKey,
      subject: body.subject,
      occurredAt: sentAt,
      meta: {
        transport,
        slug,
        docType: 'cma',
        ...(gmailThreadId ? { gmailThreadId } : {}),
        ...(rfcMessageId ? { rfcMessageId } : {}),
      },
    })
    if (!rec.ok) console.warn('[sendCmaToLead] email_events sent row failed:', rec.error)
  } catch (e) {
    console.warn('[sendCmaToLead] email_events sent row threw:', e instanceof Error ? e.message : e)
  }

  await updateCmaRowFieldsBySlug(slug, { status: 'delivered', delivered_at: sentAt })
  if (personId) {
    await stampCmaLinkOnPerson(personId, { cmaLink: `${SITE_URL}/cma/${slug}`, cmaSlug: slug })
    await logCmaTimelineEvent(personId, {
      kind: 'email_out',
      title: body.subject,
      body: `CMA sent to ${ctx.clientEmail} for ${ctx.subjectAddress}.`,
      broker: crmBrokerSlug,
      // Unique per send (full ISO timestamp, not the send DATE) so a legitimate
      // re-send is always logged as its own timeline row. A date-keyed dedupe
      // silently swallowed the second same-day send, hiding a real delivery.
      dedupeKey: `cma:sent:${slug}:${sentAt}`,
      payload: { artifact: 'cma', slug, transport, mailbox: transport === 'gmail' ? brokerMailbox : null, gmailMessageId: gmailMessageId ?? null, resendId: resendId ?? null },
    })
  }
  return { ok: true, transport, mailbox: transport === 'gmail' ? brokerMailbox : null, gmailMessageId, resendId, personId }
}

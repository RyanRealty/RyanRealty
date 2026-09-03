'use server'
import { revalidatePerson } from '@/lib/crm/revalidate-person'

/**
 * Prospecting hub actions (spec 07 §5) — the ONE reconciled cold-intro path over
 * both prospect kinds (expired listings + FSBOs), plus build/approve/prepare/test
 * helpers for the /admin/prospecting worklist + send dialog.
 *
 * `sendProspectingIntro` collapses the two legacy SMS pipelines
 * (app/actions/expired-outreach.ts `sendExpiredIntroAction` + app/actions/send-doc.ts
 * `sendDocSmsAction`) into one action with a superset, deduped, fail-closed guard
 * chain and the at-most-once claim/finalize/release trio (spec §4.5). Every guard
 * re-runs live at send time; the cold intro is the ONLY cold-SMS path.
 *
 * Draft-first: a real intro to a real owner is an explicit admin click. The build
 * link sits next to the button so the broker reviews the audit first; the texted
 * link must be a CLIENT-READY (finalized/delivered) document or the send refuses.
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { createServiceClient } from '@/lib/supabase/service'
import { getProspect, getProspectDetail, updateCmaRowFieldsBySlug } from '@/lib/data'
import { verifyNotRelisted } from '@/lib/data/prospecting/batch'
import { resolveDripSequenceForKind } from '@/lib/data/prospecting/drip'
import {
  claimProspectSend,
  finalizeProspectSend,
  releaseProspectSend,
  stampProspectSid,
  linkProspectCma,
  claimProspectEmailSend,
  finalizeProspectEmailSend,
  releaseProspectEmailSend,
  stampProspectEmailMessageId,
} from '@/lib/data/prospecting/send-claim'
import {
  introTemplateKeyFor,
  expectedDocTypeFor,
  hasSendableEmail,
  type ProspectKind,
  type SendIntroResult,
  type SendEmailIntroResult,
} from '@/lib/data/prospecting/types'
import { slugifyAddress } from '@/lib/cma/address-slug'
import {
  getLatestClientReadyCmaRowForBaseSlug,
  resolveWritableCmaSlot,
} from '@/lib/cma/versions'
import { buildCma } from '@/lib/cma/build'
import { prepareCmaSendPreview, sendCmaToLead } from '@/lib/cma/send'
import { ensureNativeLead, enrichNativeLead } from '@/lib/data/crm/ensureNativeLead'
import { isSuppressed, isSuppressedByPhone, isSuppressedByEmail } from '@/lib/crm/suppressions'
import { inSmsQuietHours } from '@/lib/crm/quiet-hours'
import { renderCrmMerge, findUnresolvedMergeTokens, type MergePersonLike } from '@/lib/crm/merge'
import { buildMergeContext } from '@/lib/crm/merge-context'
import {
  buildFirstTouchSms,
  firstTouchFactsFromProspect,
  formatFirstTouchUsd,
  isCanonicalFirstTouchBody,
} from '@/lib/crm/first-touch-copy'
import { sendSmsViaMessagingService, toE164 } from '@/lib/crm/twilio'
import { sendTemplateSelfTestAction } from '@/app/actions/crm-template-test'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

async function requireAdmin(): Promise<boolean> {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  return Boolean(role && role.role !== 'report_viewer')
}

async function composeProspectFirstTouch(args: {
  kind: ProspectKind
  prospect: { id: string; streetAddress: string | null; listPrice: number | null; listedAt: string | null; expiredAt: string | null }
  senderFirstName: string | null
  cmaLink: string | null
  templateBody: string | null
  personLike: MergePersonLike
  ctx: Parameters<typeof renderCrmMerge>[2]
}): Promise<string> {
  const detail = await getProspectDetail(args.kind, args.prospect.id).catch(() => null)
  const price = detail?.listPrice ?? args.prospect.listPrice
  if (args.ctx) {
    args.ctx.property = {
      ...(args.ctx.property ?? {}),
      address: detail?.streetAddress ?? args.prospect.streetAddress,
      price: price != null && Number.isFinite(price) && price > 0 ? formatFirstTouchUsd(price) : args.ctx.property?.price,
    }
  }
  if (args.templateBody && !isCanonicalFirstTouchBody(args.kind, args.templateBody)) {
    return renderCrmMerge(args.templateBody, args.personLike, args.ctx)
  }
  return buildFirstTouchSms(
    args.kind,
    firstTouchFactsFromProspect({
      address: detail?.streetAddress ?? args.prospect.streetAddress,
      listPrice: price,
      daysOnMarket: detail?.daysOnMarket ?? null,
      listedAt: args.prospect.listedAt,
      expiredAt: args.prospect.expiredAt,
      originalListPrice: detail?.originalListPrice ?? null,
      priceHistory: detail?.priceHistory,
      senderFirstName: args.senderFirstName,
      cmaLink: args.cmaLink,
    }),
  )
}

/**
 * Bust the tag-keyed worklist + engagement caches (M10). The list reads go
 * through makeResilientCached/unstable_cache with a 30s TTL and their own tags,
 * so a bare revalidatePath (the page is force-dynamic but the DATA is cached)
 * leaves a sent/approved row showing its old state for up to 30s. revalidateTag
 * flips it immediately. `kinds` defaults to both because approve resolves by slug
 * and doesn't carry the prospect kind.
 */
function revalidateProspectCaches(kinds: ProspectKind[] = ['expired', 'fsbo']): void {
  for (const k of kinds) {
    revalidateTag(`prospecting:list:${k}`, 'max')
    revalidateTag(`prospecting:engagement:${k}`, 'max')
  }
  revalidatePath('/admin/prospecting')
}

// ── The reconciled cold intro (spec §5.3) ───────────────────────────────────

export async function sendProspectingIntro(
  kind: ProspectKind,
  id: string,
  args: { idempotencyKey: string; bodyOverride?: string | null },
): Promise<SendIntroResult> {
  try {
    // 1. Auth (in-body — this is an independently-invocable POST).
    if (!(await requireAdmin())) return { ok: false, error: 'Unauthorized', code: 'auth' }

    const prospect = await getProspect(kind, id)
    if (!prospect) return { ok: false, error: 'Prospect not found.', code: 'not-found' }

    // 3. Built-doc: a document must exist AND be client-ready (the public /cma
    // route 404s drafts, so the texted link must be finalized/delivered). The
    // auto-built audit lands as a draft — the broker approves it first.
    if (prospect.doc.state === 'building') {
      return { ok: false, error: 'The audit is still building. Try again in a moment.', code: 'no-doc' }
    }
    if (prospect.doc.state === 'none' || prospect.doc.state === 'failed') {
      return { ok: false, error: 'No audit built yet for this address. Build it before sending the intro.', code: 'no-doc' }
    }
    if (!prospect.streetAddress) {
      return { ok: false, error: 'No street address on the prospect record.', code: 'not-found' }
    }
    // Bind the texted link to THIS prospect's own document chain (spec §4.2
    // cma_id), not a re-derived address slug. prospect.doc is resolved cma_id-first
    // by resolveDocsBatch, so its slug base is the correct chain; a street-only
    // slugifyAddress can collide across cities and resolve a DIFFERENT owner's audit
    // (adversarial audit 2026-07-18 F1). The state is guaranteed ready|sent here
    // (guards above), so a slug is always present; fall back to the address slug
    // only in the impossible no-slug case.
    const docBaseSlug =
      prospect.doc.state === 'ready' || prospect.doc.state === 'sent'
        ? prospect.doc.slug.replace(/--v\d+$/, '')
        : slugifyAddress(prospect.streetAddress)
    const clientReady = await getLatestClientReadyCmaRowForBaseSlug(docBaseSlug)
    if (!clientReady) {
      return {
        ok: false,
        error: 'The audit for this address is not approved yet. Approve it first, otherwise the texted link would 404 as a draft.',
        code: 'no-doc',
      }
    }
    const docUrl = `${SITE_URL}/cma/${clientReady.slug}`

    // 4–6. Non-negotiable exclusions, from the live-computed compliance state.
    if (prospect.compliance.offMarket) {
      return { ok: false, error: 'This FSBO is off market. Not sendable.', code: 'off-market' }
    }
    if (prospect.compliance.hardStop) {
      return { ok: false, error: 'Hard-stop contact (litigator / TCPA / deceased flag). Do not text or call.', code: 'hard-stop' }
    }
    // Re-list: the snapshot is fast-reject; the send additionally re-verifies live
    // and FAIL-CLOSED (review F2) — a listings read error must block, never silently
    // solicit a property that may be back on the market.
    if (prospect.compliance.relisted) {
      return { ok: false, error: 'This property has re-listed or sold after expire. Soliciting it is not allowed.', code: 'relisted' }
    }
    const relistCheck = await verifyNotRelisted(kind, {
      street_address: prospect.streetAddress,
      city: prospect.city,
      expiryComparator: prospect.expiredAt,
      listing_key: kind === 'expired' ? prospect.id : null,
    })
    if (relistCheck.relisted) {
      return { ok: false, error: 'This property is now active, pending, or sold after expire. Outreach is not allowed.', code: 'relisted' }
    }
    if (relistCheck.verifyFailed) {
      return { ok: false, error: 'Could not verify the property is still off-market. Send blocked until MLS status is confirmed.', code: 'relisted' }
    }

    // 7. Phone.
    const to = toE164(prospect.contactPhone)
    if (!to) return { ok: false, error: 'No valid phone on file for this owner.', code: 'no-phone' }

    // 8. Quiet hours (8am–8pm Pacific — Oregon's window, see lib/crm/quiet-hours).
    if (inSmsQuietHours()) {
      return { ok: false, error: 'Quiet hours (before 8am / after 8pm Pacific). Try again inside the window.', code: 'quiet-hours' }
    }

    // 9. Ensure a native CRM lead + LIVE suppression re-check (a newly created
    // person could resolve a suppression the row snapshot did not carry).
    const lead = await ensureNativeLead({
      name: prospect.ownerName,
      phone: prospect.contactPhone,
      email: prospect.contactEmail,
      source: kind === 'expired' ? 'expired-outreach-queue' : 'fsbo-outreach',
      tags: [
        'audience:seller',
        kind === 'expired' ? 'intent:expired-listing' : 'intent:fsbo',
        kind === 'expired' ? 'source:expired-outreach-queue' : 'source:fsbo-outreach',
        'broker:matt',
      ],
      assignedBroker: 'matt',
    })
    const sup = await isSuppressed(lead.personId, 'sms')
    if (sup.suppressed) {
      return { ok: false, error: `Suppressed for SMS: ${sup.reasons.join(', ') || 'opt-out on file'}.`, code: 'suppressed' }
    }
    // F6: value-keyed SMS suppression (an opt-out attached to the number, not a
    // person, e.g. a manual/imported STOP before any person row existed).
    // isSuppressed(personId) only reads person-keyed rows + tags. Fail-closed.
    const phoneSup = await isSuppressedByPhone(to, 'sms')
    if (phoneSup.suppressed) {
      return { ok: false, error: `Number suppressed for SMS: ${phoneSup.reasons.join(', ') || 'opt-out on file'}.`, code: 'suppressed' }
    }

    // 11. Compose the body. Matt's rich-dialog directive: the broker may edit the
    // default template before sending (`bodyOverride`). Whether server-composed or
    // broker-edited, the SAME compliance pipeline runs: fail-closed on any
    // unresolved %token%, then short-link every URL. The %cma_link% carries _pid
    // (session stitch) + UTMs; the short-linker collapses the whole URL so this
    // never lengthens the SMS. Built BEFORE the claim so a merge failure never
    // burns a claim.
    const templateKey = introTemplateKeyFor(kind)
    const sb = createServiceClient()
    const docUrlForPerson = `${docUrl}?_pid=${lead.personId}&utm_source=crm&utm_medium=sms&utm_campaign=${kind}`
    let merged: string
    if (args.bodyOverride && args.bodyOverride.trim()) {
      // Broker-edited body (already shown to them in the preview). Still gated by
      // the unresolved-token check + link instrumentation below.
      merged = args.bodyOverride.trim()
    } else {
      const { data: tpl } = await sb
        .from('crm_templates')
        .select('body')
        .eq('key', templateKey)
        .eq('channel', 'sms')
        .eq('is_active', true)
        .maybeSingle()
      if (!tpl?.body) return { ok: false, error: `SMS template ${templateKey} not found or inactive.`, code: 'merge-unresolved' }
      const { data: personRow } = await sb
        .from('crm_people')
        .select('name, first_name, last_name, stage, source, emails, phones, addresses, custom')
        .eq('id', lead.personId)
        .maybeSingle()
      const ctx = await buildMergeContext({ person: undefined, senderSlug: 'matt' })
      const personLike: MergePersonLike = {
        ...(personRow ?? {}),
        custom: { ...((personRow?.custom as Record<string, unknown> | null) ?? {}), cmaLink: docUrlForPerson },
      }
      merged = await composeProspectFirstTouch({
        kind,
        prospect,
        senderFirstName: ctx.sender?.firstName ?? null,
        cmaLink: docUrlForPerson,
        templateBody: String(tpl.body),
        personLike,
        ctx,
      })
    }
    const unresolved = findUnresolvedMergeTokens(merged)
    if (unresolved.length > 0) {
      return { ok: false, error: `Send refused. Unresolved merge tokens: ${unresolved.join(', ')}.`, code: 'merge-unresolved' }
    }

    // 12. Attribute then short-link (sendGovernedSms order, audit 2026-09-01) —
    // the stored target carries ?_pid=/?agent= so a click stitches the site
    // session. Fail-open to the untracked body.
    const { instrumentSmsLinks } = await import('@/lib/data/crm/shortLinks')
    const { attributeSiteLinks } = await import('@/lib/crm/merge')
    const attributed = attributeSiteLinks(merged, 'matt', null, lead.personId)
    const body = await instrumentSmsLinks(attributed, { personId: lead.personId, broker: 'matt' }).catch(() => attributed)

    // 10. CLAIM — the at-most-once gate, right before the irreversible send.
    const claim = await claimProspectSend(kind, id, args.idempotencyKey)
    if (claim === 'replay') {
      // This exact request already completed — return success, never a 2nd text.
      // Channel-aware: the SMS stamp specifically (doc.sentAt is the cross-channel
      // first touch and could be the EMAIL timestamp).
      const sentAt =
        prospect.doc.state === 'sent'
          ? (prospect.doc.smsSentAt ?? prospect.doc.sentAt)
          : new Date().toISOString()
      const sid = prospect.doc.state === 'sent' ? (prospect.doc.sid ?? '') : ''
      return { ok: true, sid, personId: lead.personId, sentAt }
    }
    if (claim === 'already_sent') {
      return { ok: false, error: 'Intro already sent to this owner.', code: 'already-sent' }
    }
    if (claim === 'claimed_elsewhere') {
      return { ok: false, error: 'Another send is already in progress for this owner.', code: 'already-sent' }
    }
    if (claim === 'not_found') {
      return { ok: false, error: 'Prospect not found at claim time.', code: 'not-found' }
    }
    // claim === 'claimed' — we own the send.

    // 12.5 TCPA TOCTOU guard (adversarial audit 2026-07-18 M6): suppression was
    // checked at step 9, but compose + short-link + claim ran since. Re-check the
    // instant before the irreversible send so a STOP that landed in that window
    // still blocks. No text has gone out yet, so release the claim on a hit.
    const supNow = await isSuppressed(lead.personId, 'sms')
    const phoneSupNow = supNow.suppressed ? { suppressed: false, reasons: [] } : await isSuppressedByPhone(to, 'sms')
    if (supNow.suppressed || phoneSupNow.suppressed) {
      await releaseProspectSend(kind, id)
      const reasons = [...supNow.reasons, ...phoneSupNow.reasons].join(', ') || 'opt-out on file'
      return { ok: false, error: `Suppressed for SMS: ${reasons}.`, code: 'suppressed' }
    }

    // 13. Send via the A2P messaging service. A failure HERE is before any text
    // left the building, so it is safe to release the claim and let a retry go.
    const sent = await sendSmsViaMessagingService({ to, body })
    if (!sent.ok) {
      await releaseProspectSend(kind, id)
      console.error('[sendProspectingIntro] Twilio send failed, claim released:', sent.error)
      return { ok: false, error: sent.error, code: 'send-failed' }
    }
    const sid = sent.sid

    // The text HAS gone out. Persist the sid DURABLY, right now, before anything
    // else can fail (adversarial audit 2026-07-18 H2). prospect_send_claim treats a
    // sid-bearing row as already-sent, so even if every finalize retry below fails,
    // a later retry can never double-text this owner. Best-effort by contract, but
    // the claim's own sid guard is the real safety net.
    await stampProspectSid(kind, id, sid).catch((e) =>
      console.error('[sendProspectingIntro] sid stamp failed (finalize still attempted):', e),
    )

    // From here we NEVER release the claim (review F1): releasing would let a retry
    // double-text a real owner. Finalize (the durable sent-stamp) with retries; if
    // it still fails, leave the claim in place and log loudly for manual
    // reconciliation. Timeline/enrich are best-effort and never release or re-send.
    let finalized = false
    for (let attempt = 1; attempt <= 3 && !finalized; attempt++) {
      try {
        await finalizeProspectSend(kind, id, { idempotencyKey: args.idempotencyKey, sid, personId: lead.personId })
        finalized = true
      } catch (e) {
        console.error(`[sendProspectingIntro] finalize attempt ${attempt} failed:`, e instanceof Error ? e.message : e)
      }
    }
    if (!finalized) {
      console.error('[sendProspectingIntro] SENT but finalize FAILED after retries. Manual reconcile needed.', {
        kind,
        id,
        sid,
      })
    }
    try {
      await sb.from('crm_timeline').insert({
        person_id: lead.personId,
        kind: 'sms_out',
        title: kind === 'expired' ? 'Expired outreach intro SMS' : 'FSBO outreach intro SMS',
        body,
        payload: {
          prospect_kind: kind,
          prospect_id: id,
          template_key: templateKey,
          provider_sid: sid,
          idempotency_key: args.idempotencyKey,
          queue: 'prospecting',
        },
        broker: 'matt',
        source: 'app',
      })
    } catch (e) {
      console.warn('[sendProspectingIntro] timeline log failed (text already sent):', e instanceof Error ? e.message : e)
    }
    await enrichNativeLead({
      personId: lead.personId,
      custom: {
        customClassification: kind === 'expired' ? 'EXPIRED' : 'FSBO',
        customSellerPropertyAddress: `${prospect.streetAddress}, ${prospect.city ?? ''}`.replace(/, $/, ''),
      },
    }).catch((e) => console.warn('[sendProspectingIntro] enrich failed:', e))

    revalidateProspectCaches([kind])
    return { ok: true, sid, personId: lead.personId, sentAt: new Date().toISOString() }
  } catch (e) {
    console.error('[sendProspectingIntro]', e)
    return { ok: false, error: 'Send failed unexpectedly.', code: 'send-failed' }
  }
}

// ── The reconciled cold EMAIL intro (Email tab of the send dialog) ──────────

/**
 * Email twin of `sendProspectingIntro` — the SAME fail-closed guard chain,
 * guard for guard (auth → doc client-ready → off-market → hard-stop → relist
 * verify → recipient present → lead + suppression → merge-token refusal →
 * at-most-once claim → TOCTOU suppression re-check → send → stamp → finalize),
 * swapped to the email channel:
 *
 * - Recipient gate is a valid email (no-phone → no-email). TCPA quiet hours do
 *   NOT apply — that is an SMS/call rule; email has no send-window statute.
 * - Suppression is the email channel: isSuppressed(personId,'email') UNION the
 *   value-keyed isSuppressedByEmail(address,'email') (both fail closed).
 * - At-most-once rides the outreach_email_* columns via the
 *   prospect_email_send_* RPC trio (migration 20260722010100) — independent of
 *   the SMS claim, so one channel never blocks the other. Pre-migration the
 *   claim reports 'not_deployed' and the send refuses (fail-closed, no email).
 * - The transport is the canonical CMA delivery rail `sendCmaToLead`
 *   (lib/cma/send.ts): fail-closed suppression re-check inside the rail, PDF
 *   attached, attributeOutbound with emailKey `cma:<slug>` (so the existing
 *   engagement aggregation in lib/data/prospecting/engagement.ts picks up
 *   opens/clicks from email_events), Gmail DWD from the broker mailbox with
 *   Resend fallback, and the crm_timeline email_out row. Attribution happens
 *   INSIDE the rail — this action never wraps the HTML itself.
 */
export async function sendProspectingEmailIntro(
  kind: ProspectKind,
  id: string,
  args: { idempotencyKey: string; subjectOverride?: string | null; bodyOverride?: string | null },
): Promise<SendEmailIntroResult> {
  try {
    // 1. Auth (mirrors the SMS intro step 1).
    if (!(await requireAdmin())) return { ok: false, error: 'Unauthorized', code: 'auth' }

    const prospect = await getProspect(kind, id)
    if (!prospect) return { ok: false, error: 'Prospect not found.', code: 'not-found' }

    // 3. Built-doc: client-ready only — the emailed link/PDF must never be a
    // draft (same chain as the SMS steps, including the cma_id-first slug
    // binding from the 2026-07-18 F1 audit).
    if (prospect.doc.state === 'building') {
      return { ok: false, error: 'The audit is still building. Try again in a moment.', code: 'no-doc' }
    }
    if (prospect.doc.state === 'none' || prospect.doc.state === 'failed') {
      return { ok: false, error: 'No audit built yet for this address. Build it before sending the intro.', code: 'no-doc' }
    }
    if (!prospect.streetAddress) {
      return { ok: false, error: 'No street address on the prospect record.', code: 'not-found' }
    }
    const docBaseSlug =
      prospect.doc.state === 'ready' || prospect.doc.state === 'sent'
        ? prospect.doc.slug.replace(/--v\d+$/, '')
        : slugifyAddress(prospect.streetAddress)
    const clientReady = await getLatestClientReadyCmaRowForBaseSlug(docBaseSlug)
    if (!clientReady) {
      return {
        ok: false,
        error: 'The audit for this address is not approved yet. Approve it first, otherwise the emailed link would 404 as a draft.',
        code: 'no-doc',
      }
    }

    // 4–6. Non-negotiable exclusions (mirrors SMS steps 4–6, fail-closed relist).
    if (prospect.compliance.offMarket) {
      return { ok: false, error: 'This FSBO is off market. Not sendable.', code: 'off-market' }
    }
    // The EMAIL channel's own block, never the SMS `hardStop` — a do-not-call
    // contact is legally emailable. See docs/plans/PROSPECT_TO_CMA_AND_SITE_IA_2026-07-28.md.
    if (prospect.compliance.channels.email.blocked) return { ok: false, error: `Email blocked: ${prospect.compliance.channels.email.reason ?? 'opt-out on file'}.`, code: 'hard-stop' }
    if (prospect.compliance.relisted) {
      return { ok: false, error: 'This property has re-listed or sold after expire. Soliciting it is not allowed.', code: 'relisted' }
    }
    const relistCheck = await verifyNotRelisted(kind, {
      street_address: prospect.streetAddress,
      city: prospect.city,
      expiryComparator: prospect.expiredAt,
      listing_key: kind === 'expired' ? prospect.id : null,
    })
    if (relistCheck.relisted) {
      return { ok: false, error: 'This property is now active, pending, or sold after expire. Outreach is not allowed.', code: 'relisted' }
    }
    if (relistCheck.verifyFailed) {
      return { ok: false, error: 'Could not verify the property is still off-market. Send blocked until MLS status is confirmed.', code: 'relisted' }
    }

    // 7. Recipient (email twin of the SMS phone gate). Quiet hours deliberately
    // NOT checked — TCPA's calling-window rule covers calls/texts, not email.
    const toEmail = (prospect.contactEmail ?? '').trim().toLowerCase()
    if (!hasSendableEmail(toEmail)) {
      return { ok: false, error: 'No valid email on file for this owner.', code: 'no-email' }
    }

    // 9. Ensure a native CRM lead + LIVE suppression re-check, person-keyed AND
    // value-keyed (mirrors SMS step 9 + F6 — an opt-out attached to the address
    // before any person row existed must block).
    const lead = await ensureNativeLead({
      name: prospect.ownerName,
      phone: prospect.contactPhone,
      email: toEmail,
      source: kind === 'expired' ? 'expired-outreach-queue' : 'fsbo-outreach',
      tags: [
        'audience:seller',
        kind === 'expired' ? 'intent:expired-listing' : 'intent:fsbo',
        kind === 'expired' ? 'source:expired-outreach-queue' : 'source:fsbo-outreach',
        'broker:matt',
      ],
      assignedBroker: 'matt',
    })
    const sup = await isSuppressed(lead.personId, 'email')
    if (sup.suppressed) {
      return { ok: false, error: `Suppressed for email: ${sup.reasons.join(', ') || 'opt-out on file'}.`, code: 'suppressed' }
    }
    const emailSup = await isSuppressedByEmail(toEmail, 'email')
    if (emailSup.suppressed) {
      return { ok: false, error: `Address suppressed for email: ${emailSup.reasons.join(', ') || 'opt-out on file'}.`, code: 'suppressed' }
    }

    // 11. Broker overrides gate: fail-closed on any unresolved %token% (mirrors
    // SMS step 11's refusal). The rail's own default compose carries no tokens.
    const overrideText = `${args.subjectOverride ?? ''} ${args.bodyOverride ?? ''}`
    const unresolved = findUnresolvedMergeTokens(overrideText)
    if (unresolved.length > 0) {
      return { ok: false, error: `Send refused. Unresolved merge tokens: ${unresolved.join(', ')}.`, code: 'merge-unresolved' }
    }

    // 10. CLAIM — the at-most-once gate on the EMAIL columns, right before the
    // irreversible send (mirrors SMS step 10; independent of the SMS claim).
    const claim = await claimProspectEmailSend(kind, id, args.idempotencyKey)
    if (claim === 'not_deployed') {
      return {
        ok: false,
        error: 'Email outreach is not provisioned yet (migration 20260722010100 pending). No email was sent.',
        code: 'send-failed',
      }
    }
    if (claim === 'replay') {
      const sentAt =
        prospect.doc.state === 'sent' && prospect.doc.emailSentAt
          ? prospect.doc.emailSentAt
          : new Date().toISOString()
      return { ok: true, messageId: null, personId: lead.personId, sentAt, transport: null }
    }
    if (claim === 'already_sent') {
      return { ok: false, error: 'Intro already emailed to this owner.', code: 'already-sent' }
    }
    if (claim === 'claimed_elsewhere') {
      return { ok: false, error: 'Another send is already in progress for this owner.', code: 'already-sent' }
    }
    if (claim === 'not_found') {
      return { ok: false, error: 'Prospect not found at claim time.', code: 'not-found' }
    }
    // claim === 'claimed' — we own the send.

    // 12.5 TOCTOU guard (mirrors SMS step 12.5 / audit M6): an opt-out that
    // landed between step 9 and the claim must still block. Nothing has been
    // sent yet, so releasing the claim is safe.
    const supNow = await isSuppressed(lead.personId, 'email')
    const emailSupNow = supNow.suppressed ? { suppressed: false, reasons: [] } : await isSuppressedByEmail(toEmail, 'email')
    if (supNow.suppressed || emailSupNow.suppressed) {
      await releaseProspectEmailSend(kind, id)
      const reasons = [...supNow.reasons, ...emailSupNow.reasons].join(', ') || 'opt-out on file'
      return { ok: false, error: `Suppressed for email: ${reasons}.`, code: 'suppressed' }
    }

    // 12.6 The rail resolves its recipient from the cmas row — pin it to the
    // address this dialog showed the broker (the prospect record is the fresher
    // skip-trace truth; mirrors send-doc.ts's client_email stamp, strengthened
    // to also correct a stale mismatch). A drifted recipient here would email a
    // DIFFERENT address than the one the broker approved on screen.
    const railEmail = ((clientReady.row.client_email as string | null) ?? '').trim().toLowerCase()
    if (railEmail !== toEmail) {
      const stamped = await updateCmaRowFieldsBySlug(clientReady.slug, { client_email: toEmail })
      if (!stamped.ok) {
        await releaseProspectEmailSend(kind, id)
        return { ok: false, error: `Could not pin the recipient on the document (${stamped.error ?? 'update failed'}). No email was sent.`, code: 'send-failed' }
      }
    }

    // 13. Send via the canonical CMA delivery rail. Suppression re-checks again
    // inside the rail (fail-closed), tracking + timeline + attribution are the
    // rail's job (emailKey `cma:<slug>` — the engagement reader's key). A
    // failure here means NO email left the building → release and allow retry.
    const sent = await sendCmaToLead(clientReady.slug, {
      subject: args.subjectOverride?.trim() || undefined,
      bodyText: args.bodyOverride?.trim() || undefined,
    })
    if (!sent.ok) {
      await releaseProspectEmailSend(kind, id)
      console.error('[sendProspectingEmailIntro] rail send failed, claim released:', sent.error)
      return { ok: false, error: sent.error ?? 'Email send failed.', code: 'send-failed' }
    }
    const messageId = sent.gmailMessageId ?? sent.resendId ?? null

    // The email HAS gone out. Stamp the provider id durably RIGHT NOW (mirrors
    // the SMS sid stamp / audit H2): the claim treats a message-id-bearing row
    // as already-sent, so even if every finalize retry fails, a later retry can
    // never double-email this owner.
    if (messageId) {
      await stampProspectEmailMessageId(kind, id, messageId).catch((e) =>
        console.error('[sendProspectingEmailIntro] message-id stamp failed (finalize still attempted):', e),
      )
    }

    // From here we NEVER release the claim (mirrors SMS F1). Finalize with
    // retries; on persistent failure leave the claim in place and log loudly.
    // The rail already wrote the crm_timeline email_out row and the cmas
    // delivered stamp — no duplicate logging here.
    let finalized = false
    for (let attempt = 1; attempt <= 3 && !finalized; attempt++) {
      try {
        await finalizeProspectEmailSend(kind, id, {
          idempotencyKey: args.idempotencyKey,
          messageId,
          personId: lead.personId,
        })
        finalized = true
      } catch (e) {
        console.error(`[sendProspectingEmailIntro] finalize attempt ${attempt} failed:`, e instanceof Error ? e.message : e)
      }
    }
    if (!finalized) {
      console.error('[sendProspectingEmailIntro] SENT but finalize FAILED after retries. Manual reconcile needed.', {
        kind,
        id,
        messageId,
      })
    }
    await enrichNativeLead({
      personId: lead.personId,
      custom: {
        customClassification: kind === 'expired' ? 'EXPIRED' : 'FSBO',
        customSellerPropertyAddress: `${prospect.streetAddress}, ${prospect.city ?? ''}`.replace(/, $/, ''),
      },
    }).catch((e) => console.warn('[sendProspectingEmailIntro] enrich failed:', e))

    revalidateProspectCaches([kind])
    return {
      ok: true,
      messageId,
      personId: lead.personId,
      sentAt: new Date().toISOString(),
      transport: sent.transport ?? null,
    }
  } catch (e) {
    console.error('[sendProspectingEmailIntro]', e)
    return { ok: false, error: 'Send failed unexpectedly.', code: 'send-failed' }
  }
}

// ── Build the audit/CMA (spec §5.4) ─────────────────────────────────────────

export async function buildProspectDoc(
  kind: ProspectKind,
  id: string,
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: 'Unauthorized' }
    const prospect = await getProspect(kind, id)
    if (!prospect) return { ok: false, error: 'Prospect not found.' }
    if (!prospect.streetAddress) return { ok: false, error: 'No street address on the prospect record.' }

    // Land the build on a writable slot — rebuild an open draft in place, or open
    // a --vN document after a protected (finalized/delivered) one. Never clobber.
    const slot = await resolveWritableCmaSlot(slugifyAddress(prospect.streetAddress))
    if (!slot.ok) return { ok: false, error: slot.error }

    const res = await buildCma({
      slug: slot.slug,
      rawAddress: prospect.streetAddress,
      city: prospect.city,
      client: {
        name: prospect.ownerName,
        email: prospect.contactEmail,
        phone: prospect.contactPhone,
        notes: kind === 'expired' ? 'Expired-listing audit (prospecting build)' : 'FSBO CMA (prospecting build)',
      },
      requestSource: kind === 'expired' ? 'expired-dashboard' : 'fsbo-dashboard',
      docType: expectedDocTypeFor(kind),
    })
    if (!res.ok) return { ok: false, error: res.error ?? 'Build failed.' }

    // Stamp the id link so the surface resolves this doc by cma_id (spec §4.2).
    if (res.cmaId) await linkProspectCma(kind, id, res.cmaId)

    revalidateProspectCaches([kind])
    return { ok: true, slug: slot.slug }
  } catch (e) {
    console.error('[buildProspectDoc]', e)
    return { ok: false, error: 'Build failed unexpectedly.' }
  }
}

// ── Approve (finalize) the built draft so its link is client-ready ──────────

export async function approveProspectDoc(
  slug: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: 'Unauthorized' }
    const { approveCmaAction } = await import('@/app/actions/cma-admin')
    const res = await approveCmaAction(slug)
    if (res.error) return { ok: false, error: res.error }
    revalidateProspectCaches()
    return { ok: true }
  } catch (e) {
    console.error('[approveProspectDoc]', e)
    return { ok: false, error: 'Approve failed unexpectedly.' }
  }
}

// ── Prepare the send dialog (default merged body + status + engagement) ─────

export interface ProspectSendContext {
  kind: ProspectKind
  id: string
  ownerName: string | null
  toPhone: string | null
  toEmail: string | null
  defaultSmsBody: string
  defaultEmailSubject: string
  defaultEmailBody: string
  docSlug: string | null
  clientReady: boolean
  /** Either-channel first touch (kept for the dialog's approve gate + banner). */
  alreadySent: { at: string; sid: string | null } | null
  /** Per-channel sent stamps (channel-aware sent-state; null = channel unsent). */
  sentSms: { at: string; sid: string | null } | null
  sentEmail: { at: string } | null
  engagement: { reportViews: number; linkTaps: number; emailOpens: number; emailClicks: number; lastActivityAt: string | null }
}

export async function prepareProspectSend(
  kind: ProspectKind,
  id: string,
): Promise<{ ok: true; context: ProspectSendContext } | { ok: false; error: string }> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: 'Unauthorized' }
    const prospect = await getProspect(kind, id)
    if (!prospect) return { ok: false, error: 'Prospect not found.' }

    // Same cma_id-first binding as the send path (F1) — preview the link the send
    // would actually text, from THIS prospect's own doc chain, not a re-derived slug.
    const baseSlug =
      prospect.doc.state === 'ready' || prospect.doc.state === 'sent'
        ? prospect.doc.slug.replace(/--v\d+$/, '')
        : prospect.streetAddress
          ? slugifyAddress(prospect.streetAddress)
          : null
    const clientReadyRow = baseSlug ? await getLatestClientReadyCmaRowForBaseSlug(baseSlug) : null
    const docSlug =
      clientReadyRow?.slug ??
      (prospect.doc.state === 'ready' || prospect.doc.state === 'sent' ? prospect.doc.slug : null)
    const docUrl = docSlug ? `${SITE_URL}/cma/${docSlug}` : null

    // Merged intro body (what would actually send). No hardcoded preview.
    const templateKey = introTemplateKeyFor(kind)
    const sb = createServiceClient()
    const { data: tpl } = await sb
      .from('crm_templates')
      .select('body')
      .eq('key', templateKey)
      .eq('channel', 'sms')
      .eq('is_active', true)
      .maybeSingle()
    const ctx = await buildMergeContext({ senderSlug: 'matt' })
    const defaultSmsBody = tpl?.body
      ? await composeProspectFirstTouch({
          kind,
          prospect,
          senderFirstName: ctx.sender?.firstName ?? null,
          cmaLink: docUrl,
          templateBody: String(tpl.body),
          personLike: { custom: { cmaLink: docUrl ?? '' } },
          ctx,
        })
      : ''

    // Email defaults come from the SAME rail the send uses (prepareCmaSendPreview
    // → sendCmaToLead's default compose), so preview always equals send and the
    // dialog's "edited" detection compares against the true server default. The
    // rail appends the tracked READ THE FULL REPORT button itself — the default
    // body deliberately carries no raw URL.
    let defaultEmailSubject = prospect.streetAddress
      ? `Your market analysis for ${prospect.streetAddress}`
      : 'Your market analysis'
    let defaultEmailBody = defaultSmsBody
    if (docSlug) {
      const preview = await prepareCmaSendPreview(docSlug).catch(() => null)
      if (preview?.ok) {
        defaultEmailSubject = preview.subject
        defaultEmailBody = preview.bodyText
      }
    }

    const alreadySent =
      prospect.doc.state === 'sent'
        ? { at: prospect.doc.sentAt, sid: prospect.doc.sid }
        : null
    const sentSms =
      prospect.doc.state === 'sent' && prospect.doc.smsSentAt
        ? { at: prospect.doc.smsSentAt, sid: prospect.doc.sid }
        : null
    const sentEmail =
      prospect.doc.state === 'sent' && prospect.doc.emailSentAt
        ? { at: prospect.doc.emailSentAt }
        : null

    return {
      ok: true,
      context: {
        kind,
        id,
        ownerName: prospect.ownerName,
        toPhone: prospect.contactPhone,
        toEmail: prospect.contactEmail,
        defaultSmsBody,
        defaultEmailSubject,
        defaultEmailBody,
        docSlug,
        clientReady: Boolean(clientReadyRow),
        alreadySent,
        sentSms,
        sentEmail,
        engagement: {
          reportViews: prospect.engagement.reportViews,
          linkTaps: prospect.engagement.linkTaps,
          emailOpens: prospect.engagement.emailOpens,
          emailClicks: prospect.engagement.emailClicks,
          lastActivityAt: prospect.engagement.lastActivityAt,
        },
      },
    }
  } catch (e) {
    console.error('[prepareProspectSend]', e)
    return { ok: false, error: 'Failed to prepare the send.' }
  }
}

// ── One-click drip enrollment (worklist/detail button) ──────────────────────

export type EnrollDripResult = { ok: true; sequence: string } | { ok: false; error: string }

/**
 * Enroll a prospect's CRM person in the kind's drip workflow — one click from
 * the prospecting detail, no trip through the contact page's automations sheet.
 *
 * Reuses the canonical broker-driven enrollment (lib/crm/enroll.ts
 * manualEnrollPerson): fail-closed on compliance hard-stop, refuses an
 * inactive sequence, never double-enrolls a live one, and writes the
 * 'manual-enroll' crm_timeline note itself. An explicit broker click
 * deliberately bypasses autoEnrollPerson's outreach-source auto-enroll skip —
 * the same trust model as the contact page sheet (app/actions/crm-membership.ts
 * setSequenceEnrollment), which also routes through manualEnrollPerson.
 */
export async function enrollProspectInDripAction(
  personId: number,
  kind: ProspectKind,
): Promise<EnrollDripResult> {
  try {
    const session = await getSession()
    const email = session?.user?.email ?? null
    const role = await getAdminRoleForEmail(email)
    if (!role || role.role === 'report_viewer') return { ok: false, error: 'Unauthorized' }

    const pid = Number(personId)
    if (!Number.isFinite(pid) || pid <= 0) {
      return { ok: false, error: 'No CRM contact linked to this prospect yet.' }
    }

    const seq = await resolveDripSequenceForKind(kind)
    if (!seq) {
      return {
        ok: false,
        error: `No active ${kind === 'expired' ? 'expired-listing' : 'FSBO'} drip workflow is configured.`,
      }
    }

    const { manualEnrollPerson } = await import('@/lib/crm/enroll')
    const result = await manualEnrollPerson(pid, seq.id, email ?? 'broker')
    if (!result.enrolled) return { ok: false, error: result.reason }

    revalidateProspectCaches([kind])
    revalidatePerson(pid)
    return { ok: true, sequence: result.sequence }
  } catch (e) {
    console.error('[enrollProspectInDripAction]', e)
    return { ok: false, error: 'Enroll failed unexpectedly.' }
  }
}

// ── Send a test to the acting broker (spec §3 dialog "send test") ───────────

export async function sendProspectTest(args: {
  channel: 'sms' | 'email'
  subject?: string | null
  body: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: 'Unauthorized' }
  return sendTemplateSelfTestAction({ channel: args.channel, subject: args.subject ?? null, body: args.body })
}

'use server'

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
import { getProspect } from '@/lib/data'
import { verifyNotRelisted } from '@/lib/data/prospecting/batch'
import { resolveDripSequenceForKind } from '@/lib/data/prospecting/drip'
import {
  claimProspectSend,
  finalizeProspectSend,
  releaseProspectSend,
  stampProspectSid,
  linkProspectCma,
} from '@/lib/data/prospecting/send-claim'
import {
  introTemplateKeyFor,
  expectedDocTypeFor,
  type ProspectKind,
  type SendIntroResult,
} from '@/lib/data/prospecting/types'
import { slugifyAddress } from '@/lib/cma/address-slug'
import {
  getLatestClientReadyCmaRowForBaseSlug,
  resolveWritableCmaSlot,
} from '@/lib/cma/versions'
import { buildCma } from '@/lib/cma/build'
import { ensureNativeLead, enrichNativeLead } from '@/lib/data/crm/ensureNativeLead'
import { isSuppressed, isSuppressedByPhone } from '@/lib/crm/suppressions'
import { inSmsQuietHours } from '@/lib/crm/quiet-hours'
import { renderCrmMerge, findUnresolvedMergeTokens, type MergePersonLike } from '@/lib/crm/merge'
import { buildMergeContext } from '@/lib/crm/merge-context'
import { sendSmsViaMessagingService, toE164 } from '@/lib/crm/twilio'
import { sendTemplateSelfTestAction } from '@/app/actions/crm-template-test'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

async function requireAdmin(): Promise<boolean> {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  return Boolean(role && role.role !== 'report_viewer')
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
      return { ok: false, error: 'This property has re-listed (Active/Pending). Soliciting a listed property is not allowed.', code: 'relisted' }
    }
    const relistCheck = await verifyNotRelisted(kind, {
      street_address: prospect.streetAddress,
      city: prospect.city,
      expiryComparator: prospect.expiredAt,
    })
    if (relistCheck.relisted) {
      return { ok: false, error: 'This property is now active/pending in MLS. Soliciting a listed property is not allowed.', code: 'relisted' }
    }
    if (relistCheck.verifyFailed) {
      return { ok: false, error: 'Could not verify the property is still off-market. Send blocked until MLS status is confirmed.', code: 'relisted' }
    }

    // 7. Phone.
    const to = toE164(prospect.contactPhone)
    if (!to) return { ok: false, error: 'No valid phone on file for this owner.', code: 'no-phone' }

    // 8. TCPA quiet hours (8am–9pm Pacific).
    if (inSmsQuietHours()) {
      return { ok: false, error: 'TCPA quiet hours (before 8am / after 9pm Pacific). Try again inside the window.', code: 'quiet-hours' }
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
      ctx.property = { ...(ctx.property ?? {}), address: prospect.streetAddress }
      const personLike: MergePersonLike = {
        ...(personRow ?? {}),
        custom: { ...((personRow?.custom as Record<string, unknown> | null) ?? {}), cmaLink: docUrlForPerson },
      }
      merged = renderCrmMerge(String(tpl.body), personLike, ctx)
    }
    const unresolved = findUnresolvedMergeTokens(merged)
    if (unresolved.length > 0) {
      return { ok: false, error: `Send refused. Unresolved merge tokens: ${unresolved.join(', ')}.`, code: 'merge-unresolved' }
    }

    // 12. Short-link (fail-open to the untracked body).
    const { instrumentSmsLinks } = await import('@/lib/data/crm/shortLinks')
    const body = await instrumentSmsLinks(merged, { personId: lead.personId, broker: 'matt' }).catch(() => merged)

    // 10. CLAIM — the at-most-once gate, right before the irreversible send.
    const claim = await claimProspectSend(kind, id, args.idempotencyKey)
    if (claim === 'replay') {
      // This exact request already completed — return success, never a 2nd text.
      const sentAt = prospect.doc.state === 'sent' ? prospect.doc.sentAt : new Date().toISOString()
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
  alreadySent: { at: string; sid: string | null } | null
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
    ctx.property = { ...(ctx.property ?? {}), address: prospect.streetAddress }
    const defaultSmsBody = tpl?.body
      ? renderCrmMerge(String(tpl.body), { custom: { cmaLink: docUrl ?? '' } }, ctx)
      : ''

    const defaultEmailSubject = prospect.streetAddress
      ? `Your market analysis for ${prospect.streetAddress}`
      : 'Your market analysis'
    const defaultEmailBody = docUrl
      ? `Hi, Matt with Ryan Realty. I put together a market analysis for ${prospect.streetAddress ?? 'your property'}. Take a look here: ${docUrl} No pressure either way.`
      : ''

    const alreadySent =
      prospect.doc.state === 'sent'
        ? { at: prospect.doc.sentAt, sid: prospect.doc.sid }
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
    revalidatePath(`/admin/crm/${pid}`)
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

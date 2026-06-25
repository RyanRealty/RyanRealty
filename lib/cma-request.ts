/**
 * CMA request intake — the canonical seller-LP → CMA flow.
 *
 * When a visitor submits the seller landing page, we:
 *   1. Create a draft row in `public.cmas` so the request shows up in
 *      /admin/cmas instantly (status='draft', no value yet).
 *   2. Queue a `content:cma` action row in `public.marketing_brain_actions`
 *      so the brain dispatcher (or a broker / agent following
 *      marketing_brain_skills/producers/cma/SKILL.md) picks it up and
 *      builds the canonical 15-page CMA deliverable.
 *   3. Email the assigned broker with a link to the CMA queue.
 *   4. Email the lead with a confirmation so they know we received it.
 *
 * The canonical CMA producer (marketing_brain_skills/producers/cma/SKILL.md)
 * owns the actual CMA computation, HTML build, PDF render, and delivery
 * via /api/cma/[slug]/email. This file is purely intake + notification.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/resend'
import { sendGmailMessage } from '@/lib/gmail-draft'
import { isSuppressedByEmail } from '@/lib/crm/suppressions'
import { fireGa4Event } from '@/lib/ga4-measurement-protocol'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export type CreateCmaRequestInput = {
  rawAddress: string
  parsedStreet: string | null
  parsedCity: string | null
  parsedState: string | null
  parsedPostalCode: string | null
  /** Null for cron-originated requests (e.g. expired-listing detection) where
   *  the owner may be phone-only. No lead confirmation email is sent then. */
  leadEmail: string | null
  leadName?: string | null
  leadPhone?: string | null
  leadTimeline?: string | null
  leadClassification?: string | null
  fubPersonId?: number | null
  /** Optional "About your home" details the seller added on the LP form.
   *  Compiled into the CMA payload (home_details + seller_improvements). */
  sellerHomeDetails?: {
    bedrooms?: string
    bathrooms?: string
    roofAge?: string
    furnaceAge?: string
    acAge?: string
    improvements?: string
    improvementsSpend?: string
    condition?: string
  } | null
  /** Where the request came from. Default 'seller-lp'. */
  requestSource?: 'seller-lp' | 'expired-listing-cron' | 'fsbo-lp'
  /** Send the "we received your request" email to the lead. Default true.
   *  MUST be false for outbound-originated requests (expired) — the owner
   *  never asked us for anything. */
  notifyLead?: boolean
}

/** Public URL where the finished CMA is served once the producer builds it. */
export function cmaPublicUrl(slug: string): string {
  return `${SITE_URL}/cmas/${slug}/cma.html`
}

export type CreateCmaRequestResult =
  | { ok: true; cmaId: string; actionId: string; slug: string }
  | { ok: false; error: string }

/**
 * Slugify an address into `cma-<short-form>`, max 40 chars, kebab-case.
 * Stable for the same address — used as the public `public.cmas.slug`.
 */
export function slugifyAddress(address: string): string {
  const base = address
    .toLowerCase()
    .replace(/[,]/g, ' ')
    .replace(/\b(road|rd|street|st|avenue|ave|drive|dr|lane|ln|court|ct|place|pl|boulevard|blvd|highway|hwy|parkway|pkwy|circle|cir|trail|trl|terrace|ter|way|loop)\b/gi, '')
    .replace(/\b(oregon|or|bend|97701|97702|97703|97703|97707|97712|97739|97759|97760|97741)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
  const slug = `cma-${base}`
  return slug.length > 40 ? slug.slice(0, 40).replace(/-+$/g, '') : slug
}

/** Resolve the broker who should sign the CMA (matt-ryan default). */
async function resolveBrokerSlug(fubPersonId: number | null): Promise<{
  slug: string
  email: string | null
  displayName: string | null
}> {
  const sb = createServiceClient()
  const defaultSlug = (process.env.CMA_DEFAULT_BROKER_SLUG ?? 'matthew-ryan').trim().toLowerCase()

  // TODO: when FUB person has an assignedUserId, resolve to that broker's
  // slug. For now, fall back to the env default.
  void fubPersonId

  const { data } = await sb
    .from('brokers')
    .select('slug, email, display_name')
    .eq('slug', defaultSlug)
    .eq('is_active', true)
    .limit(1)
  const row = (data as Array<{ slug: string; email: string | null; display_name: string | null }> | null)?.[0]
  if (row?.slug) {
    return { slug: row.slug, email: row.email, displayName: row.display_name }
  }
  // Final fallback if the brokers row is missing/disabled.
  return { slug: defaultSlug, email: 'matt@ryan-realty.com', displayName: 'Matt Ryan' }
}

export async function createCmaRequest(
  input: CreateCmaRequestInput
): Promise<CreateCmaRequestResult> {
  try {
    const sb = createServiceClient()
    const rawAddress = input.rawAddress.trim()
    const slug = slugifyAddress(rawAddress)
    const leadEmail = input.leadEmail?.toLowerCase().trim() || null
    const leadName = input.leadName?.trim() || null
    const requestSource = input.requestSource ?? 'seller-lp'
    const sourceLabel =
      requestSource === 'expired-listing-cron'
        ? 'Expired-listing detection'
        : requestSource === 'fsbo-lp'
          ? 'FSBO LP submission'
          : 'Seller LP submission'
    const broker = await resolveBrokerSlug(input.fubPersonId ?? null)

    // Resolve broker uuid so the cmas row has a valid FK if the cmas.broker_id
    // column is uuid (it is). If we can't resolve, leave null and let the
    // producer fill in during finalization.
    const { data: brokerRow } = await sb
      .from('brokers')
      .select('id')
      .eq('slug', broker.slug)
      .limit(1)
    const brokerId = (brokerRow as Array<{ id: string }> | null)?.[0]?.id ?? null

    // Compile optional seller-supplied home details into the structured
    // home_details object + a human-readable seller_improvements string the CMA
    // producer consumes (effective age, Method 2 value-add, condition, beds/baths).
    const hd = input.sellerHomeDetails ?? null
    const conditionLabel: Record<string, string> = {
      excellent: 'Excellent (renovated / move-in)',
      good: 'Good (well maintained)',
      average: 'Average (dated but functional)',
      'needs-work': 'Needs some work',
    }
    let homeDetails: Record<string, string> | null = null
    let sellerImprovementsText: string | null = null
    let sellerImprovementsTotal: number | null = null
    if (hd) {
      const d: Record<string, string> = {}
      if (hd.bedrooms?.trim()) d.bedrooms = hd.bedrooms.trim()
      if (hd.bathrooms?.trim()) d.bathrooms = hd.bathrooms.trim()
      if (hd.roofAge?.trim()) d.roof_age = hd.roofAge.trim()
      if (hd.furnaceAge?.trim()) d.furnace_age = hd.furnaceAge.trim()
      if (hd.acAge?.trim()) d.ac_age = hd.acAge.trim()
      if (hd.condition?.trim()) d.condition = conditionLabel[hd.condition] ?? hd.condition
      homeDetails = Object.keys(d).length > 0 ? d : null

      const parts: string[] = []
      if (hd.bedrooms?.trim() || hd.bathrooms?.trim()) {
        parts.push(`Beds/baths (seller-reported): ${hd.bedrooms?.trim() || '?'} / ${hd.bathrooms?.trim() || '?'}`)
      }
      const sys: string[] = []
      if (hd.roofAge?.trim()) sys.push(`roof ${hd.roofAge.trim()}`)
      if (hd.furnaceAge?.trim()) sys.push(`furnace ${hd.furnaceAge.trim()}`)
      if (hd.acAge?.trim()) sys.push(`AC ${hd.acAge.trim()}`)
      if (sys.length) parts.push(`Systems: ${sys.join(', ')}`)
      if (hd.improvements?.trim()) parts.push(`Improvements: ${hd.improvements.trim()}`)
      if (hd.condition?.trim()) parts.push(`Condition: ${conditionLabel[hd.condition] ?? hd.condition}`)
      sellerImprovementsText = parts.length ? parts.join('. ') : null

      if (hd.improvementsSpend?.trim()) {
        const n = Number(hd.improvementsSpend.replace(/[^0-9.]/g, ''))
        if (Number.isFinite(n) && n > 0) sellerImprovementsTotal = Math.round(n)
      }
    }

    const baseNotes = input.leadTimeline
      ? `Lead timeline: ${input.leadTimeline}${input.leadClassification ? ` · classification: ${input.leadClassification}` : ''}`
      : null
    const clientNotesFull = [baseNotes, sellerImprovementsText].filter(Boolean).join(' · ') || null

    // Step 1: create the cmas draft row. ON CONFLICT (slug) preserves any
    // existing in-progress CMA for the same address — we update the client
    // info but don't blow away the broker's draft work.
    void sb
    const { upsertCmaRowBySlug } = await import('@/lib/data')
    const cmaUpsertResult = await upsertCmaRowBySlug({
      slug,
      subject_address: rawAddress,
      subject_city: input.parsedCity,
      client_name: leadName,
      client_email: leadEmail,
      client_phone: input.leadPhone?.trim() || null,
      client_notes: clientNotesFull,
      broker_id: brokerId,
      broker_slug: broker.slug,
      status: 'draft',
      html_path: `public/drafts/${slug}/cma.html`,
      generation_reason: `${sourceLabel} from ${leadEmail ?? input.leadPhone ?? 'unknown contact'}${
        input.leadTimeline ? ` (${input.leadTimeline})` : ''
      }`,
    })
    if (cmaUpsertResult.error || !cmaUpsertResult.id) {
      return { ok: false, error: `cmas upsert failed: ${cmaUpsertResult.error ?? 'no row'}` }
    }
    const cmaRow = { id: cmaUpsertResult.id, slug: cmaUpsertResult.slug ?? slug }

    // Step 2: queue the action row for the brain dispatcher. The CMA
    // producer SKILL.md picks this up by scanning for pending content:cma rows.
    const { data: actionRow, error: actionErr } = await sb
      .from('marketing_brain_actions')
      .insert({
        action_type: 'content:cma',
        target: `cma:${slug}`,
        assigned_producer: 'marketing_brain_skills/producers/cma',
        payload: {
          cma_slug: slug,
          subject_address: rawAddress,
          subject_city: input.parsedCity,
          subject_state: input.parsedState,
          subject_postal_code: input.parsedPostalCode,
          client_name: leadName,
          client_email: leadEmail,
          client_phone: input.leadPhone?.trim() || null,
          broker_email: broker.email,
          broker_slug: broker.slug,
          client_notes: clientNotesFull,
          seller_improvements: sellerImprovementsText,
          seller_improvements_total: sellerImprovementsTotal,
          home_details: homeDetails,
        },
        data_evidence: {
          request_source: requestSource === 'expired-listing-cron' ? 'expired-listing-cron' : 'lead-form',
          client_relationship: 'cold-lead',
          fub_person_id: input.fubPersonId ?? null,
        },
        generation_reason:
          requestSource === 'expired-listing-cron'
            ? `Expired-listing detection — CMA for ${rawAddress} to open outreach to ${leadName ?? 'the owner'}`
            : `Seller LP submission — ${leadName ?? leadEmail} requested a CMA for ${rawAddress}`,
        status: 'pending',
        // Legacy NOT-NULL fields inherited from the content_briefs view shape.
        // For CMA action rows these are best-effort descriptive labels — the
        // producer reads `payload` for its real inputs.
        topic: `cma: ${rawAddress}`,
        format: 'cma',
        platforms: ['email'],
        hook: `Personalized CMA for ${leadName ?? leadEmail} at ${rawAddress}`,
        target_audience: 'seller-lead',
        data_sources: { lp_form: 'seller-home-value', subject_address: rawAddress },
        predicted_outcome: {
          deliverable: '15-page CMA PDF via /api/cma/<slug>/email',
          sla: '1 business day',
        },
        generated_by: 'seller-lp-form',
      })
      .select('id')
      .single()
    if (actionErr || !actionRow) {
      return {
        ok: false,
        error: `marketing_brain_actions insert failed: ${actionErr?.message ?? 'no row'}`,
      }
    }

    // GA4 Measurement Protocol mirror — fire valuation_requested server-side
    // so ad-blocked clients still register a conversion. No cookies access
    // here (this lib is also called from cron paths); the client_id falls
    // back to a fresh uuid which still counts as a session-less conversion
    // tied to the right event taxonomy.
    void fireGa4Event({
      eventName: 'valuation_requested',
      eventParams: {
        cma_slug: slug,
        lp_variant: requestSource === 'expired-listing-cron' ? 'expired-listing-cron' : 'seller-home-value',
        broker_slug: broker.slug,
        lead_classification: input.leadClassification ?? undefined,
        lead_type: 'seller',
        subject_city: input.parsedCity ?? undefined,
        subject_state: input.parsedState ?? undefined,
      },
      userProperties: {
        assigned_broker: broker.slug,
        lead_status: 'cma-draft',
      },
    })

    // Step 3 + 4: fire-and-forget the notification emails. We don't await —
    // the visitor sees a fast "we got it" response on the LP.
    void sendBrokerNotification({
      brokerEmail: broker.email,
      brokerName: broker.displayName,
      cmaSlug: slug,
      subjectAddress: rawAddress,
      leadName,
      leadEmail: leadEmail ?? 'no email on file',
      leadPhone: input.leadPhone?.trim() || null,
      leadTimeline: input.leadTimeline ?? null,
    }).catch((e) => console.warn('[cma-request] broker notify failed:', e))

    if (leadEmail && (input.notifyLead ?? true)) {
      void sendLeadConfirmation({
        leadEmail,
        leadName,
        subjectAddress: rawAddress,
        brokerName: broker.displayName,
      }).catch((e) => console.warn('[cma-request] lead confirmation failed:', e))
    }

    // Stamp the CMA SLUG (not the link) onto the CRM mirror — awaited, so it
    // lands before any enroll/sequence step runs. We deliberately do NOT stamp
    // cmaLink here: the CMA HTML isn't built yet, so the link would 404. cmaLink
    // is stamped at finalize (lib/cma-deliver.ts) once the page actually exists,
    // and that is what releases the sequence engine's %cma_link% hold-gate — so a
    // lead never receives an empty or dead CMA link.
    if (input.fubPersonId) {
      try {
        const { data: mirror } = await sb
          .from('crm_people')
          .select('id,custom')
          .eq('fub_legacy_id', input.fubPersonId)
          .maybeSingle()
        if (mirror) {
          const custom = { ...((mirror.custom as Record<string, unknown>) ?? {}), cmaSlug: slug }
          await sb.from('crm_people').update({ custom, updated_at: new Date().toISOString() }).eq('id', mirror.id)
        }
      } catch (e) {
        console.warn('[cma-request] cmaSlug stamp failed:', e instanceof Error ? e.message : String(e))
      }
    }

    return {
      ok: true,
      cmaId: cmaRow.id as string,
      actionId: actionRow.id as string,
      slug,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'unknown error in createCmaRequest',
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────

async function sendBrokerNotification(params: {
  brokerEmail: string | null
  brokerName: string | null
  cmaSlug: string
  subjectAddress: string
  leadName: string | null
  leadEmail: string
  leadPhone: string | null
  leadTimeline: string | null
}): Promise<void> {
  if (!params.brokerEmail) return
  const firstName = params.brokerName?.split(/\s+/)[0] ?? 'team'
  const leadDisplay = params.leadName ?? params.leadEmail
  const queueUrl = `${SITE_URL}/admin/cmas`
  const subject = `New CMA request — ${params.subjectAddress}`
  const text = [
    `Hi ${firstName},`,
    '',
    `New seller lead just submitted the home-value form:`,
    '',
    `  Property:  ${params.subjectAddress}`,
    `  Client:    ${leadDisplay}`,
    `  Email:     ${params.leadEmail}`,
    params.leadPhone ? `  Phone:     ${params.leadPhone}` : null,
    params.leadTimeline ? `  Timeline:  ${params.leadTimeline}` : null,
    '',
    `The request is queued in /admin/cmas as a draft (slug: ${params.cmaSlug}).`,
    `When you're ready, build the canonical CMA via the producer skill:`,
    `  marketing_brain_skills/producers/cma/SKILL.md`,
    '',
    `Open the queue: ${queueUrl}`,
    '',
    `— Ryan Realty automation`,
  ]
    .filter((line) => line !== null)
    .join('\n')

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#102742;max-width:560px;margin:0 auto;padding:24px;">
  <p>Hi ${firstName},</p>
  <p>New seller lead just submitted the home-value form:</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
    <tr><td style="padding:4px 0;color:#5b6473;width:90px;">Property:</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(params.subjectAddress)}</td></tr>
    <tr><td style="padding:4px 0;color:#5b6473;">Client:</td><td style="padding:4px 0;">${escapeHtml(leadDisplay)}</td></tr>
    <tr><td style="padding:4px 0;color:#5b6473;">Email:</td><td style="padding:4px 0;"><a href="mailto:${escapeHtml(params.leadEmail)}">${escapeHtml(params.leadEmail)}</a></td></tr>
    ${params.leadPhone ? `<tr><td style="padding:4px 0;color:#5b6473;">Phone:</td><td style="padding:4px 0;"><a href="tel:${escapeHtml(params.leadPhone)}">${escapeHtml(params.leadPhone)}</a></td></tr>` : ''}
    ${params.leadTimeline ? `<tr><td style="padding:4px 0;color:#5b6473;">Timeline:</td><td style="padding:4px 0;">${escapeHtml(params.leadTimeline)}</td></tr>` : ''}
  </table>
  <p>The request is queued in <strong>/admin/cmas</strong> as a draft (slug: <code>${escapeHtml(params.cmaSlug)}</code>). When you're ready, build the canonical CMA via the producer skill at <code>marketing_brain_skills/producers/cma/SKILL.md</code>.</p>
  <p><a href="${queueUrl}" style="display:inline-block;background:#102742;color:#faf8f4;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">Open the CMA queue</a></p>
  <p style="margin-top:24px;color:#5b6473;font-size:13px;">— Ryan Realty automation</p>
</div>
`.trim()

  await sendEmail({
    to: params.brokerEmail,
    subject,
    text,
    html,
    replyTo: params.leadEmail,
  })
}

async function sendLeadConfirmation(params: {
  leadEmail: string
  leadName: string | null
  subjectAddress: string
  brokerName: string | null
}): Promise<void> {
  // Suppression chokepoint (fails closed). A lead who opted out of email never
  // gets the confirmation by EITHER path (Gmail send-as-matt or Resend
  // fallback). No crm_person_id here, so gate by email.
  const sup = await isSuppressedByEmail(params.leadEmail, 'email')
  if (sup.suppressed) return

  const firstName = params.leadName?.split(/\s+/)[0] ?? 'there'
  const brokerFirst = params.brokerName?.split(/\s+/)[0] ?? 'one of our brokers'
  const subject = `We got your home value request — ${params.subjectAddress}`
  const text = [
    `Hi ${firstName},`,
    '',
    `Thanks for requesting a Comparative Market Analysis for ${params.subjectAddress}.`,
    '',
    `${brokerFirst} from Ryan Realty will pull recent comparable sales,`,
    `apply the right adjustments for your property, and email you a`,
    `personalized analysis within the next business day.`,
    '',
    `If you have anything you'd like us to know upfront, like recent`,
    `improvements, timing, or specific questions, just reply to this email.`,
    '',
    `Matt Ryan`,
    `Ryan Realty`,
    `541.703.3095`,
    `https://ryan-realty.com`,
  ].join('\n')

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#102742;max-width:560px;margin:0 auto;padding:24px;">
  <p>Hi ${escapeHtml(firstName)},</p>
  <p>Thanks for requesting a Comparative Market Analysis for <strong>${escapeHtml(params.subjectAddress)}</strong>.</p>
  <p>${escapeHtml(brokerFirst)} from Ryan Realty will pull recent comparable sales, apply the right adjustments for your property, and email you a personalized analysis within the next business day.</p>
  <p>If you have anything you'd like us to know upfront, like recent improvements, timing, or specific questions, just reply to this email.</p>
  <p style="margin-top:32px;color:#5b6473;font-size:13px;">
    Matt Ryan<br/>
    Ryan Realty<br/>
    <a href="tel:5417033095" style="color:#5b6473;">541.703.3095</a><br/>
    <a href="https://ryan-realty.com" style="color:#5b6473;">ryan-realty.com</a>
  </p>
</div>
`.trim()

  // Send from Matt's real Google Workspace mailbox (matt@ryan-realty.com) via
  // domain-wide-delegation impersonation — genuinely his address, lands in his
  // Sent folder, and replies thread straight to his inbox. No Resend-verified
  // sending domain required. (Matt 2026-06-05: "email is matt@ryan-realty.com" —
  // not the noreply, not the mail. subdomain.)
  const gmailRes = await sendGmailMessage({
    impersonateAs: 'matt@ryan-realty.com',
    to: params.leadEmail,
    subject,
    bodyText: text,
    bodyHtml: html,
    replyTo: 'matt@ryan-realty.com',
  })
  if (!gmailRes.ok) {
    // Suppression chokepoint (fails closed) — re-checked in this scope so the
    // Resend fallback to the lead is gated independently of the early return.
    if ((await isSuppressedByEmail(params.leadEmail, 'email')).suppressed) return
    // Graceful fallback so the acknowledgment never silently fails: send via
    // Resend from the verified mail.ryan-realty.com subdomain (display name still
    // reads "Matt Ryan", replies still route to his real inbox).
    console.warn(
      `[cma-request] Gmail send-as-matt failed (${gmailRes.error ?? 'unknown'}); falling back to Resend`,
    )
    await sendEmail({
      to: params.leadEmail,
      from: 'Matt Ryan <matt@mail.ryan-realty.com>',
      subject,
      text,
      html,
      replyTo: 'matt@ryan-realty.com',
    })
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

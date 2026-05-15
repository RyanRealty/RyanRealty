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

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.vercel.app').replace(/\/$/, '')

export type CreateCmaRequestInput = {
  rawAddress: string
  parsedStreet: string | null
  parsedCity: string | null
  parsedState: string | null
  parsedPostalCode: string | null
  leadEmail: string
  leadName?: string | null
  leadPhone?: string | null
  leadTimeline?: string | null
  leadClassification?: string | null
  fubPersonId?: number | null
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
    const leadEmail = input.leadEmail.toLowerCase().trim()
    const leadName = input.leadName?.trim() || null
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

    // Step 1: create the cmas draft row. ON CONFLICT (slug) preserves any
    // existing in-progress CMA for the same address — we update the client
    // info but don't blow away the broker's draft work.
    const { data: cmaRow, error: cmaErr } = await sb
      .from('cmas')
      .upsert(
        {
          slug,
          subject_address: rawAddress,
          subject_city: input.parsedCity,
          client_name: leadName,
          client_email: leadEmail,
          client_phone: input.leadPhone?.trim() || null,
          client_notes: input.leadTimeline
            ? `Lead timeline: ${input.leadTimeline}${input.leadClassification ? ` · classification: ${input.leadClassification}` : ''}`
            : null,
          broker_id: brokerId,
          broker_slug: broker.slug,
          status: 'draft',
          generation_reason: `Seller LP submission from ${leadEmail}${
            input.leadTimeline ? ` (${input.leadTimeline})` : ''
          }`,
        },
        { onConflict: 'slug' }
      )
      .select('id, slug')
      .single()
    if (cmaErr || !cmaRow) {
      return { ok: false, error: `cmas upsert failed: ${cmaErr?.message ?? 'no row'}` }
    }

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
          client_notes: input.leadTimeline
            ? `Lead timeline: ${input.leadTimeline}`
            : null,
        },
        data_evidence: {
          request_source: 'lead-form',
          client_relationship: 'cold-lead',
          fub_person_id: input.fubPersonId ?? null,
        },
        generation_reason: `Seller LP submission — ${leadName ?? leadEmail} requested a CMA for ${rawAddress}`,
        status: 'pending',
      })
      .select('id')
      .single()
    if (actionErr || !actionRow) {
      return {
        ok: false,
        error: `marketing_brain_actions insert failed: ${actionErr?.message ?? 'no row'}`,
      }
    }

    // Step 3 + 4: fire-and-forget the notification emails. We don't await —
    // the visitor sees a fast "we got it" response on the LP.
    void sendBrokerNotification({
      brokerEmail: broker.email,
      brokerName: broker.displayName,
      cmaSlug: slug,
      subjectAddress: rawAddress,
      leadName,
      leadEmail,
      leadPhone: input.leadPhone?.trim() || null,
      leadTimeline: input.leadTimeline ?? null,
    }).catch((e) => console.warn('[cma-request] broker notify failed:', e))

    void sendLeadConfirmation({
      leadEmail,
      leadName,
      subjectAddress: rawAddress,
      brokerName: broker.displayName,
    }).catch((e) => console.warn('[cma-request] lead confirmation failed:', e))

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
    `If you have anything you'd like us to know upfront — recent improvements,`,
    `timing, or specific questions — just reply to this email.`,
    '',
    `— Ryan Realty`,
    `541.213.6706`,
    `https://ryan-realty.com`,
  ].join('\n')

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#102742;max-width:560px;margin:0 auto;padding:24px;">
  <p>Hi ${escapeHtml(firstName)},</p>
  <p>Thanks for requesting a Comparative Market Analysis for <strong>${escapeHtml(params.subjectAddress)}</strong>.</p>
  <p>${escapeHtml(brokerFirst)} from Ryan Realty will pull recent comparable sales, apply the right adjustments for your property, and email you a personalized analysis within the next business day.</p>
  <p>If you have anything you'd like us to know upfront — recent improvements, timing, or specific questions — just reply to this email.</p>
  <p style="margin-top:32px;color:#5b6473;font-size:13px;">
    — Ryan Realty<br/>
    <a href="tel:5412136706" style="color:#5b6473;">541.213.6706</a><br/>
    <a href="https://ryan-realty.com" style="color:#5b6473;">ryan-realty.com</a>
  </p>
</div>
`.trim()

  await sendEmail({
    to: params.leadEmail,
    subject,
    text,
    html,
    // Replies route to the broker who will sign the CMA.
    replyTo: 'matt@ryan-realty.com',
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Auto-CMA delivery orchestrator.
 *
 * Called from the seller LP form (`submitSellerLPForm`) and the legacy
 * `/home-valuation` path. Lifts the address-to-property-id, computeCMA, PDF
 * render, Storage upload, broker resolution, and broker-review-email logic
 * out of the form-submit code so we have ONE auto-CMA pipeline.
 *
 * Flow:
 *   1. `createCmaDelivery` — synchronous insert of a `cma_deliveries` row in
 *      'pending' state. Returns the delivery id. Fast (single DB write).
 *   2. `processCmaDelivery` — async pipeline that resolves property id,
 *      computes the CMA, renders the PDF, uploads to Supabase Storage,
 *      composes the broker review email, and emails the assigned broker a
 *      signed preview link. Updates the row through 'in_production' → 'ready'.
 *
 * The broker reviews + sends from `/cma-drafts/<id>?token=<signed>`. The
 * actual email-to-the-lead happens in `sendCmaDelivery` (admin route),
 * which transitions the row to 'sent' and adds a FUB Note.
 */

import 'server-only'

import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'

import {
  computeCMA,
  getCachedCMA,
  type CMAResult,
} from '@/lib/cma'
import { CMAPdfDocument } from '@/lib/pdf/cma-pdf'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/resend'
import { signDeliveryToken } from '@/lib/cma-delivery-tokens'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com')
  .replace(/\/$/, '')

const STORAGE_BUCKET = 'cma-deliveries'

// ─── Public types ──────────────────────────────────────────────────────────

export type CreateCmaDeliveryInput = {
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

export type CmaDeliveryRow = {
  id: string
  status:
    | 'pending'
    | 'in_production'
    | 'ready'
    | 'sent'
    | 'no_match'
    | 'failed'
  lead_email: string
  lead_name: string | null
  raw_address: string
  property_id: string | null
  valuation_id: string | null
  cma_estimated_value: number | null
  cma_value_low: number | null
  cma_value_high: number | null
  cma_confidence: string | null
  pdf_storage_path: string | null
  assigned_broker_slug: string | null
  assigned_broker_email: string | null
  assigned_broker_name: string | null
  email_subject: string | null
  email_body_html: string | null
  email_body_text: string | null
  sent_at: string | null
  errors: unknown[]
  created_at: string
  updated_at: string
}

// ─── Stage 1: synchronous row insert ────────────────────────────────────────

export async function createCmaDelivery(
  input: CreateCmaDeliveryInput
): Promise<{ id: string } | { error: string }> {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('cma_deliveries')
      .insert({
        raw_address: input.rawAddress.trim(),
        parsed_street: input.parsedStreet,
        parsed_city: input.parsedCity,
        parsed_state: input.parsedState,
        parsed_postal_code: input.parsedPostalCode,
        lead_email: input.leadEmail.toLowerCase().trim(),
        lead_name: input.leadName?.trim() || null,
        lead_phone: input.leadPhone?.trim() || null,
        lead_timeline: input.leadTimeline ?? null,
        lead_classification: input.leadClassification ?? null,
        fub_person_id: input.fubPersonId ?? null,
        status: 'pending',
      })
      .select('id')
      .single()
    if (error || !data) {
      return { error: error?.message ?? 'insert failed' }
    }
    return { id: data.id as string }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'unknown error creating delivery row',
    }
  }
}

// ─── Stage 2: async pipeline (the heavy work) ──────────────────────────────

export async function processCmaDelivery(deliveryId: string): Promise<{
  ok: boolean
  status: CmaDeliveryRow['status']
  reason?: string
}> {
  const sb = createServiceClient()

  // ── Acquire the row + transition to in_production
  const { data: row, error: rowError } = await sb
    .from('cma_deliveries')
    .select('*')
    .eq('id', deliveryId)
    .maybeSingle()
  if (rowError || !row) {
    return { ok: false, status: 'failed', reason: 'delivery row not found' }
  }
  if (row.status === 'sent' || row.status === 'no_match') {
    return { ok: true, status: row.status as CmaDeliveryRow['status'] }
  }
  await sb
    .from('cma_deliveries')
    .update({ status: 'in_production' })
    .eq('id', deliveryId)

  const errors: Array<{ step: string; message: string }> = []

  // ── Step 1: resolve property id from the parsed address
  const propertyId = await findPropertyByAddress({
    street: (row.parsed_street as string | null) ?? null,
    city: (row.parsed_city as string | null) ?? '',
    state: (row.parsed_state as string | null) ?? null,
    postalCode: (row.parsed_postal_code as string | null) ?? null,
  })
  if (!propertyId) {
    await sb
      .from('cma_deliveries')
      .update({
        status: 'no_match',
        errors: [
          ...((row.errors as unknown[]) ?? []),
          { step: 'findPropertyByAddress', message: 'no MLS match for address' },
        ],
      })
      .eq('id', deliveryId)
    return {
      ok: false,
      status: 'no_match',
      reason: 'no MLS property match for ' + (row.raw_address as string),
    }
  }

  // ── Step 2: compute or hydrate the CMA
  let cma: CMAResult | null = null
  try {
    cma = (await getCachedCMA(propertyId)) ?? (await computeCMA(propertyId))
  } catch (e) {
    errors.push({
      step: 'computeCMA',
      message: e instanceof Error ? e.message : String(e),
    })
  }
  if (!cma) {
    await sb
      .from('cma_deliveries')
      .update({
        status: 'failed',
        property_id: propertyId,
        errors: [...((row.errors as unknown[]) ?? []), ...errors],
      })
      .eq('id', deliveryId)
    return { ok: false, status: 'failed', reason: 'CMA compute returned null' }
  }

  // ── Step 3: hydrate property + listing meta for the PDF cover
  const { data: prop } = await sb
    .from('properties')
    .select('unparsed_address, street_number, city, postal_code')
    .eq('id', propertyId)
    .single()
  const pAddr = prop as {
    unparsed_address?: string
    street_number?: string
    city?: string
    postal_code?: string
  } | null

  let listingMeta: {
    beds: number | null
    baths: number | null
    sqft: number | null
    photoUrl: string | null
    agentName: string | null
  } = { beds: null, baths: null, sqft: null, photoUrl: null, agentName: null }
  if (pAddr?.city) {
    let q = sb
      .from('listings')
      .select(
        'BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, PhotoURL, ListAgentName'
      )
      .ilike('City', pAddr.city)
    if (pAddr.street_number) q = q.eq('StreetNumber', pAddr.street_number)
    if (pAddr.postal_code) q = q.eq('PostalCode', pAddr.postal_code)
    const { data: matches } = await q
      .order('ModificationTimestamp', { ascending: false })
      .limit(1)
    const m = (matches as Array<Record<string, unknown>> | null)?.[0]
    if (m) {
      listingMeta = {
        beds: typeof m['BedroomsTotal'] === 'number' ? (m['BedroomsTotal'] as number) : null,
        baths: typeof m['BathroomsTotal'] === 'number' ? (m['BathroomsTotal'] as number) : null,
        sqft:
          typeof m['TotalLivingAreaSqFt'] === 'number'
            ? (m['TotalLivingAreaSqFt'] as number)
            : null,
        photoUrl: (m['PhotoURL'] as string | null) ?? null,
        agentName: (m['ListAgentName'] as string | null) ?? null,
      }
    }
  }

  const fullAddress =
    pAddr?.unparsed_address ?? (row.raw_address as string) ?? 'your home'

  // ── Step 4: render the CMA PDF to a Node Buffer
  let pdfBuffer: Buffer | null = null
  try {
    const doc = React.createElement(CMAPdfDocument, {
      data: {
        cma,
        address: fullAddress,
        beds: listingMeta.beds,
        baths: listingMeta.baths,
        sqft: listingMeta.sqft,
        lotAcres: null,
        yearBuilt: null,
        heroPhotoUrl: listingMeta.photoUrl,
        agentName: listingMeta.agentName,
        agentEmail: null,
        agentPhone: null,
      },
    })
    type DocElement = Parameters<typeof renderToBuffer>[0]
    pdfBuffer = Buffer.from(await renderToBuffer(doc as DocElement))
  } catch (e) {
    errors.push({
      step: 'renderToBuffer',
      message: e instanceof Error ? e.message : String(e),
    })
  }
  if (!pdfBuffer) {
    await sb
      .from('cma_deliveries')
      .update({
        status: 'failed',
        property_id: propertyId,
        valuation_id: cma.valuationId ?? null,
        cma_estimated_value: cma.estimatedValue ?? null,
        cma_value_low: cma.valueLow ?? null,
        cma_value_high: cma.valueHigh ?? null,
        cma_confidence: cma.confidence ?? null,
        errors: [...((row.errors as unknown[]) ?? []), ...errors],
      })
      .eq('id', deliveryId)
    return { ok: false, status: 'failed', reason: 'PDF render failed' }
  }

  // ── Step 5: upload PDF to Supabase Storage
  const storagePath = `${deliveryId}/cma.pdf`
  const { error: uploadError } = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })
  if (uploadError) {
    errors.push({ step: 'storage.upload', message: uploadError.message })
  }

  // ── Step 6: resolve the assigned broker (FUB-side routing is the source of truth)
  const assignedBroker = await resolveAssignedBroker({
    fubPersonId: (row.fub_person_id as number | null) ?? null,
  })

  // ── Step 7: compose the email body the broker will review + send
  const leadFirstName = (row.lead_name as string | null)?.trim().split(/\s+/)[0] ?? null
  const { subject, html, text } = composeCmaEmail({
    leadFirstName,
    fullAddress,
    cma,
    brokerName: assignedBroker?.displayName ?? null,
    brokerEmail: assignedBroker?.email ?? null,
    brokerPhone: assignedBroker?.phone ?? null,
  })

  // ── Step 8: persist the draft state → 'ready'
  await sb
    .from('cma_deliveries')
    .update({
      status: 'ready',
      property_id: propertyId,
      valuation_id: cma.valuationId ?? null,
      cma_estimated_value: cma.estimatedValue ?? null,
      cma_value_low: cma.valueLow ?? null,
      cma_value_high: cma.valueHigh ?? null,
      cma_confidence: cma.confidence ?? null,
      pdf_storage_path: storagePath,
      assigned_broker_slug: assignedBroker?.slug ?? null,
      assigned_broker_email: assignedBroker?.email ?? null,
      assigned_broker_name: assignedBroker?.displayName ?? null,
      broker_imessage_to: assignedBroker?.phone ?? null,
      email_subject: subject,
      email_body_html: html,
      email_body_text: text,
      errors: [...((row.errors as unknown[]) ?? []), ...errors],
    })
    .eq('id', deliveryId)

  // ── Step 9: notify the assigned broker by email (with signed preview link).
  // iMessage is intentionally not done from server code (osascript only works
  // locally on a Mac). The brain agent picks this up via `comms-matt-alert`
  // later if/when an iMessage producer can reach it.
  if (assignedBroker?.email) {
    const token = signDeliveryToken(deliveryId)
    const previewUrl = `${SITE_URL}/cma-drafts/${deliveryId}?token=${encodeURIComponent(token)}`
    const brokerNotify = composeBrokerReviewEmail({
      brokerFirstName: assignedBroker.displayName?.split(/\s+/)[0] ?? 'team',
      leadName: (row.lead_name as string | null) ?? row.lead_email,
      leadEmail: row.lead_email as string,
      fullAddress,
      cma,
      previewUrl,
    })
    const result = await sendEmail({
      to: assignedBroker.email,
      subject: brokerNotify.subject,
      html: brokerNotify.html,
      text: brokerNotify.text,
      replyTo: row.lead_email as string,
    })
    if (result.error) {
      errors.push({ step: 'broker-notify', message: result.error })
    }
  } else {
    errors.push({
      step: 'broker-notify',
      message: 'no assigned broker email available — review needed in admin queue',
    })
  }

  await sb
    .from('cma_deliveries')
    .update({
      broker_notified_at: new Date().toISOString(),
      errors: [...((row.errors as unknown[]) ?? []), ...errors],
    })
    .eq('id', deliveryId)

  return { ok: true, status: 'ready' }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// Strip common street-suffix abbreviations from the matchable parts so
// "19496 Tumalo Reservoir Rd" matches a properties row stored as
// "19496 Tumalo Reservoir Road" (and vice versa). USPS recognizes both
// long and short forms — MLS data is inconsistent across both. Just drop
// the suffix from the matching key.
const STREET_SUFFIXES = new Set([
  'rd', 'road',
  'st', 'street',
  'ave', 'avenue',
  'dr', 'drive',
  'ln', 'lane',
  'ct', 'court',
  'pl', 'place',
  'blvd', 'boulevard',
  'hwy', 'highway',
  'pkwy', 'parkway',
  'cir', 'circle',
  'way', 'trail', 'trl',
  'ter', 'terrace',
  'loop',
])

function dropStreetSuffix(parts: string[]): string[] {
  if (parts.length < 2) return parts
  const last = parts[parts.length - 1]?.toLowerCase()
  if (last && STREET_SUFFIXES.has(last)) {
    return parts.slice(0, -1)
  }
  return parts
}

async function findPropertyByAddress(params: {
  street: string | null
  city: string
  state: string | null
  postalCode: string | null
}): Promise<string | null> {
  const sb = createServiceClient()
  const city = params.city?.trim()
  if (!city) return null

  let q = sb
    .from('properties')
    .select('id, unparsed_address')
    .ilike('city', city)
  if (params.state?.trim()) q = q.ilike('state', params.state.trim())
  if (params.postalCode?.trim()) {
    q = q.eq('postal_code', params.postalCode.trim().slice(0, 20))
  }
  const { data } = await q.limit(20)
  if (!data?.length) return null

  const rawParts = (params.street ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
  // Drop the suffix token so "Rd" doesn't fail-to-substring-match "Road".
  const streetParts = dropStreetSuffix(rawParts)

  if (streetParts.length === 0) {
    return data.length === 1 ? (data[0] as { id: string }).id : null
  }
  for (const row of data as Array<{ id: string; unparsed_address?: string }>) {
    const addr = (row.unparsed_address ?? '').toLowerCase()
    if (streetParts.every((p) => addr.includes(p))) return row.id
  }
  return data.length === 1 ? (data[0] as { id: string }).id : null
}

type AssignedBroker = {
  slug: string
  displayName: string | null
  email: string | null
  phone: string | null
}

/**
 * Resolve which broker should review + send this CMA.
 *
 * Strategy (in order):
 *   1. If the FUB person already has an assigned user, look up that user's
 *      email and match it to a row in the `brokers` Supabase table.
 *   2. Otherwise, fall back to the env-configured default broker
 *      (CMA_DEFAULT_BROKER_SLUG, defaults to 'ryan-matt').
 *
 * Returns null only if no broker row is resolvable in either path.
 */
async function resolveAssignedBroker(params: {
  fubPersonId: number | null
}): Promise<AssignedBroker | null> {
  const sb = createServiceClient()

  // 1. FUB-assigned user → broker email match
  if (params.fubPersonId) {
    const fubUserEmail = await getFubAssignedUserEmail(params.fubPersonId)
    if (fubUserEmail) {
      const { data } = await sb
        .from('brokers')
        .select('slug, display_name, email, phone')
        .ilike('email', fubUserEmail)
        .eq('is_active', true)
        .limit(1)
      const row = (data as Array<{
        slug: string
        display_name: string | null
        email: string | null
        phone: string | null
      }> | null)?.[0]
      if (row?.slug) {
        return {
          slug: row.slug,
          displayName: row.display_name,
          email: row.email,
          phone: row.phone,
        }
      }
    }
  }

  // 2. Env default
  const defaultSlug = (process.env.CMA_DEFAULT_BROKER_SLUG ?? 'ryan-matt')
    .trim()
    .toLowerCase()
  const { data: defaultRow } = await sb
    .from('brokers')
    .select('slug, display_name, email, phone')
    .eq('slug', defaultSlug)
    .eq('is_active', true)
    .limit(1)
  const def = (defaultRow as Array<{
    slug: string
    display_name: string | null
    email: string | null
    phone: string | null
  }> | null)?.[0]
  if (def?.slug) {
    return {
      slug: def.slug,
      displayName: def.display_name,
      email: def.email,
      phone: def.phone,
    }
  }
  return null
}

async function getFubAssignedUserEmail(personId: number): Promise<string | null> {
  const apiKey = (
    process.env.FOLLOWUPBOSS_API_KEY ?? process.env.FUB_API_KEY ?? ''
  ).trim()
  if (!apiKey) return null
  try {
    const auth = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`
    const r = await fetch(
      `https://api.followupboss.com/v1/people/${personId}?fields=assignedUserId`,
      { headers: { Authorization: auth, Accept: 'application/json' } }
    )
    if (!r.ok) return null
    const personRow = (await r.json()) as { assignedUserId?: number | null }
    const userId = personRow.assignedUserId
    if (!userId || userId <= 0) return null
    const u = await fetch(`https://api.followupboss.com/v1/users/${userId}`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    })
    if (!u.ok) return null
    const userRow = (await u.json()) as { email?: string }
    return userRow.email?.trim() || null
  } catch {
    return null
  }
}

// ─── Email composition ─────────────────────────────────────────────────────

function formatUsd(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return '—'
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

export function composeCmaEmail(params: {
  leadFirstName: string | null
  fullAddress: string
  cma: CMAResult
  brokerName: string | null
  brokerEmail: string | null
  brokerPhone: string | null
}): { subject: string; html: string; text: string } {
  const { leadFirstName, fullAddress, cma, brokerName, brokerEmail, brokerPhone } =
    params
  const greeting = leadFirstName ? `Hi ${leadFirstName},` : 'Hi,'
  const value = formatUsd(cma.estimatedValue)
  const low = formatUsd(cma.valueLow)
  const high = formatUsd(cma.valueHigh)
  const range = low !== '—' && high !== '—' ? ` (range ${low}–${high})` : ''

  const subject = `Your Bend home value — ${fullAddress}`

  const text = [
    greeting,
    '',
    `Thanks for asking us to take a look at ${fullAddress}.`,
    '',
    `Based on actual recent sales near you, our best estimate is ${value}${range}.`,
    '',
    `The full report is attached — it walks through the comparable sales we used, what we adjusted for, and where the number could move.`,
    '',
    `If you want to talk through it — or if you'd rather we walk through in person — just reply to this email or call. No pressure either way.`,
    '',
    brokerName ? brokerName : 'Ryan Realty',
    brokerEmail || '',
    brokerPhone || '',
  ]
    .filter((l) => l !== null && l !== undefined)
    .join('\n')

  // Brand-voice compliant: no exclamation marks, no em-dashes-as-punctuation
  // (em-dash allowed as a data placeholder), tabular nums on the figures.
  const html = `
<div style="font-family:'Geist','Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.55;color:#102742;max-width:580px;margin:0 auto">
  <p>${greeting}</p>
  <p>Thanks for asking us to take a look at <strong>${escapeHtml(fullAddress)}</strong>.</p>
  <p>Based on actual recent sales near you, our best estimate is
    <strong style="font-variant-numeric:tabular-nums;font-size:18px">${escapeHtml(
      value
    )}</strong>${
      range ? `<span style="color:#102742aa">${escapeHtml(range)}</span>` : ''
    }.</p>
  <p>The full report is attached. It walks through the comparable sales we used, what we adjusted for, and where the number could move.</p>
  <p>If you want to talk through it, or have us walk through in person, just reply to this email or call. No pressure either way.</p>
  <p style="margin-top:28px">${escapeHtml(brokerName ?? 'Ryan Realty')}<br>
  ${brokerEmail ? `<a href="mailto:${encodeURIComponent(brokerEmail)}" style="color:#102742">${escapeHtml(brokerEmail)}</a><br>` : ''}
  ${brokerPhone ? `<a href="tel:${encodeURIComponent(brokerPhone)}" style="color:#102742">${escapeHtml(brokerPhone)}</a>` : ''}
  </p>
</div>`.trim()

  return { subject, html, text }
}

function composeBrokerReviewEmail(params: {
  brokerFirstName: string
  leadName: string
  leadEmail: string
  fullAddress: string
  cma: CMAResult
  previewUrl: string
}): { subject: string; html: string; text: string } {
  const { brokerFirstName, leadName, leadEmail, fullAddress, cma, previewUrl } =
    params
  const value = formatUsd(cma.estimatedValue)
  const subject = `Review + send CMA: ${leadName} · ${fullAddress}`

  const text = [
    `Hi ${brokerFirstName},`,
    '',
    `${leadName} (${leadEmail}) just requested a home value report.`,
    '',
    `Property: ${fullAddress}`,
    `CMA value: ${value}`,
    `Confidence: ${cma.confidence ?? 'medium'}`,
    '',
    `The PDF is generated and the email is drafted — review and send from:`,
    previewUrl,
    '',
    `Reply window: 5 minutes for hot leads is best for conversion.`,
    '',
    `— Ryan Realty auto-CMA`,
  ].join('\n')

  const html = `
<div style="font-family:'Geist','Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.55;color:#102742;max-width:580px;margin:0 auto">
  <p>Hi ${escapeHtml(brokerFirstName)},</p>
  <p><strong>${escapeHtml(leadName)}</strong> (<a href="mailto:${encodeURIComponent(leadEmail)}" style="color:#102742">${escapeHtml(leadEmail)}</a>) just requested a home value report.</p>
  <table style="border-collapse:collapse;margin:16px 0;font-size:15px">
    <tr><td style="padding:4px 16px 4px 0;color:#102742aa">Property</td><td style="padding:4px 0"><strong>${escapeHtml(fullAddress)}</strong></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#102742aa">CMA value</td><td style="padding:4px 0;font-variant-numeric:tabular-nums"><strong>${escapeHtml(value)}</strong></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#102742aa">Confidence</td><td style="padding:4px 0">${escapeHtml(cma.confidence ?? 'medium')}</td></tr>
  </table>
  <p>The PDF is generated and the email is drafted. Review + send from one place:</p>
  <p style="margin:20px 0">
    <a href="${previewUrl}" style="display:inline-block;background:#102742;color:#faf8f4;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600">Review and send</a>
  </p>
  <p style="color:#102742aa;font-size:13px">Reply within 5 minutes for hot leads is the conversion sweet spot.</p>
  <p style="color:#102742aa;font-size:13px;margin-top:32px">Ryan Realty auto-CMA</p>
</div>`.trim()

  return { subject, html, text }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * POST /api/listing-alerts/subscribe
 *
 * Inbound endpoint for the "Custom alerts" form on every community,
 * subdivision, and city LP. UPSERTs a row in public.listing_alerts keyed by
 * (email, source_lp), creates / updates the matching FUB person with the
 * canonical tag set, and fires a Meta CAPI Lead event for paid-ads attribution.
 *
 * Accepts BOTH JSON (preferred — for new components like TetherowBuyerForms
 * once it's wired) and multipart/form-data (legacy compatibility for any
 * form that hasn't been re-wired yet). See SKILL.md §2 for the
 * ListingAlertsSubscribePayload shape.
 *
 * No auth — this is a public POST consumed by an LP form. Bot guarding is
 * minimal (basic field validation + email shape + consent_marketing=true).
 *
 * Spec: marketing_brain_skills/producers/listing-alerts/SKILL.md §4.1 Step 8
 */
import { createHash } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase/service'
import {
  addPersonTags,
  assignPersonToUser,
  findPersonByEmail,
  sendEvent,
  setPersonCustomFields,
  type FubEventPerson,
} from '@/lib/followupboss'
import { sendServerEvent } from '@/lib/meta-capi'
import type {
  ListingAlertCriteria,
  ListingAlertsSubscribePayload,
} from '@/lib/listing-alerts/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
}

function siteHost(): string {
  return siteUrl()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty.com'
}

function clientIp(req: NextRequest): string | undefined {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0]?.trim()
  return req.headers.get('x-real-ip') ?? undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const t = value.trim()
  return t || undefined
}

function asBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const t = value.trim().toLowerCase()
    return t === '1' || t === 'true' || t === 'on' || t === 'yes'
  }
  return false
}

function summarizeCriteria(c: ListingAlertCriteria): string {
  const parts: string[] = []
  if (c.price_min || c.price_max) {
    parts.push(`$${(c.price_min / 1000).toFixed(0)}K-$${(c.price_max / 1000).toFixed(0)}K`)
  }
  if (c.beds_min) parts.push(`${c.beds_min}+ bed`)
  if (c.baths_min) parts.push(`${c.baths_min}+ bath`)
  if (c.sqft_min) parts.push(`${c.sqft_min}+ sqft`)
  if (c.subdivision) parts.push(c.subdivision)
  return parts.join(' · ')
}

async function readPayload(req: NextRequest): Promise<Record<string, unknown> | null> {
  const ct = req.headers.get('content-type') ?? ''
  try {
    if (ct.includes('application/json')) {
      return (await req.json()) as Record<string, unknown>
    }
    if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
      const fd = await req.formData()
      const obj: Record<string, unknown> = {}
      for (const [k, v] of fd.entries()) {
        if (k === 'utm' && typeof v === 'string') {
          try {
            obj.utm = JSON.parse(v)
            continue
          } catch {
            // fall through, treat as string
          }
        }
        obj[k] = v
      }
      // Allow form data to carry nested utm via individual utm_source etc.
      const utm: Record<string, string> = {}
      for (const k of ['source', 'medium', 'campaign', 'term', 'content']) {
        const v = obj[`utm_${k}`]
        if (typeof v === 'string' && v.trim()) utm[k] = v.trim()
      }
      if (Object.keys(utm).length > 0 && !obj.utm) obj.utm = utm
      return obj
    }
    // Fallback to JSON parse
    const text = await req.text()
    if (!text) return {}
    try {
      return JSON.parse(text) as Record<string, unknown>
    } catch {
      return null
    }
  } catch (err) {
    console.error('[listing-alerts/subscribe] payload parse failed:', err)
    return null
  }
}

function validate(payload: Record<string, unknown>): ListingAlertsSubscribePayload | string {
  const email = asString(payload.email)?.toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return 'Invalid email'
  const name = asString(payload.name)
  if (!name) return 'Missing name'
  const source_lp = asString(payload.source_lp) ?? asString(payload.campaign)
  if (!source_lp) return 'Missing source_lp'
  const community_slug = asString(payload.community_slug) ?? asString(payload.resort)
  const city_slug = asString(payload.city_slug) ?? asString(payload.city)
  if (!community_slug && !city_slug) return 'Provide community_slug or city_slug'

  const price_min = asNumber(payload.price_min)
  const price_max = asNumber(payload.price_max)
  const beds_min = asNumber(payload.beds_min)
  if (price_min == null || price_max == null) return 'Missing price_min or price_max'
  if (beds_min == null) return 'Missing beds_min'
  if (price_max < price_min) return 'price_max must be ≥ price_min'

  const consent_marketing = asBool(payload.consent_marketing) || asBool(payload.consent)
  if (!consent_marketing) return 'consent_marketing must be true'

  const baths_min = asNumber(payload.baths_min)
  const sqft_min = asNumber(payload.sqft_min)
  const property_type = asString(payload.property_type) ?? 'A'
  const subdivisionRaw = asString(payload.subdivision)
  const subdivision = subdivisionRaw && subdivisionRaw.toLowerCase() !== 'any' ? subdivisionRaw : undefined
  const consent_sms = asBool(payload.consent_sms)
  const utm = (typeof payload.utm === 'object' && payload.utm) ? (payload.utm as ListingAlertsSubscribePayload['utm']) : undefined

  return {
    email,
    name,
    source_lp,
    community_slug,
    city_slug,
    price_min,
    price_max,
    beds_min,
    baths_min,
    sqft_min,
    property_type,
    subdivision,
    consent_marketing: true,
    consent_sms,
    utm,
  }
}

export async function POST(req: NextRequest) {
  const raw = await readPayload(req)
  if (!raw) return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 })

  const validated = validate(raw)
  if (typeof validated === 'string') {
    return NextResponse.json({ ok: false, error: validated }, { status: 400 })
  }

  const supabase = createServiceClient()
  const criteria: ListingAlertCriteria = {
    price_min: validated.price_min,
    price_max: validated.price_max,
    beds_min: validated.beds_min,
    baths_min: validated.baths_min,
    sqft_min: validated.sqft_min,
    property_type: validated.property_type,
    subdivision: validated.subdivision,
  }

  // UPSERT by (email, source_lp). If the row exists in 'unsubscribed' status,
  // a re-subscribe flips it back to active (subscriber explicitly came back
  // through the form — that's a valid resubscribe signal).
  const { data: upsertData, error: upsertError } = await supabase
    .from('listing_alerts')
    .upsert(
      {
        email: validated.email,
        name: validated.name,
        source_lp: validated.source_lp,
        community_slug: validated.community_slug ?? null,
        city_slug: validated.city_slug ?? null,
        criteria,
        status: 'active',
        paused_until: null,
        pause_reason: null,
        unsubscribed_at: null,
        utm: validated.utm ?? null,
        consent_marketing: true,
        consent_sms: !!validated.consent_sms,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email,source_lp', ignoreDuplicates: false },
    )
    .select('id, unsubscribe_token')
    .single()

  if (upsertError || !upsertData) {
    console.error('[listing-alerts/subscribe] upsert failed:', upsertError)
    return NextResponse.json({ ok: false, error: 'Database upsert failed' }, { status: 500 })
  }
  const alertId = upsertData.id as string

  // FUB integration — fire and continue. Don't block the response on FUB failures.
  let fubPersonId: number | null = null
  try {
    const [firstName, ...rest] = validated.name.trim().split(/\s+/)
    const lastName = rest.join(' ').trim() || undefined

    const existing = await findPersonByEmail(validated.email)
    const person: FubEventPerson = existing
      ? { id: existing.id }
      : {
          firstName: firstName || undefined,
          lastName,
          emails: [{ value: validated.email }],
        }

    const tags = ['buyer-intent', 'listing-alerts-subscriber', `source-lp:${validated.source_lp}`]
    if (validated.community_slug) tags.push(`resort:${validated.community_slug}`)
    if (validated.city_slug) tags.push(`city:${validated.city_slug}`)

    const summary = summarizeCriteria(criteria)
    const eventResult = await sendEvent({
      type: 'Saved Property Search',
      person,
      source: siteHost(),
      system: 'Ryan Realty Website',
      sourceUrl: `${siteUrl()}/lp/${validated.community_slug ?? validated.city_slug ?? ''}`,
      message: `Listing alerts subscriber: ${summary || 'no summary'}`,
      campaign: validated.utm
        ? {
            source: validated.utm.source,
            medium: validated.utm.medium,
            campaign: validated.utm.campaign,
            term: validated.utm.term,
            content: validated.utm.content,
          }
        : undefined,
    })

    const refreshed = await findPersonByEmail(validated.email)
    fubPersonId = refreshed?.id ?? null

    if (fubPersonId) {
      await addPersonTags(fubPersonId, tags).catch(() => null)
      await setPersonCustomFields(fubPersonId, {
        customListingAlertCriteria: summary,
        customListingAlertSourceLp: validated.source_lp,
      }).catch(() => null)
      // Default route every new subscriber to Matt per the 2026-05-17 directive.
      // FOLLOWUPBOSS_DEFAULT_ASSIGNED_USER_ID overrides if set.
      const defaultUserId =
        Number(process.env.FOLLOWUPBOSS_DEFAULT_ASSIGNED_USER_ID ?? '1') || 1
      await assignPersonToUser(fubPersonId, defaultUserId).catch(() => null)
    }

    if (!eventResult.ok) {
      console.warn('[listing-alerts/subscribe] FUB sendEvent failed:', eventResult.error)
    }

    if (fubPersonId) {
      await supabase
        .from('listing_alerts')
        .update({ fub_lead_id: String(fubPersonId) })
        .eq('id', alertId)
        .catch(() => null)
    }
  } catch (err) {
    console.error('[listing-alerts/subscribe] FUB integration error (non-fatal):', err)
  }

  // Meta CAPI Lead event (server-side; the browser pixel fires the matching
  // event_id so de-dup happens automatically).
  try {
    const eventId = `listing_alerts_${alertId}`
    await sendServerEvent(
      'Lead',
      {
        em: sha256(validated.email),
        client_ip_address: clientIp(req),
        client_user_agent: req.headers.get('user-agent') ?? undefined,
      },
      {
        content_name: 'listing-alerts-subscribe',
        content_category: validated.community_slug ?? validated.city_slug,
        source_lp: validated.source_lp,
        value: 100,
        currency: 'USD',
      },
      eventId,
      `${siteUrl()}/lp/${validated.community_slug ?? validated.city_slug ?? ''}`,
    )
  } catch (err) {
    console.warn('[listing-alerts/subscribe] Meta CAPI failed (non-fatal):', err)
  }

  return NextResponse.json({
    ok: true,
    success: true,
    alert_id: alertId,
    fub_person_id: fubPersonId,
  })
}

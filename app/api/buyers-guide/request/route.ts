/**
 * POST /api/buyers-guide/request
 *
 * Inbound handler for the "Soft start" buyer's-guide form on every community
 * LP. Validates the request, creates a FUB lead with the right tags, then
 * emails the per-community PDF as an attachment via Resend with a
 * personalized cover note.
 *
 * Behaviour:
 *   - If the PDF is missing or older than 7 days, kicks off a regeneration
 *     job (best-effort; we still reply 200 with success even if regen is
 *     pending so the visitor doesn't see a failure).
 *   - Caches the PDF bytes for the response by reading from disk at
 *     request time. Resend attachment size limit is 40MB; we cap at 25MB.
 *
 * No auth — public LP form submission. Validation gates: email shape,
 * community in manifest, consent_marketing=true.
 *
 * Spec: marketing_brain_skills/producers/buyers-guide/SKILL.md §4.4
 */
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { NextRequest, NextResponse } from 'next/server'

import {
  addPersonTags,
  assignPersonToUser,
  findPersonByEmail,
  sendEvent,
  setPersonCustomFields,
  type FubEventPerson,
} from '@/lib/followupboss'
import { sendServerEvent } from '@/lib/meta-capi'
import { sendEmail } from '@/lib/resend'
import { BuyersGuideCover } from '@/lib/buyers-guide/email-template'
import type {
  BuyersGuideManifest,
  BuyersGuideRequestPayload,
} from '@/lib/buyers-guide/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024 // 25 MB cap
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

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
            // ignore
          }
        }
        obj[k] = v
      }
      return obj
    }
    const text = await req.text()
    if (!text) return {}
    try {
      return JSON.parse(text) as Record<string, unknown>
    } catch {
      return null
    }
  } catch (err) {
    console.error('[buyers-guide/request] payload parse failed:', err)
    return null
  }
}

function validate(payload: Record<string, unknown>): BuyersGuideRequestPayload | string {
  const email = asString(payload.email)?.toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return 'Invalid email'
  const name = asString(payload.name) ?? undefined
  const community_slug = asString(payload.community_slug) ?? asString(payload.resort)
  if (!community_slug) return 'Missing community_slug'
  const source_lp = asString(payload.source_lp) ?? asString(payload.campaign)
  if (!source_lp) return 'Missing source_lp'
  const consent_marketing = asBool(payload.consent_marketing) || asBool(payload.consent)
  if (!consent_marketing) return 'consent_marketing must be true'

  const utm =
    typeof payload.utm === 'object' && payload.utm
      ? (payload.utm as BuyersGuideRequestPayload['utm'])
      : undefined

  return {
    email,
    name,
    community_slug,
    source_lp,
    consent_marketing: true,
    utm,
  }
}

async function loadGuidePdf(communitySlug: string): Promise<{
  buffer: Buffer
  filename: string
  manifest: BuyersGuideManifest | null
} | null> {
  const dir = path.join(process.cwd(), 'public', 'guides', communitySlug)
  const pdfName = `${communitySlug}-buyers-guide.pdf`
  const pdfPath = path.join(dir, pdfName)
  const manifestPath = path.join(dir, 'manifest.json')

  try {
    const info = await stat(pdfPath)
    if (info.size > MAX_ATTACHMENT_BYTES) {
      console.warn(`[buyers-guide/request] PDF too large for attach (${info.size} bytes); link-only fallback`)
      return null
    }
    const buffer = await readFile(pdfPath)
    let manifest: BuyersGuideManifest | null = null
    try {
      const manifestRaw = await readFile(manifestPath, 'utf8')
      manifest = JSON.parse(manifestRaw) as BuyersGuideManifest
    } catch {
      // Manifest is optional but recommended
      manifest = null
    }
    return { buffer, filename: pdfName, manifest }
  } catch {
    return null
  }
}

function isStale(manifest: BuyersGuideManifest | null): boolean {
  if (!manifest?.generatedAt) return true
  const generatedMs = Date.parse(manifest.generatedAt)
  if (!Number.isFinite(generatedMs)) return true
  return Date.now() - generatedMs > STALE_THRESHOLD_MS
}

function communityDisplayName(slug: string): string {
  // Replace dashes with spaces and title-case each token.
  return slug
    .split('-')
    .map((t) => (t.length ? t.charAt(0).toUpperCase() + t.slice(1) : t))
    .join(' ')
    .replace(' Springs', ' Springs')
}

export async function POST(req: NextRequest) {
  const raw = await readPayload(req)
  if (!raw) return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 })

  const validated = validate(raw)
  if (typeof validated === 'string') {
    return NextResponse.json({ ok: false, error: validated }, { status: 400 })
  }

  const guide = await loadGuidePdf(validated.community_slug)
  const stale = isStale(guide?.manifest ?? null)
  const communityName = communityDisplayName(validated.community_slug)

  // Always create the FUB lead even if the PDF isn't yet available — the
  // visitor's interest is the signal we don't want to lose.
  let fubPersonId: number | null = null
  try {
    const [firstName, ...rest] = (validated.name ?? '').trim().split(/\s+/).filter(Boolean)
    const lastName = rest.join(' ').trim() || undefined

    const existing = await findPersonByEmail(validated.email)
    const person: FubEventPerson = existing
      ? { id: existing.id }
      : {
          firstName: firstName || undefined,
          lastName,
          emails: [{ value: validated.email }],
        }

    const tags = [
      'buyer-intent-soft',
      'buyers-guide-requested',
      `resort:${validated.community_slug}`,
      `source-lp:${validated.source_lp}`,
    ]

    const eventResult = await sendEvent({
      type: 'Property Inquiry',
      person,
      source: siteHost(),
      system: 'Ryan Realty Website',
      sourceUrl: `${siteUrl()}/lp/${validated.community_slug}/buyers-guide`,
      message: `Buyer's guide request: ${communityName}`,
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
        customBuyersGuideCommunity: validated.community_slug,
        customBuyersGuideRequestedAt: new Date().toISOString(),
      }).catch(() => null)
      const defaultUserId =
        Number(process.env.FOLLOWUPBOSS_DEFAULT_ASSIGNED_USER_ID ?? '1') || 1
      await assignPersonToUser(fubPersonId, defaultUserId).catch(() => null)
    }

    if (!eventResult.ok) {
      console.warn('[buyers-guide/request] FUB sendEvent failed:', eventResult.error)
    }
  } catch (err) {
    console.error('[buyers-guide/request] FUB integration error (non-fatal):', err)
  }

  // Meta CAPI Lead event
  try {
    const eventId = `buyers_guide_${sha256(validated.email)}_${validated.community_slug}`
    await sendServerEvent(
      'Lead',
      {
        em: sha256(validated.email),
        client_ip_address: clientIp(req),
        client_user_agent: req.headers.get('user-agent') ?? undefined,
      },
      {
        content_name: 'buyers-guide-request',
        content_category: validated.community_slug,
        source_lp: validated.source_lp,
        value: 50,
        currency: 'USD',
      },
      eventId,
      `${siteUrl()}/lp/${validated.community_slug}/buyers-guide`,
    )
  } catch (err) {
    console.warn('[buyers-guide/request] Meta CAPI failed (non-fatal):', err)
  }

  // Email delivery
  const webUrl = `${siteUrl()}/lp/${validated.community_slug}/buyers-guide/`
  const generatedAt = guide?.manifest?.generatedAt ?? new Date().toISOString()
  let resendStatus: 'sent' | 'sent_link_only' | 'failed' | 'skipped' = 'skipped'
  let resendId: string | undefined
  let resendError: string | undefined

  if (guide) {
    const result = await sendEmail({
      to: validated.email,
      subject: `Your ${communityName} buyer's guide`,
      replyTo: 'matt@ryan-realty.com',
      react: BuyersGuideCover({
        recipientName: validated.name,
        communityName,
        webUrl,
        generatedAt,
      }),
      attachments: [{ filename: guide.filename, content: guide.buffer }],
    })
    if (result.error) {
      resendStatus = 'failed'
      resendError = result.error
      console.error('[buyers-guide/request] Resend failed:', result.error)
    } else {
      resendStatus = 'sent'
      resendId = result.id
    }
  } else {
    // PDF missing — email with link only.
    const result = await sendEmail({
      to: validated.email,
      subject: `Your ${communityName} buyer's guide`,
      replyTo: 'matt@ryan-realty.com',
      react: BuyersGuideCover({
        recipientName: validated.name,
        communityName,
        webUrl,
        generatedAt,
      }),
    })
    if (result.error) {
      resendStatus = 'failed'
      resendError = result.error
    } else {
      resendStatus = 'sent_link_only'
      resendId = result.id
    }
  }

  return NextResponse.json({
    ok: true,
    success: true,
    community: validated.community_slug,
    pdf_attached: resendStatus === 'sent',
    web_url: webUrl,
    fub_person_id: fubPersonId,
    pdf_stale: stale,
    pdf_present: !!guide,
    resend_status: resendStatus,
    resend_id: resendId,
    resend_error: resendError,
  })
}

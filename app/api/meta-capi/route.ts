import { NextRequest, NextResponse } from 'next/server'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex } from '@noble/hashes/utils'
import { sendServerEvent, type MetaCapiUserData } from '@/lib/meta-capi'
import { shouldExcludeFromSharing } from '@/lib/crm/gpc'
import { getPersonIdsByEmail } from '@/lib/data/crm/getPersonIdsByEmail'
import { getPersonSuppressions } from '@/lib/data/crm/getPersonSuppressions'

export const runtime = 'nodejs'

const CORS_ALLOWED_ORIGINS = new Set([
  'https://ryan-realty.com',
  'https://www.ryan-realty.com',
  'https://seller.ryan-realty.com',
  'https://buyer.ryan-realty.com',
])

function corsHeadersFor(origin: string | null): Record<string, string> {
  if (!origin || !CORS_ALLOWED_ORIGINS.has(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: corsHeadersFor(origin) })
}

/**
 * POST /api/meta-capi
 *
 * Receives form data, hashes PII with SHA-256, reads _fbp/_fbc from cookies
 * (or from request body for cross-origin callers e.g. ryan-realty.com),
 * captures client IP and user agent, and forwards to Meta Conversions API.
 * Never throws — logs and returns gracefully to avoid blocking upstream flows (CRM submit, etc).
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const cors = corsHeadersFor(origin)

  try {
    const body = await req.json()
    const {
      eventName,
      email,
      phone,
      firstName,
      lastName,
      eventId,
      customData,
      eventSourceUrl,
      fbp: bodyFbp,
      fbc: bodyFbc,
      clientIp: bodyClientIp,
      clientUserAgent: bodyClientUserAgent,
      ldu: bodyLdu,
    } = body as {
      eventName?: string
      email?: string
      phone?: string
      firstName?: string
      lastName?: string
      eventId?: string
      customData?: Record<string, unknown>
      eventSourceUrl?: string
      fbp?: string
      fbc?: string
      clientIp?: string
      clientUserAgent?: string
      ldu?: boolean
    }

    if (!eventName) {
      return NextResponse.json({ ok: false, error: 'eventName required' }, { status: 400, headers: cors })
    }

    // Hash PII with SHA-256
    const hashPII = (value: string | undefined): string | undefined => {
      if (!value?.trim()) return undefined
      const trimmed = value.trim().toLowerCase()
      return bytesToHex(sha256(trimmed))
    }

    const userData: MetaCapiUserData = {
      em: hashPII(email),
      ph: hashPII(phone),
      fn: hashPII(firstName),
      ln: hashPII(lastName),
    }

    // Read _fbp and _fbc from cookies first; fall back to body fields for
    // cross-origin callers (e.g. ryan-realty.com JS mirror) where browser
    // cookies aren't sent with the request.
    const cookies = req.cookies.getAll()
    const fbpCookie = cookies.find((c) => c.name === '_fbp')
    const fbcCookie = cookies.find((c) => c.name === '_fbc')
    if (fbpCookie) userData.fbp = fbpCookie.value
    else if (bodyFbp) userData.fbp = bodyFbp
    if (fbcCookie) userData.fbc = fbcCookie.value
    else if (bodyFbc) userData.fbc = bodyFbc

    // Capture client IP. Server-action callers fetch this route server-to-server,
    // so request headers carry Vercel's egress IP / Node's UA — they forward the
    // real visitor values in the body instead. Body wins when present.
    const clientIp =
      bodyClientIp?.trim() ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      req.headers.get('cf-connecting-ip') ||
      undefined
    if (clientIp) userData.client_ip_address = clientIp

    // Capture user agent (same body-first rule as IP)
    const userAgent = bodyClientUserAgent?.trim() || req.headers.get('user-agent') || undefined
    if (userAgent) userData.client_user_agent = userAgent

    // Limited Data Use (CCPA/CPRA): honor the visitor's marketing-consent cookie
    // (same-origin client calls carry it); server-to-server callers pass `ldu` in
    // the body. When marketing consent is not granted, send the conversion in LDU
    // mode — consistent with the always-on pixel (components/MetaPixel.tsx).
    let ldu = false
    const consentCookie = cookies.find((c) => c.name === 'ryan_realty_cookie_consent')
    if (consentCookie) {
      try {
        ldu = !JSON.parse(decodeURIComponent(consentCookie.value)).marketing
      } catch {
        ldu = consentCookie.value !== 'all'
      }
    } else if (typeof bodyLdu === 'boolean') {
      ldu = bodyLdu
    }

    // Opt-out -> force Limited Data Use (Phase 8.1). When the subject is a known
    // CRM person who carries ANY suppression (a GPC opt-out, a hard-stop, an
    // unsubscribe), Meta must not use this conversion for ad targeting. We
    // resolve the subject by email, read their suppressions, and let the PURE
    // shouldExcludeFromSharing helper decide. This can only turn LDU ON, never
    // off -- a cookie/body LDU=true is never downgraded. Best-effort + never
    // throws: a lookup failure leaves the existing LDU decision untouched.
    if (!ldu && email?.trim()) {
      try {
        const personIds = await getPersonIdsByEmail(email)
        for (const pid of personIds) {
          const suppressions = await getPersonSuppressions(pid)
          if (shouldExcludeFromSharing(suppressions)) {
            ldu = true
            break
          }
        }
      } catch (e) {
        console.warn('[Meta CAPI] suppression LDU check failed:', e instanceof Error ? e.message : String(e))
      }
    }

    // Send to Meta CAPI
    const res = await sendServerEvent(
      eventName,
      userData,
      customData,
      eventId,
      eventSourceUrl,
      ldu
    )

    if (!res.ok) {
      console.warn(`[Meta CAPI] sendServerEvent failed for event "${eventName}":`, res.error)
      // Still return 200 so upstream doesn't fail
      return NextResponse.json(
        { ok: true, warning: `CAPI send failed: ${res.error}`, eventId },
        { status: 200, headers: cors }
      )
    }

    return NextResponse.json({ ok: true, eventId }, { status: 200, headers: cors })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Meta CAPI] Unexpected error:', msg)
    // Graceful fallback — never block upstream
    return NextResponse.json(
      { ok: true, warning: `CAPI error: ${msg}` },
      { status: 200, headers: cors }
    )
  }
}

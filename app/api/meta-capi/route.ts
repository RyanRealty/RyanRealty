import { NextRequest, NextResponse } from 'next/server'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex } from '@noble/hashes/utils'
import { sendServerEvent, type MetaCapiUserData } from '@/lib/meta-capi'

export const runtime = 'nodejs'

/**
 * POST /api/meta-capi
 *
 * Receives form data, hashes PII with SHA-256, reads _fbp/_fbc from cookies,
 * captures client IP and user agent, and forwards to Meta Conversions API.
 * Never throws — logs and returns gracefully to avoid blocking upstream flows (CRM submit, etc).
 */
export async function POST(req: NextRequest) {
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
    } = body as {
      eventName?: string
      email?: string
      phone?: string
      firstName?: string
      lastName?: string
      eventId?: string
      customData?: Record<string, unknown>
      eventSourceUrl?: string
    }

    if (!eventName) {
      return NextResponse.json({ ok: false, error: 'eventName required' }, { status: 400 })
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

    // Read _fbp and _fbc from cookies
    const cookies = req.cookies.getAll()
    const fbpCookie = cookies.find((c) => c.name === '_fbp')
    const fbcCookie = cookies.find((c) => c.name === '_fbc')
    if (fbpCookie) userData.fbp = fbpCookie.value
    if (fbcCookie) userData.fbc = fbcCookie.value

    // Capture client IP (try multiple headers for proxies)
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      req.headers.get('cf-connecting-ip') ||
      undefined
    if (clientIp) userData.client_ip_address = clientIp

    // Capture user agent
    const userAgent = req.headers.get('user-agent') || undefined
    if (userAgent) userData.client_user_agent = userAgent

    // Send to Meta CAPI
    const res = await sendServerEvent(
      eventName,
      userData,
      customData,
      eventId,
      eventSourceUrl
    )

    if (!res.ok) {
      console.warn(`[Meta CAPI] sendServerEvent failed for event "${eventName}":`, res.error)
      // Still return 200 so upstream doesn't fail
      return NextResponse.json(
        { ok: true, warning: `CAPI send failed: ${res.error}`, eventId },
        { status: 200 }
      )
    }

    return NextResponse.json({ ok: true, eventId }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Meta CAPI] Unexpected error:', msg)
    // Graceful fallback — never block upstream
    return NextResponse.json(
      { ok: true, warning: `CAPI error: ${msg}` },
      { status: 200 }
    )
  }
}

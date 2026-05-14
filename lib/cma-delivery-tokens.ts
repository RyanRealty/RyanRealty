/**
 * Signed HMAC tokens that let an assigned broker open a `/cma-drafts/<id>`
 * preview page from an iMessage / email link without logging in to admin.
 *
 * Token format: `<expiryEpochMs>.<base64UrlHmac>`.
 *
 * The HMAC is computed over `${deliveryId}:${expiryEpochMs}` using
 * CMA_PREVIEW_SECRET (falls back to SUPABASE_SERVICE_ROLE_KEY in dev so we
 * never accidentally ship a deploy without one — but production MUST set
 * CMA_PREVIEW_SECRET explicitly per the env audit doc).
 *
 * Tokens default to a 14-day lifetime (slow seller cycle — a broker on
 * vacation should still be able to send when they get back).
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

const DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

function getSecret(): string {
  const explicit = process.env.CMA_PREVIEW_SECRET?.trim()
  if (explicit) return explicit
  // Fallback so dev environments don't silently 401. In production an env
  // audit should fail-fast if CMA_PREVIEW_SECRET is missing.
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (fallback) return `dev-fallback:${fallback}`
  throw new Error(
    'CMA_PREVIEW_SECRET (or SUPABASE_SERVICE_ROLE_KEY) must be set to sign preview tokens'
  )
}

function base64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64Url(s: string): Buffer {
  const pad = (4 - (s.length % 4)) % 4
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad)
  return Buffer.from(b64, 'base64')
}

function computeMac(deliveryId: string, expiryEpochMs: number): string {
  const h = createHmac('sha256', getSecret())
  h.update(`${deliveryId}:${expiryEpochMs}`)
  return base64Url(h.digest())
}

export function signDeliveryToken(
  deliveryId: string,
  ttlMs: number = DEFAULT_TTL_MS
): string {
  const expiry = Date.now() + ttlMs
  const mac = computeMac(deliveryId, expiry)
  return `${expiry}.${mac}`
}

export type TokenVerification =
  | { ok: true; expiresAt: Date }
  | { ok: false; reason: 'malformed' | 'expired' | 'mismatch' }

export function verifyDeliveryToken(
  deliveryId: string,
  token: string | null | undefined
): TokenVerification {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'malformed' }
  const sep = token.indexOf('.')
  if (sep < 1) return { ok: false, reason: 'malformed' }
  const expiryStr = token.slice(0, sep)
  const mac = token.slice(sep + 1)
  const expiry = Number.parseInt(expiryStr, 10)
  if (!Number.isFinite(expiry) || expiry <= 0) return { ok: false, reason: 'malformed' }
  if (Date.now() > expiry) return { ok: false, reason: 'expired' }
  const expected = computeMac(deliveryId, expiry)
  try {
    const a = fromBase64Url(mac)
    const b = fromBase64Url(expected)
    if (a.length !== b.length) return { ok: false, reason: 'mismatch' }
    if (!timingSafeEqual(a, b)) return { ok: false, reason: 'mismatch' }
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  return { ok: true, expiresAt: new Date(expiry) }
}

/**
 * F2 guest habit residual — first-party product memory after a guest sets a
 * listing alert, so a return visit can show a soft "You're watching …" loop
 * without an account.
 *
 * Consent-safe by design:
 *   - localStorage only (this browser; no server sync, no cross-device)
 *   - NO email, phone, name, tokens, or CRM ids
 *   - Only a short human label + relative browse href the guest already chose
 *   - Explicit dismiss; auto-expires after TTL
 *
 * Manage/pause still happens via the alert email unsubscribe link (token
 * already emailed). Guests who create an account get the full /account feed;
 * claim-on-login already attaches listing_alerts by verified email.
 */

import {
  buildSearchUrlFromFilters,
  getFilterNameFallback,
  getFiltersSummary,
} from '@/lib/search-filters'

export const GUEST_WATCH_STORAGE_KEY = 'rr_guest_alert_watch'
export const GUEST_WATCH_DISMISS_KEY = 'rr_guest_alert_watch_dismissed'

/** Residual lives 90 days unless dismissed sooner. */
export const GUEST_WATCH_TTL_MS = 90 * 24 * 60 * 60 * 1000

/** After dismiss, do not re-show for 14 days (even if residual still present). */
export const GUEST_WATCH_DISMISS_MS = 14 * 24 * 60 * 60 * 1000

const LABEL_MAX = 80
const HREF_MAX = 400

export type GuestWatchResidual = {
  /** Human label, e.g. "Bend homes" — never PII. */
  label: string
  /** Relative path only, e.g. /homes-for-sale/bend */
  href: string
  /** Unix ms when the guest set the alert. */
  setAt: number
}

function isSafeRelativeHref(href: string): boolean {
  if (!href.startsWith('/')) return false
  if (href.startsWith('//')) return false
  if (href.includes('://')) return false
  if (href.includes('\\')) return false
  // Block javascript: / data: smuggled after encoding
  const lower = href.toLowerCase()
  if (lower.includes('javascript:') || lower.includes('data:')) return false
  return href.length <= HREF_MAX
}

function sanitizeLabel(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'your search'
  return cleaned.length > LABEL_MAX ? `${cleaned.slice(0, LABEL_MAX - 1)}…` : cleaned
}

/**
 * Pure parser — unit-testable without DOM. Returns null when the payload is
 * missing, expired, or unsafe.
 */
export function parseGuestWatch(raw: string | null | undefined, now = Date.now()): GuestWatchResidual | null {
  if (!raw || typeof raw !== 'string') return null
  try {
    const data = JSON.parse(raw) as Partial<GuestWatchResidual>
    if (!data || typeof data !== 'object') return null
    if (typeof data.label !== 'string' || typeof data.href !== 'string') return null
    if (typeof data.setAt !== 'number' || !Number.isFinite(data.setAt)) return null
    if (now - data.setAt > GUEST_WATCH_TTL_MS) return null
    if (data.setAt > now + 60_000) return null // reject far-future stamps
    if (!isSafeRelativeHref(data.href)) return null
    return {
      label: sanitizeLabel(data.label),
      href: data.href.slice(0, HREF_MAX),
      setAt: data.setAt,
    }
  } catch {
    return null
  }
}

export function serializeGuestWatch(residual: GuestWatchResidual): string {
  return JSON.stringify({
    label: sanitizeLabel(residual.label),
    href: residual.href.slice(0, HREF_MAX),
    setAt: residual.setAt,
  })
}

/** Build residual from the same filters the guest just saved (no email). */
export function buildGuestWatchFromFilters(
  filters: Record<string, unknown>,
  now = Date.now(),
): GuestWatchResidual {
  const name = getFilterNameFallback(filters)
  const summary = getFiltersSummary(filters)
  // Prefer short place-style name; fall back to summary when name is generic.
  const label =
    name && name !== 'Popular search'
      ? name
      : summary && summary !== 'Any filters'
        ? summary
        : 'homes you chose'
  const href = buildSearchUrlFromFilters(filters)
  return {
    label: sanitizeLabel(label),
    href: isSafeRelativeHref(href) ? href : '/search',
    setAt: now,
  }
}

/** Build residual from a known community/city page (KbCommunityAlerts). */
export function buildGuestWatchFromPlace(input: {
  communityName?: string
  city?: string
  subdivision?: string
  extraFilters?: Record<string, string>
  now?: number
}): GuestWatchResidual {
  const filters: Record<string, unknown> = {
    ...(input.city ? { city: input.city } : {}),
    ...(input.subdivision ? { subdivision: input.subdivision } : {}),
    ...(input.extraFilters ?? {}),
  }
  if (Object.keys(filters).length > 0) {
    return buildGuestWatchFromFilters(filters, input.now)
  }
  const label = input.communityName?.trim() || 'your search'
  return {
    label: sanitizeLabel(label.includes('home') ? label : `${label} homes`),
    href: '/search',
    setAt: input.now ?? Date.now(),
  }
}

export function rememberGuestWatch(residual: GuestWatchResidual): void {
  if (typeof window === 'undefined') return
  if (!isSafeRelativeHref(residual.href)) return
  try {
    localStorage.setItem(GUEST_WATCH_STORAGE_KEY, serializeGuestWatch(residual))
    // Fresh signup clears prior dismiss so the return banner can show next visit.
    localStorage.removeItem(GUEST_WATCH_DISMISS_KEY)
  } catch {
    // private mode / quota — product residual is best-effort
  }
}

export function readGuestWatch(now = Date.now()): GuestWatchResidual | null {
  if (typeof window === 'undefined') return null
  try {
    return parseGuestWatch(localStorage.getItem(GUEST_WATCH_STORAGE_KEY), now)
  } catch {
    return null
  }
}

export function clearGuestWatch(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(GUEST_WATCH_STORAGE_KEY)
    localStorage.removeItem(GUEST_WATCH_DISMISS_KEY)
  } catch {
    /* ignore */
  }
}

export function dismissGuestWatch(now = Date.now()): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(GUEST_WATCH_DISMISS_KEY, String(now))
  } catch {
    /* ignore */
  }
}

export function isGuestWatchDismissed(now = Date.now()): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = localStorage.getItem(GUEST_WATCH_DISMISS_KEY)
    if (!raw) return false
    const t = Number(raw)
    if (!Number.isFinite(t)) return false
    return now - t < GUEST_WATCH_DISMISS_MS
  } catch {
    return false
  }
}

/** True when a return banner should show (has residual, not dismissed). */
export function shouldShowGuestWatchBanner(now = Date.now()): boolean {
  if (isGuestWatchDismissed(now)) return false
  return readGuestWatch(now) != null
}

'use server'

import { headers } from 'next/headers'
import { getAuthLimiter } from '@/lib/rate-limit'
import {
  normalizeSavedSearchFilters,
  getSavedSearchHash,
  getFiltersSummary,
  getFilterNameFallback,
  buildSearchUrlFromFilters,
} from '@/lib/search-filters'
import { trackSavedPropertySearch, findPersonByEmail, createRealtimeTask } from '@/lib/followupboss'
import { upsertGuestSearchAlert } from '@/lib/data/leads/guestSearchAlerts'
import { fireLeadGenerated } from '@/lib/lead-tracking'

/**
 * Anonymous "get listing alerts for this search" capture (public).
 *
 * Turns a not-signed-in /search visitor into a canonical buyer lead AND a
 * durable alert the cron can email. This is a PUBLIC server-action write into
 * FUB + the DB, so it is the spam-hardened path the repo previously lacked:
 *   1. honeypot   2. per-IP rate limit   3. email validation
 *   4. FUB dedup (findPersonByEmail)   5. compliance gate (inside canonicallyTagLead)
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SearchAlertResult = { ok: true } | { ok: false; error: string }

export async function submitSearchAlertSignup(input: {
  email: string
  filters: Record<string, unknown>
  /** Honeypot — a hidden field humans never fill. */
  company?: string
}): Promise<SearchAlertResult> {
  // 1. Honeypot. A filled hidden field means a bot — pretend success, do nothing.
  if (typeof input.company === 'string' && input.company.trim() !== '') {
    return { ok: true }
  }

  // 2. Per-IP rate limit. Server actions bypass the middleware /api limiter, so
  //    this is the only throttle on a public write into FUB + the DB. FAIL CLOSED
  //    in production: if Upstash is unconfigured or down (no limiter, or a thrown
  //    limit() error), a missing throttle must not silently open the floodgate.
  const isProd = process.env.NODE_ENV === 'production'
  try {
    const limiter = getAuthLimiter()
    if (!limiter) {
      if (isProd) return { ok: false, error: 'Too many requests. Please try again later.' }
    } else {
      const h = await headers()
      const ip =
        h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        h.get('x-real-ip') ||
        h.get('cf-connecting-ip') ||
        '127.0.0.1'
      const { success } = await limiter.limit(`search-alert:${ip}`)
      if (!success) return { ok: false, error: 'Too many requests. Please try again in a minute.' }
    }
  } catch {
    if (isProd) return { ok: false, error: 'Too many requests. Please try again later.' }
  }

  // 3. Validate email (length-bounded — RFC 5321 max is 254).
  const email = (input.email ?? '').trim().toLowerCase()
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'Please enter a valid email address.' }
  }

  // 4. Cap attacker-controlled free-text, then normalize (allowlist + coerce + hash).
  const rawFilters = input.filters ?? {}
  const cappedFilters: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rawFilters)) {
    cappedFilters[key] = typeof value === 'string' ? value.slice(0, 200) : value
  }
  const normalized = normalizeSavedSearchFilters(cappedFilters)
  // Never sign someone up for "every home" — require at least one real filter.
  if (Object.keys(normalized).length === 0) {
    return { ok: false, error: 'Add a filter (like a city or price) so we know what to alert you about.' }
  }
  const filtersHash = getSavedSearchHash(normalized)
  const name = getFilterNameFallback(normalized)
  const summary = getFiltersSummary(normalized)
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const searchUrl = `${base}${buildSearchUrlFromFilters(normalized)}`

  // 5. FUB buyer lead — canonical audience:buyer + buyer:warm + source:idx-registration.
  //    trackSavedPropertySearch fires the event AND applies the tags (awaited
  //    internally, with its built-in compliance hard-stop guard). Best-effort:
  //    a FUB outage must never block the signup or the durable persistence.
  let fubPersonId: number | null = null
  try {
    await trackSavedPropertySearch({ user: { email }, searchName: name, filtersSummary: summary, searchUrl })
    const person = await findPersonByEmail(email)
    fubPersonId = person?.id ?? null
    // Notify the assigned broker in FUB so a signup is never missed. The lead is
    // already created + tagged + assigned to the broker above; this adds a task
    // with a near-immediate phone reminder. Auto-routes to the person's assigned
    // user (the broker). Awaited so the serverless freeze cannot drop it.
    if (fubPersonId) {
      await createRealtimeTask({
        personId: fubPersonId,
        taskName: `New listing-alert signup: ${summary}`,
        taskType: 'Follow Up',
        dueInMinutes: 5,
      })
    }
  } catch {
    // FUB best-effort — never block the signup or the durable persistence.
  }

  // 6. Persist so the alert cron can email this guest when new homes match.
  const persisted = await upsertGuestSearchAlert({ email, filters: normalized, filtersHash, name, fubPersonId })
  if (!persisted.ok) return { ok: false, error: 'We could not set up your alert. Please try again.' }

  // 7. GA4 conversion mirror (best-effort, zero value — this is a free capture).
  try {
    await fireLeadGenerated({
      lp_variant: 'search-alert',
      lead_type: 'buyer',
      value: 0,
      fub_person_id: fubPersonId ?? undefined,
    })
  } catch {
    // best-effort
  }

  return { ok: true }
}

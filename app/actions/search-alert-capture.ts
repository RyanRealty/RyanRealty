'use server'

import { cookies, headers } from 'next/headers'
import { getAuthLimiter } from '@/lib/rate-limit'
import {
  hasNarrowingFilter,
  normalizeSavedSearchFilters,
  getSavedSearchHash,
  getFiltersSummary,
  getFilterNameFallback,
  buildSearchUrlFromFilters,
} from '@/lib/search-filters'
import { sendEvent } from '@/lib/crm/send-event'
import { canonicallyTagLead } from '@/lib/canonical-lead-tagger'
import { createNativeTask } from '@/lib/data/crm/ensureNativeLead'
import { upsertListingAlert } from '@/lib/data/leads/listingAlerts'
import { nativeCrmPersonId } from '@/lib/alerts/enroll-identity'
import { fireLeadGenerated } from '@/lib/lead-tracking'
import { stitchFormSubmitIdentity } from '@/lib/visitor-backfill'

/**
 * Anonymous "get listing alerts for this search" capture (public).
 *
 * Turns a not-signed-in /search visitor into a canonical buyer lead AND a
 * durable alert the cron can email (a listing_alerts row). This is a PUBLIC
 * server-action write into the CRM + the DB, so it is the spam-hardened path
 * the repo previously lacked:
 *   1. honeypot   2. per-IP rate limit   3. email validation
 *   4. native dedup (ensureNativeLead, email-first)
 *   5. compliance gate (inside canonicallyTagLead)
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SearchAlertResult = { ok: true } | { ok: false; error: string }

export async function submitSearchAlertSignup(input: {
  email: string
  filters: Record<string, unknown>
  /** Honeypot, a hidden field humans never fill. */
  company?: string
  /** VisitTracker session id. READ on the client, never minted here. */
  sessionId?: string
}): Promise<SearchAlertResult> {
  // 1. Honeypot. A filled hidden field means a bot. Pretend success, do nothing.
  if (typeof input.company === 'string' && input.company.trim() !== '') {
    return { ok: true }
  }

  // 2. Per-IP rate limit. Server actions bypass the middleware /api limiter, so
  //    this is the only throttle on a public write into the CRM + the DB. FAIL CLOSED
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

  // 3. Validate email (length-bounded, RFC 5321 max is 254).
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
  // Never sign someone up for "every home". Require at least one real filter.
  // Guard on NARROWING power, not key count: a save made only of
  // view/sort/poly/status would otherwise become a whole-feed alert
  // (attack finding 2026-07-11).
  if (!hasNarrowingFilter(normalized)) {
    return { ok: false, error: 'Add a filter (like a city or price) so we know what to alert you about.' }
  }
  const filtersHash = getSavedSearchHash(normalized)
  const name = getFilterNameFallback(normalized)
  const summary = getFiltersSummary(normalized)
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const searchUrl = `${base}${buildSearchUrlFromFilters(normalized)}`

  // 5. Native buyer lead: sendEvent captures via ensureNativeLead (CRM
  //    decommissioned 2026-06-24) and returns the crm_people id, which gates
  //    the canonical audience:buyer + buyer:warm + source:idx-registration
  //    tagging (compliance hard-stop guard lives inside canonicallyTagLead).
  //    Best-effort: a capture blip must never block the signup or the durable
  //    persistence.
  let fubPersonId: number | null = null
  let crmPersonId: number | null = null
  try {
    const result = await sendEvent({
      type: 'Saved Property Search',
      person: { emails: [{ value: email }] },
      source: base.replace(/^https?:\/\//, '').toLowerCase() || 'ryan-realty.com',
      system: 'Ryan Realty Website',
      sourceUrl: searchUrl,
      message: `Saved search: ${name}${summary ? `, ${summary}` : ''}`,
    })
    const nativeId = result.ok ? nativeCrmPersonId(result.personId) : null
    crmPersonId = nativeId
    fubPersonId = nativeId
    if (nativeId) {
      try {
        await canonicallyTagLead({
          fubPersonId: nativeId,
          audience: 'buyer',
          source: 'idx-registration',
          tier: 'warm',
          originContext: {
            source: 'saved-search',
            sourceLabel: 'Listing-alert signup',
            landingPage: searchUrl,
            audience: 'buyer',
            tier: 'warm',
            want: `Listing alerts for ${name}${summary ? `, ${summary}` : ''}`,
          },
        })
        // Notify the assigned broker so a signup is never missed — a native
        // crm_tasks row with a near-due reminder (replaces the dead CRM
        // createRealtimeTask). Awaited so the serverless freeze cannot drop it.
        await createNativeTask({
          personId: nativeId,
          name: `New listing-alert signup: ${summary}`,
          type: 'Follow Up',
          dueInMinutes: 5,
        })
        // Instant sequence enroll (funnel audit 2026-09-01): the 15-minute
        // crm-auto-enroll sweep remains the catch-all, but a hot signup should
        // not wait on it — same direct call the contact form makes.
        const { autoEnrollByPersonId } = await import('@/lib/crm/enroll')
        await autoEnrollByPersonId(nativeId).catch((e: unknown) =>
          console.warn('[search-alert] instant auto-enroll failed:', e),
        )
      } catch {
        // Best-effort. Tag/task blip must not skip the browser stitch.
      }
      // 5b. Anonymous-to-known stitch. Cookie rr_vid covers callers that omit
      //     sessionId; a valid uuid v4 also backfills visitor_sessions.
      //     Best-effort: stitch failure must not fail the signup.
      try {
        const rrVid = (await cookies()).get('rr_vid')?.value ?? null
        await stitchFormSubmitIdentity({
          personId: nativeId,
          email,
          rrVid,
          sessionId: input.sessionId,
        })
      } catch {
        // Best-effort. Identifying the browser must never fail the signup.
      }
    }
  } catch {
    // Best-effort. Never block the signup or the durable persistence.
  }

  // 6. Persist so the alert cron can email this guest when new homes match.
  const persisted = await upsertListingAlert({
    email,
    filters: normalized,
    filtersHash,
    name,
    crmPersonId,
    fubPersonId,
  })
  if (!persisted.ok) return { ok: false, error: 'We could not set up your alert. Please try again.' }

  // 7. GA4 conversion mirror (best-effort, zero value: this is a free capture).
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

/**
 * Anonymous "save this home" capture (public listing pages).
 *
 * The signed-out Save click was the one high-intent action with no guest
 * path — it hard-gated behind full OAuth while every alert surface offered
 * email-only capture (funnel audit 2026-09-01). Same hardened shape as
 * submitSearchAlertSignup: honeypot, per-IP limit, email validation, native
 * dedup, compliance-gated tagging, browser stitch. The visitor's saved-home
 * STATE still lives behind sign-in (lib/pending-save.ts resumes it); this
 * captures the lead the moment the intent fires.
 */
export async function submitListingSaveCapture(input: {
  email: string
  listingKey: string
  /** Street line for the broker task + want text; server caps it, never trusts it for routing. */
  addressLine?: string
  /** Honeypot, a hidden field humans never fill. */
  company?: string
  /** VisitTracker session id. READ on the client, never minted here. */
  sessionId?: string
}): Promise<SearchAlertResult> {
  if (typeof input.company === 'string' && input.company.trim() !== '') {
    return { ok: true }
  }
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

  const email = (input.email ?? '').trim().toLowerCase()
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'Please enter a valid email address.' }
  }
  const listingKey = (input.listingKey ?? '').trim()
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(listingKey)) {
    return { ok: false, error: 'That listing could not be identified. Try again from the listing page.' }
  }
  const addressLine = (input.addressLine ?? '').trim().slice(0, 120)
  const homeLabel = addressLine || 'this home'
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  // Server-built canonical URL — the client never supplies a URL.
  const listingUrl = `${base}/homes-for-sale/listing/${encodeURIComponent(listingKey)}`

  try {
    const result = await sendEvent({
      type: 'Saved Property',
      person: { emails: [{ value: email }] },
      source: base.replace(/^https?:\/\//, '').toLowerCase() || 'ryan-realty.com',
      system: 'Ryan Realty Website',
      sourceUrl: listingUrl,
      message: `Saved a home: ${homeLabel} (${listingKey})`,
    })
    const nativeId = result.ok ? nativeCrmPersonId(result.personId) : null
    if (nativeId) {
      try {
        await canonicallyTagLead({
          fubPersonId: nativeId,
          audience: 'buyer',
          source: 'idx-registration',
          tier: 'warm',
          originContext: {
            source: 'listing-save',
            sourceLabel: 'Saved a home (guest)',
            landingPage: listingUrl,
            audience: 'buyer',
            tier: 'warm',
            want: `Saved ${homeLabel}`,
          },
        })
        await createNativeTask({
          personId: nativeId,
          name: `Guest saved a home: ${homeLabel}`,
          type: 'Follow Up',
          dueInMinutes: 5,
        })
        const { autoEnrollByPersonId } = await import('@/lib/crm/enroll')
        await autoEnrollByPersonId(nativeId).catch((e: unknown) =>
          console.warn('[listing-save] instant auto-enroll failed:', e),
        )
      } catch {
        // Best-effort. Tag/task blip must not skip the browser stitch.
      }
      try {
        const rrVid = (await cookies()).get('rr_vid')?.value ?? null
        await stitchFormSubmitIdentity({
          personId: nativeId,
          email,
          rrVid,
          sessionId: input.sessionId,
        })
      } catch {
        // Best-effort. Identifying the browser must never fail the capture.
      }
    }
  } catch {
    // Best-effort. Never block the visitor's confirmation on a capture blip.
  }

  try {
    await fireLeadGenerated({
      lp_variant: 'listing-save',
      lead_type: 'buyer',
      value: 0,
    })
  } catch {
    // best-effort
  }

  return { ok: true }
}

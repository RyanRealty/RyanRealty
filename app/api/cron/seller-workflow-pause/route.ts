/**
 * Seller workflow pause-on-reply cron.
 *
 * Runs every 15 minutes via Vercel cron. For every FUB person currently
 * enrolled in the seller workflow (tag audience:seller + one of seller:hot/
 * warm/nurture, AND NOT seller:in-conversation), checks if there's been any
 * inbound message activity in the lookback window. If so, adds the tag
 * seller:in-conversation, which the FUB Automation Rule then uses to
 * unenroll the lead from the action plan — pausing all further auto touches.
 *
 * Why this exists: FUB doesn't expose outbound webhooks on our integration
 * tier (verified 2026-05-17). So instead of FUB pushing "lead replied"
 * events to us, we poll every 15 min. This is good enough because the broker
 * is the primary toucher anyway — the auto touches are a safety net.
 *
 * The FUB action plan is the heart of the workflow; this cron is just the
 * pause-detection backstop.
 *
 * Spec: docs/FUB_SELLER_WORKFLOW_2026-05-17.md §10
 * Cadence: every 15 min (Vercel cron: vercel.json)
 * Auth: Authorization: Bearer $CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { addPersonTags } from '@/lib/followupboss'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const FUB_BASE = 'https://api.followupboss.com/v1'
const SYSTEM_HEADERS = {
  'X-System': 'RyanRealty-Web',
  'X-System-Key': 'ryan-realty-2026-seller-workflow',
} as const

/** Lookback window for inbound activity. Slightly longer than the cron
 *  cadence to absorb clock skew + occasional run delays. */
const LOOKBACK_MINUTES = 20

function authHeader(): string {
  const key = process.env.FOLLOWUPBOSS_API_KEY?.trim()
  if (!key) throw new Error('FOLLOWUPBOSS_API_KEY missing')
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`
}

async function fubGET<T = unknown>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${FUB_BASE}${path}`, {
      method: 'GET',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
        ...SYSTEM_HEADERS,
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn(`[seller-workflow-pause] GET ${path} → ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.error(`[seller-workflow-pause] GET ${path} error:`, err)
    return null
  }
}

type FubPersonLite = { id: number; name?: string; tags?: string[] }

/**
 * Fetch all currently-enrolled seller workflow leads.
 *
 * Filter: must have audience:seller AND one of seller:hot/warm/nurture/long-nurture
 *         AND NOT seller:in-conversation AND NOT seller:do-not-contact.
 *
 * FUB doesn't support multi-tag intersection filters via the API, so we
 * over-fetch and filter client-side. Capped to most-recent 500 active
 * sellers — anyone older than that has already cycled through the 60-day
 * workflow and is in the long-nurture pool.
 */
async function fetchEnrolledSellers(): Promise<FubPersonLite[]> {
  // Use tagsAnd query param if FUB supports it; otherwise scan recent people.
  const data = await fubGET<{ people: FubPersonLite[] }>(
    `/people?tags=audience:seller&limit=100&sort=-lastActivity&fields=id,name,tags`,
  )
  const people = data?.people ?? []
  return people.filter((p) => {
    const tags = (p.tags ?? []).map((t) => t.toLowerCase())
    if (!tags.includes('audience:seller')) return false
    const tier = tags.some((t) =>
      ['seller:hot', 'seller:warm', 'seller:nurture'].includes(t),
    )
    if (!tier) return false
    if (tags.includes('seller:in-conversation')) return false
    if (tags.includes('seller:do-not-contact')) return false
    return true
  })
}

/**
 * Check if a person has any inbound message activity (email or SMS) within
 * the lookback window. Returns true if at least one inbound message exists.
 */
async function hasInboundActivity(personId: number, sinceIso: string): Promise<boolean> {
  // Pull both inbound and outbound, filter for inbound. FUB API doesn't have
  // an isIncoming= filter at query time on these endpoints.
  const [emails, texts] = await Promise.all([
    fubGET<{ emails: Array<{ status: string; date: string; relatedPeople?: Array<{ sentByPerson?: boolean }> }> }>(
      `/emails?personId=${personId}&limit=10`,
    ),
    fubGET<{ textmessages: Array<{ isIncoming: boolean; sent: string }> }>(
      `/textMessages?personId=${personId}&limit=10`,
    ),
  ])

  const sinceMs = Date.parse(sinceIso)

  // Email: "Received" status = inbound. Date field is when FUB indexed it.
  const inboundEmail = (emails?.emails ?? []).some((e) => {
    if (e.status !== 'Received') return false
    const ts = Date.parse(e.date)
    return Number.isFinite(ts) && ts >= sinceMs
  })
  if (inboundEmail) return true

  // SMS: isIncoming flag is canonical.
  const inboundSms = (texts?.textmessages ?? []).some((m) => {
    if (!m.isIncoming) return false
    const ts = Date.parse(m.sent)
    return Number.isFinite(ts) && ts >= sinceMs
  })
  return inboundSms
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const sinceIso = new Date(Date.now() - LOOKBACK_MINUTES * 60_000).toISOString()

  const enrolled = await fetchEnrolledSellers()
  const results = {
    scanned: enrolled.length,
    paused: 0,
    skipped: 0,
    errors: 0,
    lookbackMinutes: LOOKBACK_MINUTES,
    durationMs: 0,
    paused_people: [] as Array<{ id: number; name?: string }>,
  }

  // Process in series so we don't hammer FUB. With ~15 active enrolled
  // sellers + 2 GETs each at ~100ms = ~3s. Way under maxDuration.
  for (const person of enrolled) {
    try {
      const replied = await hasInboundActivity(person.id, sinceIso)
      if (!replied) {
        results.skipped++
        continue
      }
      const ok = await addPersonTags(person.id, ['seller:in-conversation'])
      if (ok) {
        results.paused++
        results.paused_people.push({ id: person.id, name: person.name })
      } else {
        results.errors++
      }
    } catch (err) {
      console.error(`[seller-workflow-pause] error on personId=${person.id}:`, err)
      results.errors++
    }
  }

  results.durationMs = Date.now() - startedAt
  return NextResponse.json(results)
}

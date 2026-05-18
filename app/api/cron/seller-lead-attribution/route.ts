/**
 * Seller-lead attribution cron.
 *
 * Daily. Reads FUB /v1/people for leads created in the last 24 hours with
 * seller-intent tags. For each lead, attempts to match back to a
 * content_performance row via utm_content, utm_campaign, or asset URL
 * alignment. Increments north_star_attributed_seller_leads on matches.
 *
 * Attribution chain (in priority order):
 *   1. Lead's source_url contains a post_external_id from content_performance.
 *   2. Lead's utm_content matches an action_id in marketing_brain_actions.
 *   3. Lead's utm_campaign matches an action_type prefix pattern.
 *
 * Idempotency: uses ON CONFLICT DO UPDATE with a guard condition so
 * re-running for the same day does not double-count leads that were already
 * attributed in a prior run. The guard checks whether the lead's FUB ID has
 * already been recorded in content_performance.metadata_48h.attributed_lead_ids.
 *
 * Schedule: daily at 13:00 UTC / 06:00 Mountain (see vercel.json).
 * Auth: Authorization: Bearer $CRON_SECRET
 *
 * Manual invocation:
 *   GET /api/cron/seller-lead-attribution
 *     ?lookbackHours=24   (default 24, max 168)
 *     &dryRun=true
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { createServiceClient } from '@/lib/supabase/service'
import { getFubHeaders } from '@/lib/fub-snapshot'

export const maxDuration = 120

const FUB_BASE = 'https://api.followupboss.com/v1'
const DEFAULT_LOOKBACK_HOURS = 24

// Canonical seller-intent tags (from docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md §2
// and docs/FUB_SELLER_WORKFLOW_2026-05-17.md tag schema).
const SELLER_TAGS = new Set([
  'hot-seller',
  'warm-seller',
  'seller',
  'seller-lead',
  'seller_intent',
  'seller_curious',
  'seller-curious',
])

interface FubPerson {
  id: number
  created: string
  tags?: string[]
  sourceUrl?: string
  utmContent?: string
  utmCampaign?: string
  utmSource?: string
  utmMedium?: string
  name?: string
}

interface AttributionMatch {
  fub_person_id: number
  content_performance_id: string
  action_id: string
  platform: string
  match_method: string
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const lookbackHoursParam = url.searchParams.get('lookbackHours')
  const dryRun = url.searchParams.get('dryRun') === 'true'
  const lookbackHours = lookbackHoursParam
    ? Math.min(168, Math.max(1, parseInt(lookbackHoursParam, 10) || DEFAULT_LOOKBACK_HOURS))
    : DEFAULT_LOOKBACK_HOURS

  const startedAt = new Date().toISOString()
  const supabase = createServiceClient()

  // Check whether FUB is configured.
  const fubHeaders = getFubHeaders()
  if (!fubHeaders) {
    return NextResponse.json({
      startedAt,
      gap: 'FOLLOWUPBOSS_API_KEY not configured. No leads checked.',
      unattributed_leads_today: 0,
      attributed_count: 0,
      matches: [],
    })
  }

  // Fetch seller-intent leads created in the lookback window.
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString()

  let fubPeople: FubPerson[] = []
  let fubGap: string | null = null

  try {
    const resp = await fetch(
      `${FUB_BASE}/people?sort=-created&limit=100&created=${encodeURIComponent(since)}`,
      { headers: fubHeaders as HeadersInit, signal: AbortSignal.timeout(20_000) }
    )
    if (!resp.ok) {
      fubGap = `FUB API returned HTTP ${resp.status}`
    } else {
      const body = await resp.json() as { people?: FubPerson[] }
      fubPeople = body.people ?? []
    }
  } catch (err) {
    fubGap = err instanceof Error ? err.message : String(err)
  }

  // Filter to seller-intent leads only.
  const sellerLeads = fubPeople.filter((p) =>
    (p.tags ?? []).some((t) => SELLER_TAGS.has(t.toLowerCase().trim()))
  )

  const unattributedCount = sellerLeads.length

  if (sellerLeads.length === 0 || dryRun) {
    return NextResponse.json({
      startedAt,
      gap: fubGap,
      lookback_hours: lookbackHours,
      seller_leads_found: sellerLeads.length,
      unattributed_leads_today: unattributedCount,
      attributed_count: 0,
      matches: [],
      dryRun,
      candidates: dryRun
        ? sellerLeads.map((p) => ({
            fub_id: p.id,
            tags: p.tags,
            source_url: p.sourceUrl,
            utm_content: p.utmContent,
            utm_campaign: p.utmCampaign,
          }))
        : undefined,
    })
  }

  // Load recent content_performance rows to match against.
  const { data: perfRows, error: perfErr } = await supabase
    .from('content_performance')
    .select('id, action_id, platform, post_external_id, posted_at, north_star_attributed_seller_leads, metrics_48h')
    .gte('posted_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false })

  if (perfErr) {
    return NextResponse.json({ error: perfErr.message }, { status: 500 })
  }

  const perf = perfRows ?? []

  // Build lookup maps for O(1) matching.
  const byExternalId = new Map<string, typeof perf[0]>()
  const byActionId = new Map<string, typeof perf[0]>()
  for (const p of perf) {
    if (p.post_external_id) byExternalId.set(p.post_external_id, p)
    if (p.action_id) byActionId.set(p.action_id, p)
  }

  const matches: AttributionMatch[] = []
  const alreadyAttributed = new Set<string>() // fub_person_id:perf_id

  for (const lead of sellerLeads) {
    let matchedPerf: typeof perf[0] | undefined
    let matchMethod = ''

    // Method 1: source_url contains a post_external_id.
    if (lead.sourceUrl) {
      for (const [extId, row] of byExternalId.entries()) {
        if (lead.sourceUrl.includes(extId)) {
          matchedPerf = row
          matchMethod = 'source_url_contains_external_id'
          break
        }
      }
    }

    // Method 2: utm_content matches an action_id.
    if (!matchedPerf && lead.utmContent) {
      matchedPerf = byActionId.get(lead.utmContent)
      if (matchedPerf) matchMethod = 'utm_content_action_id'
    }

    // Method 3: utm_campaign contains an action_id substring.
    if (!matchedPerf && lead.utmCampaign) {
      for (const [actionId, row] of byActionId.entries()) {
        if (lead.utmCampaign.includes(actionId)) {
          matchedPerf = row
          matchMethod = 'utm_campaign_action_id_substring'
          break
        }
      }
    }

    if (!matchedPerf) continue

    const dedupeKey = `${lead.id}:${matchedPerf.id}`
    if (alreadyAttributed.has(dedupeKey)) continue

    // Guard: check whether this lead ID was already attributed to this perf row.
    const existingMeta48h = (matchedPerf.metrics_48h ?? {}) as Record<string, unknown>
    const alreadyAttributedIds = Array.isArray(existingMeta48h.attributed_lead_ids)
      ? (existingMeta48h.attributed_lead_ids as number[])
      : []

    if (alreadyAttributedIds.includes(lead.id)) {
      alreadyAttributed.add(dedupeKey)
      continue
    }

    alreadyAttributed.add(dedupeKey)

    // Increment north_star_attributed_seller_leads and record the lead ID.
    const newLeadIds = [...alreadyAttributedIds, lead.id]
    const updatedMeta48h = { ...existingMeta48h, attributed_lead_ids: newLeadIds }

    const { error: updateErr } = await supabase
      .from('content_performance')
      .update({
        north_star_attributed_seller_leads:
          (typeof matchedPerf.north_star_attributed_seller_leads === 'number'
            ? matchedPerf.north_star_attributed_seller_leads
            : 0) + 1,
        metrics_48h: updatedMeta48h,
      })
      .eq('id', matchedPerf.id)

    if (updateErr) {
      console.error(`[seller-lead-attribution] update error for perf ${matchedPerf.id}:`, updateErr.message)
      continue
    }

    matches.push({
      fub_person_id: lead.id,
      content_performance_id: matchedPerf.id,
      action_id: matchedPerf.action_id,
      platform: matchedPerf.platform,
      match_method: matchMethod,
    })
  }

  return NextResponse.json({
    startedAt,
    gap: fubGap,
    lookback_hours: lookbackHours,
    seller_leads_found: sellerLeads.length,
    unattributed_leads_today: sellerLeads.length - matches.length,
    attributed_count: matches.length,
    matches,
  })
}

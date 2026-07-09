/**
 * Buyer-lead attribution cron. Mirror of seller-lead-attribution for buyers.
 *
 * Daily. Reads crm_people for buyer-intent leads created in the lookback
 * window and tagged channel:*-ads (a paid-social/search touch). For each,
 * attempts to match back to a content_performance row via the campaign:* /
 * ad-content:* tags. Increments north_star_attributed_buyer_leads on matches.
 *
 * Rewritten 2026-07-09 off the FUB /v1/people integration (decommissioned
 * 2026-06-24) onto the native crm_people tag schema built the same day
 * (lib/crm/lead-source.ts). The old version parsed utm_content/utm_campaign
 * out of a FUB-stored sourceUrl query string; the new one reads the
 * ad-content:* and campaign:* tags directly, which are more reliable (they're
 * set by resolvePaidAttributionTags() at intake, not round-tripped through a
 * URL). Dropped: the old "source_url contains post_external_id" match method
 * (crm_people.source_url isn't populated by the native lead-create path yet
 * — a separate gap, not required for this rewrite).
 *
 * Idempotency: re-running for the same day does not double-count. The guard
 * checks whether the lead's crm_people id has already been recorded in
 * content_performance.metrics_48h.attributed_lead_ids.
 *
 * Schedule: daily (see vercel.json). Auth: Authorization: Bearer $CRON_SECRET
 *
 * Manual invocation:
 *   GET /api/cron/buyer-lead-attribution?lookbackHours=24&dryRun=true
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { createServiceClient } from '@/lib/supabase/service'

export const maxDuration = 120

const DEFAULT_LOOKBACK_HOURS = 24

// Buyer-intent tags. The buyer LP tagger applies `audience:buyer` to every buyer
// plus `buyer:<tier>` (hot|warm|nurture, default nurture). Legacy strings kept so
// pre- and post-migration leads attribute.
const BUYER_TAGS = new Set([
  'audience:buyer',
  'buyer:hot',
  'buyer:warm',
  'buyer:nurture',
  'hot-buyer',
  'warm-buyer',
  'buyer',
  'buyer-lead',
  'buyer_intent',
])

interface CrmLead {
  id: number
  created_at: string
  tags: string[]
  name: string | null
}

interface AttributionMatch {
  crm_person_id: number
  content_performance_id: string
  action_id: string
  platform: string
  match_method: string
}

/** Extract the tag value after a `prefix:` — e.g. 'campaign:t2b-westbend' -> 't2b-westbend'. */
function tagValue(tags: string[], prefix: string): string | undefined {
  const t = tags.find((x) => x.startsWith(prefix))
  return t ? t.slice(prefix.length) : undefined
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
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString()

  const { data: leadRows, error: leadErr } = await supabase
    .from('crm_people')
    .select('id, created_at, tags, name')
    .eq('deleted', false)
    .gte('created_at', since)
    .contains('tags', ['audience:buyer'])
    .limit(500)

  if (leadErr) {
    return NextResponse.json({ error: leadErr.message }, { status: 500 })
  }

  const buyerLeads = ((leadRows ?? []) as CrmLead[]).filter((p) =>
    (p.tags ?? []).some((t) => BUYER_TAGS.has(t.toLowerCase().trim()) || t.startsWith('channel:'))
  )

  if (buyerLeads.length === 0 || dryRun) {
    return NextResponse.json({
      startedAt,
      lookback_hours: lookbackHours,
      buyer_leads_found: buyerLeads.length,
      unattributed_leads_today: buyerLeads.length,
      attributed_count: 0,
      matches: [],
      dryRun,
      candidates: dryRun
        ? buyerLeads.map((p) => ({
            crm_person_id: p.id,
            tags: p.tags,
            campaign: tagValue(p.tags, 'campaign:'),
            ad_content: tagValue(p.tags, 'ad-content:'),
          }))
        : undefined,
    })
  }

  const { data: perfRows, error: perfErr } = await supabase
    .from('content_performance')
    .select('id, action_id, platform, posted_at, north_star_attributed_buyer_leads, metrics_48h')
    .gte('posted_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false })

  if (perfErr) {
    return NextResponse.json({ error: perfErr.message }, { status: 500 })
  }

  const perf = perfRows ?? []
  const byActionId = new Map<string, typeof perf[0]>()
  for (const p of perf) {
    if (p.action_id) byActionId.set(p.action_id, p)
  }

  const matches: AttributionMatch[] = []
  const alreadyAttributed = new Set<string>()

  for (const lead of buyerLeads) {
    const adContent = tagValue(lead.tags, 'ad-content:')
    const campaign = tagValue(lead.tags, 'campaign:')

    let matchedPerf: typeof perf[0] | undefined
    let matchMethod = ''

    // Method 1: ad-content:* tag (= utm_content = the action_id) matches directly.
    if (adContent) {
      matchedPerf = byActionId.get(adContent)
      if (matchedPerf) matchMethod = 'ad_content_tag_action_id'
    }

    // Method 2: campaign:* tag contains an action_id substring.
    if (!matchedPerf && campaign) {
      for (const [actionId, row] of byActionId.entries()) {
        if (campaign.includes(actionId)) {
          matchedPerf = row
          matchMethod = 'campaign_tag_action_id_substring'
          break
        }
      }
    }

    if (!matchedPerf) continue

    const dedupeKey = `${lead.id}:${matchedPerf.id}`
    if (alreadyAttributed.has(dedupeKey)) continue

    const existingMeta48h = (matchedPerf.metrics_48h ?? {}) as Record<string, unknown>
    const alreadyAttributedIds = Array.isArray(existingMeta48h.attributed_lead_ids)
      ? (existingMeta48h.attributed_lead_ids as number[])
      : []

    if (alreadyAttributedIds.includes(lead.id)) {
      alreadyAttributed.add(dedupeKey)
      continue
    }

    alreadyAttributed.add(dedupeKey)

    const newLeadIds = [...alreadyAttributedIds, lead.id]
    const updatedMeta48h = { ...existingMeta48h, attributed_lead_ids: newLeadIds }

    const { error: updateErr } = await supabase
      .from('content_performance')
      .update({
        north_star_attributed_buyer_leads:
          (typeof matchedPerf.north_star_attributed_buyer_leads === 'number'
            ? matchedPerf.north_star_attributed_buyer_leads
            : 0) + 1,
        metrics_48h: updatedMeta48h,
      })
      .eq('id', matchedPerf.id)

    if (updateErr) {
      console.error(`[buyer-lead-attribution] update error for perf ${matchedPerf.id}:`, updateErr.message)
      continue
    }

    matches.push({
      crm_person_id: lead.id,
      content_performance_id: matchedPerf.id,
      action_id: matchedPerf.action_id,
      platform: matchedPerf.platform,
      match_method: matchMethod,
    })
  }

  return NextResponse.json({
    startedAt,
    lookback_hours: lookbackHours,
    buyer_leads_found: buyerLeads.length,
    unattributed_leads_today: buyerLeads.length - matches.length,
    attributed_count: matches.length,
    matches,
  })
}

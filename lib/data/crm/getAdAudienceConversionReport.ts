import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'

/**
 * Closed-loop ad-audience → CRM-conversion report.
 *
 * Answers "of the people we know are in audience X (a farm tag like
 * farm:westside) and are being shown ads, how many actually engaged with an
 * ad and where did they end up in the pipeline." Depends on two 2026-07-09
 * fixes: crm_people.source used to be hardcoded to the site domain
 * regardless of traffic origin (app/lp/*\/actions.ts), and channel:*-ads /
 * campaign:* / ad-content:* tags weren't being written consistently across
 * all five lead landing pages (lib/crm/lead-source.ts). Before those fixes
 * this report would have been structurally incapable of finding any
 * ad-attributed conversions no matter how many actually happened.
 */

export type AdAudienceConversionReport = {
  farmTag: string
  farmTotal: number
  /** Farm members who also carry ANY channel:*-ads tag (reached by paid social/search). */
  reachedByAds: number
  /** reachedByAds broken down by the specific channel tag (channel:fb-ads, channel:google-ads, ...). */
  byChannel: Array<{ channel: string; count: number }>
  /** reachedByAds broken down by campaign:* tag. */
  byCampaign: Array<{ campaign: string; count: number }>
  /** reachedByAds broken down by ad-content:* tag — the specific ad/creative. */
  byAdContent: Array<{ adContent: string; count: number }>
  /** reachedByAds broken down by crm_people.stage — the honest funnel view (no invented "converted" binary). */
  byStage: Array<{ stage: string; count: number }>
  generatedAt: string
}

async function fetchReport(farmTag: string): Promise<AdAudienceConversionReport> {
  const sb = createServiceClient()

  const farmRows: Array<{ id: number; stage: string | null; tags: string[] | null }> = []
  let offset = 0
  const pageSize = 1000
  for (;;) {
    const { data, error } = await sb
      .from('crm_people')
      .select('id, stage, tags')
      .eq('deleted', false)
      .contains('tags', [farmTag])
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(`getAdAudienceConversionReport: ${error.message}`)
    farmRows.push(...((data ?? []) as typeof farmRows))
    if (!data || data.length < pageSize) break
    offset += pageSize
  }

  const channelCounts = new Map<string, number>()
  const campaignCounts = new Map<string, number>()
  const adContentCounts = new Map<string, number>()
  const stageCounts = new Map<string, number>()
  let reachedByAds = 0

  for (const row of farmRows) {
    const tags = row.tags ?? []
    const channelTags = tags.filter((t) => t.startsWith('channel:') && t.endsWith('-ads'))
    if (channelTags.length > 0) {
      reachedByAds += 1
      channelTags.forEach((t) => channelCounts.set(t, (channelCounts.get(t) ?? 0) + 1))
      tags
        .filter((t) => t.startsWith('campaign:'))
        .forEach((t) => campaignCounts.set(t, (campaignCounts.get(t) ?? 0) + 1))
      tags
        .filter((t) => t.startsWith('ad-content:'))
        .forEach((t) => adContentCounts.set(t, (adContentCounts.get(t) ?? 0) + 1))
      const stage = (row.stage ?? 'Unstaged').trim() || 'Unstaged'
      stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1)
    }
  }

  const toSortedArray = <K extends string>(m: Map<K, number>, key: string) =>
    Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, count]) => ({ [key]: k, count }) as never)

  return {
    farmTag,
    farmTotal: farmRows.length,
    reachedByAds,
    byChannel: toSortedArray(channelCounts, 'channel'),
    byCampaign: toSortedArray(campaignCounts, 'campaign'),
    byAdContent: toSortedArray(adContentCounts, 'adContent'),
    byStage: toSortedArray(stageCounts, 'stage'),
    generatedAt: new Date().toISOString(),
  }
}

/** Cached 5 min — this is a reporting view, not a live send-path check. */
export const getAdAudienceConversionReport = unstable_cache(
  fetchReport,
  ['ad-audience-conversion-report'],
  { revalidate: 300, tags: ['crm-people'] },
)

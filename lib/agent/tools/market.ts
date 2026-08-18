/**
 * lib/agent/tools/market.ts — the `market_stats` tool (R2.2).
 *
 * Pairs getMarketPulse (market_pulse_live, 10-15 min freshness: active
 * inventory, median LIST price, months of supply, median days to pending)
 * with getCityMarketDetail (market_stats_cache, 6h freshness: median SALE
 * price, sold count, median DOM, YoY deltas). Per CLAUDE.md §7, neither cache
 * alone answers a typical "what's Redmond like" question, so every call pairs
 * both reads — zero new query paths, matching R2.2's tool-set contract.
 */
import { getMarketPulse } from '@/lib/data/market/getMarketPulse'
import { getCityMarketDetail, getCompleteMonthlyMarketDetail } from '@/lib/data/market/getCityMarketDetail'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { publishCompleteMonthMedian } from '@/lib/market/publish-complete-month-median'
import { zonedDateKey } from '@/lib/format/date'
import type { GeoType } from '@/lib/data/types/shared'
import type { AgentContext, AgentCitation, AgentTool, ToolOutcome } from '@/lib/agent/types'

const GEO_TYPES: readonly GeoType[] = ['city', 'neighborhood', 'community', 'subdivision', 'zip', 'region']

/** "Redmond" / "NW Crossing" -> "redmond" / "nw-crossing". Shared with
 *  lib/agent/tools/listings.ts so both tools resolve the same geography the
 *  same way. */
export function toGeoSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function fmtUsd(n: number | null): string | null {
  return n == null ? null : `$${Math.round(n).toLocaleString('en-US')}`
}

function isGeoType(v: unknown): v is GeoType {
  return typeof v === 'string' && (GEO_TYPES as readonly string[]).includes(v)
}

async function marketStatsHandler(input: Record<string, unknown>, _ctx: AgentContext): Promise<ToolOutcome> {
  const cityRaw = typeof input.city === 'string' ? input.city.trim() : ''
  if (!cityRaw) return { result: { error: 'city is required' } }
  const geoType: GeoType = isGeoType(input.geoType) ? input.geoType : 'city'
  const geoSlug = geoType === 'city' ? canonicalCityCacheSlug(cityRaw) : toGeoSlug(cityRaw)

  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  const [pulse, detail, lastComplete] = await Promise.all([
    getMarketPulse({ geoType, geoSlug }),
    getCityMarketDetail({ geoType, geoSlug, periodType: 'monthly' }),
    getCompleteMonthlyMarketDetail({ geoType, geoSlug, currentMonthKey }),
  ])

  if (!pulse && !detail) {
    return { result: { found: false, city: cityRaw, geoType, geoSlug } }
  }

  const citations: AgentCitation[] = []

  if (pulse) {
    citations.push({
      figure: `${pulse.activeCount} active`,
      source: `market_pulse_live geo_type=${geoType} geo_slug=${geoSlug} active_count=${pulse.activeCount}, refreshed ${pulse.refreshedAt}`,
    })
    if (pulse.medianListPrice != null) {
      citations.push({
        figure: fmtUsd(pulse.medianListPrice) ?? String(pulse.medianListPrice),
        source: `market_pulse_live geo_type=${geoType} geo_slug=${geoSlug} median_list_price=${pulse.medianListPrice}, refreshed ${pulse.refreshedAt}`,
      })
    }
    if (pulse.monthsOfSupply != null) {
      citations.push({
        figure: `${pulse.monthsOfSupply} months of supply`,
        source: `market_pulse_live geo_type=${geoType} geo_slug=${geoSlug} months_of_supply=${pulse.monthsOfSupply}, refreshed ${pulse.refreshedAt}`,
      })
    }
    if (pulse.medianDaysToPending != null) {
      citations.push({
        figure: `${pulse.medianDaysToPending} days`,
        source: `market_pulse_live geo_type=${geoType} geo_slug=${geoSlug} median_days_to_pending=${pulse.medianDaysToPending}, refreshed ${pulse.refreshedAt}`,
      })
    }
    citations.push({
      figure: `${pulse.closedLast30Days} closed in 30d`,
      source: `market_pulse_live geo_type=${geoType} geo_slug=${geoSlug} sold_count_30d=${pulse.closedLast30Days}, refreshed ${pulse.refreshedAt}`,
    })
  }

  if (detail || lastComplete) {
    const publishedMonth = publishCompleteMonthMedian({
      monthly: detail,
      lastComplete,
      currentMonthKey,
    })
    if (publishedMonth) {
      citations.push({
        figure: fmtUsd(publishedMonth.value) ?? String(publishedMonth.value),
        source: `market_stats_cache geo_type=${geoType} geo_slug=${geoSlug} period=monthly period_start=${publishedMonth.periodStart} ${publishedMonth.label}=${publishedMonth.value}`,
      })
    }
    if (detail?.soldCount != null) {
      citations.push({
        figure: `${detail.soldCount} sold`,
        source: `market_stats_cache geo_type=${geoType} geo_slug=${geoSlug} period=${detail.periodType} sold_count=${detail.soldCount}`,
      })
    }
    if (detail?.medianDom != null) {
      citations.push({
        figure: `${detail.medianDom} median DOM`,
        source: `market_stats_cache geo_type=${geoType} geo_slug=${geoSlug} period=${detail.periodType} median_dom=${detail.medianDom}`,
      })
    }
    if (detail?.yoyMedianPriceDeltaPct != null) {
      citations.push({
        figure: `${detail.yoyMedianPriceDeltaPct}% YoY`,
        source: `market_stats_cache geo_type=${geoType} geo_slug=${geoSlug} period=${detail.periodType} yoy_median_price_delta_pct=${detail.yoyMedianPriceDeltaPct}`,
      })
    }
  }

  return { result: { found: true, city: cityRaw, geoType, geoSlug, pulse, detail }, citations }
}

export const marketTools: AgentTool[] = [
  {
    name: 'market_stats',
    description:
      'Live + recent-closed market stats for a city, neighborhood, community, subdivision, zip, or region: active count, median list price, months of supply, median days to pending, and closed-30d count (10-15 min fresh), plus median sale price, sold count, median DOM, and YoY deltas (6h-fresh cache). SFR only (PropertyType=A), the site-wide convention.',
    input_schema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'Geography name as the broker said it, e.g. "Redmond", "Bend", "NW Crossing", "Awbrey Glen".',
        },
        geoType: {
          type: 'string',
          enum: GEO_TYPES,
          description: 'Defaults to "city". Use "neighborhood"/"community"/"subdivision" for a named area inside Bend.',
        },
      },
      required: ['city'],
    },
    handler: marketStatsHandler,
  },
]

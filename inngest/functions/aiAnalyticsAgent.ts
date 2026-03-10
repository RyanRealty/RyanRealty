/**
 * Daily AI analytics insights. Pull GA4 + internal data, send to AI, store insights.
 * Step 19.
 */

import { inngest } from '@/lib/inngest'
import { createClient } from '@supabase/supabase-js'
import { runGA4Report } from '@/lib/ga4-data-api'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

export const aiAnalyticsAgent = inngest.createFunction(
  { id: 'analytics/ai-insights', name: 'AI analytics insights', retries: 2 },
  { cron: '0 6 * * *' },
  async () => {
    const end = new Date()
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
    const dateRange = { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }

    const ga4Result = await runGA4Report(['pagePath', 'sessionSource'], ['sessions', 'conversions'], dateRange)
    const supabase = getSupabase()
    const { data: engagement } = await supabase.from('engagement_metrics').select('listing_key, view_count, save_count').order('view_count', { ascending: false }).limit(20)
    const { data: leadTiers } = await supabase.from('profiles').select('lead_tier').not('lead_tier', 'is', null)

    const insights: string[] = []
    if (ga4Result.rows && ga4Result.rows.length > 0) {
      insights.push(`Traffic: ${ga4Result.rows.length} page/source combinations in last 24h.`)
    }
    const hotCount = (leadTiers ?? []).filter((r) => (r as { lead_tier: string }).lead_tier === 'hot' || (r as { lead_tier: string }).lead_tier === 'very_hot').length
    if (hotCount > 0) insights.push(`${hotCount} leads in hot or very hot tier.`)
    const highViewLowSave = (engagement ?? []).filter((e) => (e as { view_count: number; save_count: number }).view_count >= 5 && (e as { save_count: number }).save_count === 0)
    if (highViewLowSave.length > 0) insights.push(`${highViewLowSave.length} listings with 5+ views and no saves — consider pricing or photo review.`)

    const priority = insights.length > 0 ? 'medium' : 'low'
    const insightText = insights.length > 0 ? insights.join(' ') : 'No notable patterns in last 24h.'
    await supabase.from('agent_insights').insert({ priority, insight_text: insightText })
    return { inserted: 1 }
  }
)

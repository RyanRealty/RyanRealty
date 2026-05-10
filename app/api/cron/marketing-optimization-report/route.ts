import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getDashboardMarketingData } from '@/app/actions/dashboard'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (secret?.trim()) {
    return request.headers.get('authorization') === `Bearer ${secret}`
  }
  return true
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

function toPriority(verdict: 'strong' | 'needs_attention' | 'at_risk'): 'low' | 'medium' | 'high' {
  if (verdict === 'at_risk') return 'high'
  if (verdict === 'needs_attention') return 'medium'
  return 'low'
}

function buildMarketingAgentPickupPrompt(data: Awaited<ReturnType<typeof getDashboardMarketingData>>): string {
  const recommendationLines = data.reportCard.items
    .map((item, index) => `${index + 1}. [${item.action.toUpperCase()}][${item.priority.toUpperCase()}] ${item.title} — ${item.rationale}`)
    .join('\n')

  return [
    'Run the weekly Facebook seller optimization cycle for Ryan Realty.',
    '',
    `Window: ${data.windowLabel}`,
    `Score: ${data.reportCard.score}/100 (${data.reportCard.verdict})`,
    '',
    'Key metrics:',
    `- Meta lead actions: ${data.metaAds.summary?.leadActions ?? 0}`,
    `- Meta CPL: ${data.metaAds.summary?.costPerLead === null || data.metaAds.summary?.costPerLead === undefined ? 'N/A' : data.metaAds.summary.costPerLead.toFixed(2)}`,
    `- GA4 Facebook lead events: ${data.ga4.facebookLeadEvents}`,
    `- Seller visits from Facebook: ${data.website.sellerVisitsFromFacebook30d}`,
    `- Valuation conversion from Facebook seller visits: ${data.website.valuationRateFromFacebookSellerVisits === null ? 'N/A' : (data.website.valuationRateFromFacebookSellerVisits * 100).toFixed(1) + '%'}`,
    `- FUB Facebook contacts: ${data.fub.facebookContacts30d}`,
    '',
    'Execute these actions in order:',
    recommendationLines || '1. No urgent issues. Run one creative test and one audience test.',
    '',
    'After execution, update status to implemented and append new learnings in the Facebook seller growth skill.',
  ].join('\n')
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const data = await getDashboardMarketingData()
  const pickupPrompt = buildMarketingAgentPickupPrompt(data)
  const now = new Date()
  const isoDate = now.toISOString().slice(0, 10)
  const title = `Weekly Marketing Optimization Packet ${isoDate}`
  const description = [
    `Automated weekly report generated for ${data.windowLabel}.`,
    `Score ${data.reportCard.score}/100 (${data.reportCard.verdict}).`,
    `${data.reportCard.items.length} recommendation(s) queued for agent execution.`,
  ].join(' ')

  const { data: inserted, error } = await supabase
    .from('agent_insights')
    .insert({
      insight_type: 'marketing_optimization_weekly',
      title,
      description,
      priority: toPriority(data.reportCard.verdict),
      status: 'pending',
      data: {
        window_label: data.windowLabel,
        report_card: data.reportCard,
        next_actions: data.nextActions,
        fub_pipeline: data.fubPipeline,
        metrics_snapshot: {
          ga4: data.ga4,
          meta_ads: data.metaAds,
          website: data.website,
          fub: data.fub,
        },
        pickup_prompt: pickupPrompt,
      },
    })
    .select('id')
    .single()

  if (error) {
    console.error('[marketing-optimization-report]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    insight_id: inserted.id,
    title,
    score: data.reportCard.score,
    verdict: data.reportCard.verdict,
    recommendations: data.reportCard.items.length,
  })
}


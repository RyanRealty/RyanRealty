import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getDashboardMarketingData } from '@/app/actions/dashboard'
import { sendEmail } from '@/lib/resend'

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

type MarketingData = Awaited<ReturnType<typeof getDashboardMarketingData>>

function formatBendContextLine(bend: MarketingData['bendMarketContext']): string {
  if (!bend.available) return `- Bend market context: unavailable (${bend.error ?? 'unknown'})`
  const parts: string[] = []
  if (bend.activeListings !== null) parts.push(`active=${bend.activeListings}`)
  if (bend.medianListPrice !== null) parts.push(`median list=$${bend.medianListPrice.toLocaleString()}`)
  if (bend.monthsOfSupply !== null) parts.push(`MoS=${bend.monthsOfSupply.toFixed(2)}`)
  if (bend.soldCount30d !== null) parts.push(`sold 30d=${bend.soldCount30d}`)
  if (bend.medianClosePrice90d !== null) parts.push(`median close 90d=$${bend.medianClosePrice90d.toLocaleString()}`)
  if (bend.marketHealthLabel) parts.push(`label=${bend.marketHealthLabel}`)
  return `- Bend SFR market: ${parts.join(', ')}`
}

function buildMarketingAgentPickupPrompt(data: MarketingData): string {
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
    `- Meta spend: $${(data.metaAds.summary?.spend ?? 0).toLocaleString()} | impressions: ${(data.metaAds.summary?.impressions ?? 0).toLocaleString()}`,
    `- GA4 sessions: ${data.ga4.sessions} | Facebook lead events: ${data.ga4.facebookLeadEvents}`,
    `- Seller visits from Facebook: ${data.website.sellerVisitsFromFacebook30d}`,
    `- Valuation conversion from Facebook seller visits: ${data.website.valuationRateFromFacebookSellerVisits === null ? 'N/A' : (data.website.valuationRateFromFacebookSellerVisits * 100).toFixed(1) + '%'}`,
    `- FUB Facebook contacts: ${data.fub.facebookContacts30d}`,
    formatBendContextLine(data.bendMarketContext),
    '',
    'Execute these actions in order:',
    recommendationLines || '1. No urgent issues. Run one creative test and one audience test.',
    '',
    'After execution, update status to implemented and append new learnings in the Facebook seller growth skill.',
  ].join('\n')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildEmailHtml(params: {
  data: MarketingData
  pickupPrompt: string
  insightId: string
  previousVerdict: 'strong' | 'needs_attention' | 'at_risk' | null
}): string {
  const { data, pickupPrompt, insightId, previousVerdict } = params
  const verdict = data.reportCard.verdict
  const verdictColor = verdict === 'strong' ? '#15803d' : verdict === 'needs_attention' ? '#d97706' : '#dc2626'
  const verdictLabel = verdict === 'strong' ? 'STRONG' : verdict === 'needs_attention' ? 'NEEDS ATTENTION' : 'AT RISK'
  const recommendationsHtml = data.reportCard.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;">
            <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#f1f5f9;color:#0f172a;font-weight:600;font-size:11px;text-transform:uppercase;">${escapeHtml(item.action)}</span>
            <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#e2e8f0;color:#0f172a;font-weight:600;font-size:11px;text-transform:uppercase;margin-left:4px;">${escapeHtml(item.priority)}</span>
            <strong style="color:#102742;display:block;margin-top:6px;">${escapeHtml(item.title)}</strong>
            <span style="color:#475569;display:block;margin-top:4px;">${escapeHtml(item.rationale)}</span>
          </td>
        </tr>`
    )
    .join('')

  const verdictDeltaBanner = previousVerdict && previousVerdict !== verdict
    ? `<div style="background:#fef3c7;border-left:4px solid #d97706;padding:12px 16px;margin:0 0 16px;color:#92400e;font-size:13px;"><strong>Verdict changed</strong> — last cycle was <strong>${escapeHtml(previousVerdict)}</strong>, this cycle is <strong>${escapeHtml(verdict)}</strong>.</div>`
    : ''

  const bend = data.bendMarketContext
  const bendBlock = bend.available
    ? `<table style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:13px;">
         <tr><th colspan="2" style="text-align:left;padding:10px 14px;background:#F2EBDD;color:#102742;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Bend SFR market context</th></tr>
         <tr><td style="padding:8px 14px;color:#475569;border-bottom:1px solid #f1f5f9;">Active listings</td><td style="padding:8px 14px;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${bend.activeListings ?? 'N/A'}</td></tr>
         <tr><td style="padding:8px 14px;color:#475569;border-bottom:1px solid #f1f5f9;">Median list price</td><td style="padding:8px 14px;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${bend.medianListPrice !== null ? '$' + bend.medianListPrice.toLocaleString() : 'N/A'}</td></tr>
         <tr><td style="padding:8px 14px;color:#475569;border-bottom:1px solid #f1f5f9;">Months of supply</td><td style="padding:8px 14px;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${bend.monthsOfSupply !== null ? bend.monthsOfSupply.toFixed(2) : 'N/A'}</td></tr>
         <tr><td style="padding:8px 14px;color:#475569;border-bottom:1px solid #f1f5f9;">Sold last 30 days</td><td style="padding:8px 14px;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${bend.soldCount30d ?? 'N/A'}</td></tr>
         <tr><td style="padding:8px 14px;color:#475569;border-bottom:1px solid #f1f5f9;">Median close price 90d</td><td style="padding:8px 14px;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${bend.medianClosePrice90d !== null ? '$' + bend.medianClosePrice90d.toLocaleString() : 'N/A'}</td></tr>
         <tr><td style="padding:8px 14px;color:#475569;">Market health</td><td style="padding:8px 14px;color:#0f172a;text-align:right;font-weight:600;">${escapeHtml(bend.marketHealthLabel ?? 'N/A')}</td></tr>
       </table>`
    : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#102742;color:#F2EBDD;padding:24px;border-radius:8px 8px 0 0;border-bottom:3px solid #D4AF37;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.18em;color:#D4AF37;margin-bottom:6px;">Ryan Realty</div>
      <div style="font-size:18px;font-weight:600;">Weekly Marketing Optimization — ${escapeHtml(data.windowLabel)}</div>
    </div>
    <div style="background:#ffffff;padding:24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px;">
      ${verdictDeltaBanner}
      <div style="display:flex;align-items:center;gap:12px;margin:0 0 16px;">
        <div style="font-size:36px;font-weight:700;color:#102742;line-height:1;">${data.reportCard.score}<span style="font-size:14px;color:#64748b;font-weight:500;">/100</span></div>
        <span style="background:${verdictColor};color:#ffffff;padding:6px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.08em;">${verdictLabel}</span>
      </div>
      <p style="margin:0 0 24px;color:#475569;font-size:13px;">Packet id <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${escapeHtml(insightId)}</code> stored in agent_insights.</p>

      ${bendBlock}

      <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#102742;margin:0 0 8px;font-weight:600;">Recommendations (${data.reportCard.items.length})</div>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;border:1px solid #e2e8f0;">${recommendationsHtml}</table>

      <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#102742;margin:0 0 8px;font-weight:600;">Agent pickup prompt (paste to Cursor/Claude)</div>
      <pre style="background:#102742;color:#F2EBDD;padding:16px;border-radius:6px;font-size:12px;line-height:1.55;overflow-x:auto;white-space:pre-wrap;font-family:'JetBrains Mono',ui-monospace,monospace;">${escapeHtml(pickupPrompt)}</pre>

      <p style="font-size:11px;color:#94a3b8;margin:24px 0 0;">Sent automatically by /api/cron/marketing-optimization-report. Live state at <a href="https://ryanrealty.vercel.app/admin" style="color:#102742;">https://ryanrealty.vercel.app/admin</a>.</p>
    </div>
  </div>
</body></html>`
}

async function sendDigestEmail(params: {
  data: MarketingData
  pickupPrompt: string
  insightId: string
  previousVerdict: 'strong' | 'needs_attention' | 'at_risk' | null
}): Promise<void> {
  const recipient = process.env.MARKETING_DIGEST_EMAIL ?? process.env.ADMIN_EMAIL ?? process.env.RESEND_ADMIN_EMAIL
  if (!recipient?.trim()) {
    console.warn('[marketing-optimization-report] No MARKETING_DIGEST_EMAIL or ADMIN_EMAIL configured — skipping digest send')
    return
  }
  const verdict = params.data.reportCard.verdict
  const verdictDropped =
    params.previousVerdict !== null &&
    params.previousVerdict !== 'at_risk' &&
    verdict === 'at_risk'
  const subject = verdictDropped
    ? `[ALERT] Marketing pipeline dropped to AT RISK (score ${params.data.reportCard.score}/100)`
    : `Weekly marketing packet — ${params.data.reportCard.score}/100 ${verdict.replace('_', ' ')}`
  try {
    const { error } = await sendEmail({
      to: recipient,
      subject,
      html: buildEmailHtml(params),
    })
    if (error) console.warn('[marketing-optimization-report] sendEmail returned error:', error)
  } catch (err) {
    console.warn('[marketing-optimization-report] sendEmail threw:', err)
  }
}

async function getPreviousVerdict(
  supabase: SupabaseClient
): Promise<'strong' | 'needs_attention' | 'at_risk' | null> {
  try {
    const { data: row } = await supabase
      .from('agent_insights')
      .select('data')
      .eq('insight_type', 'marketing_optimization_weekly')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const payload = (row ?? null) as { data?: { report_card?: { verdict?: string } } } | null
    const verdict = payload?.data?.report_card?.verdict
    if (verdict === 'strong' || verdict === 'needs_attention' || verdict === 'at_risk') return verdict
    return null
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const previousVerdict = await getPreviousVerdict(supabase)
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
        bend_market_context: data.bendMarketContext,
        previous_verdict: previousVerdict,
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

  // Lifecycle hygiene: mark any prior pending/in_progress marketing packets as
  // implemented so the queue reflects reality. Best-effort.
  await supabase
    .from('agent_insights')
    .update({ status: 'implemented', updated_at: new Date().toISOString() })
    .eq('insight_type', 'marketing_optimization_weekly')
    .in('status', ['pending', 'in_progress'])
    .neq('id', inserted.id)

  // Send the weekly digest email. Loud subject line if verdict just dropped
  // to at_risk; standard subject otherwise. Best-effort — email failure does
  // not block the cron response.
  await sendDigestEmail({ data, pickupPrompt, insightId: inserted.id, previousVerdict })

  return NextResponse.json({
    ok: true,
    insight_id: inserted.id,
    title,
    score: data.reportCard.score,
    verdict: data.reportCard.verdict,
    previous_verdict: previousVerdict,
    recommendations: data.reportCard.items.length,
    bend_market_context_available: data.bendMarketContext.available,
  })
}

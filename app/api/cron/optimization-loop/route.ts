import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Cron-triggered optimization loop: analyze GA4/Search Console (when configured),
 * write findings to optimization_runs. Call with Authorization: Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const findings: string[] = []
  const suggestedChanges: string[] = []

  if (process.env.GOOGLE_GA4_PROPERTY_ID) {
    findings.push('GA4 property configured; pull metrics in a future run.')
  } else {
    suggestedChanges.push('Configure GOOGLE_GA4_PROPERTY_ID and service account for GA4 Data API.')
  }

  const supabase = createClient(url, serviceKey)
  const { error } = await supabase.from('optimization_runs').insert({
    findings: findings.length ? findings : null,
    suggested_changes: suggestedChanges.length ? suggestedChanges : null,
    summary: `Run at ${new Date().toISOString()}. ${findings.length} finding(s), ${suggestedChanges.length} suggestion(s).`,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    message: 'Optimization run recorded.',
    findings: findings.length,
    suggested: suggestedChanges.length,
  })
}

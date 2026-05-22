/**
 * /admin/analytics/action-required - the "what should I do right now" dashboard.
 *
 * One page. Five sections of prioritized cards. Each card surfaces a
 * specific action: which hot leads to call, which warm prospects are on
 * the site right now, which anonymous visitors to retarget, which paid
 * campaigns to pause, which LPs to rebuild. Designed for the broker to
 * open first thing every morning.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}
function fmtRel(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
function lpVariantFromPath(p: string | null): string | null {
  if (!p) return null
  let path = p
  try { path = new URL(p).pathname } catch {}
  path = path.toLowerCase().replace(/\/+$/, '')
  if (path === '/home-valuation') return 'seller-home-value'
  const m = path.match(/^\/lp\/([a-z0-9-]+)/)
  return m ? m[1] : null
}

async function HotLeadsCard() {
  const supabase = getSupabase()
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('visitor_sessions')
    .select('session_id, identified_email, fub_person_id, hot_lead_fired_at, peak_score, intent_tags, utm_source, ip_city')
    .gte('hot_lead_fired_at', cutoff)
    .not('fub_person_id', 'is', null)
    .order('hot_lead_fired_at', { ascending: false })
    .limit(20)
  if (error) return null
  const rows = data ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-destructive" />
          Hot leads to call (last 48 hrs) — {rows.length}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hot leads in the last 48 hours. When score crosses 100 and the visitor is identified, they appear here.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((raw) => {
              const r = raw as { session_id: string; identified_email: string | null; fub_person_id: number | null; hot_lead_fired_at: string; peak_score: number; intent_tags: string[]; utm_source: string | null; ip_city: string | null }
              return (
                <li key={r.session_id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="flex-1">
                    <div className="font-medium">
                      <a href={`https://app.followupboss.com/2/people/view/${r.fub_person_id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {r.identified_email ?? `FUB #${r.fub_person_id}`}
                      </a>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Score {r.peak_score} · fired {fmtRel(r.hot_lead_fired_at)} · {r.utm_source || 'direct'} · {r.ip_city || 'unknown'}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(r.intent_tags ?? []).map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t.replace(/_/g, ' ')}</Badge>)}
                    </div>
                  </div>
                  <Link href={`/admin/visitors/${encodeURIComponent(r.session_id)}`} className="text-xs text-primary hover:underline whitespace-nowrap">
                    journey →
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

async function WarmActiveCard() {
  const supabase = getSupabase()
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('visitor_sessions')
    .select('session_id, identified_email, fub_person_id, engagement_score, intent_tags, utm_source, ip_city, last_seen_at')
    .gte('last_seen_at', cutoff)
    .gte('engagement_score', 50)
    .not('identified_at', 'is', null)
    .order('engagement_score', { ascending: false })
    .limit(15)
  if (error) return null
  const rows = data ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
          Warm prospects active now — {rows.length}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No identified visitors with score 50+ in the last 30 minutes.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((raw) => {
              const r = raw as { session_id: string; identified_email: string | null; fub_person_id: number | null; engagement_score: number; utm_source: string | null; ip_city: string | null; last_seen_at: string }
              return (
                <li key={r.session_id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex-1">
                    <a href={r.fub_person_id ? `https://app.followupboss.com/2/people/view/${r.fub_person_id}` : '#'} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                      {r.identified_email ?? `FUB #${r.fub_person_id}`}
                    </a>
                    <span className="ml-2 text-xs text-muted-foreground">
                      score {r.engagement_score} · {r.utm_source || 'direct'} · {r.ip_city || '—'} · {fmtRel(r.last_seen_at)}
                    </span>
                  </div>
                  <Link href={`/admin/visitors/${encodeURIComponent(r.session_id)}`} className="text-xs text-primary hover:underline whitespace-nowrap">journey →</Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

async function AnonymousHighEngagementCard() {
  const supabase = getSupabase()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('visitor_sessions')
    .select('session_id, engagement_score, intent_tags, utm_source, utm_campaign, ip_city, last_seen_at')
    .gte('last_seen_at', cutoff)
    .gte('engagement_score', 80)
    .is('identified_at', null)
    .order('engagement_score', { ascending: false })
    .limit(15)
  if (error) return null
  const rows = data ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
          Anonymous high-engagement (retargeting) — {rows.length}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No anonymous visitors with score 80+ in the last 24 hours.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">These visitors browsed heavily but never signed in. Build a Meta Custom Audience around their cities and intent tags for retargeting.</p>
            <ul className="space-y-2">
              {rows.map((raw) => {
                const r = raw as { session_id: string; engagement_score: number; intent_tags: string[]; utm_source: string | null; utm_campaign: string | null; ip_city: string | null; last_seen_at: string }
                return (
                  <li key={r.session_id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex-1">
                      <span className="font-medium tabular-nums">score {r.engagement_score}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {r.utm_source || 'direct'}{r.utm_campaign ? ` · ${r.utm_campaign}` : ''} · {r.ip_city || '—'} · {fmtRel(r.last_seen_at)}
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(r.intent_tags ?? []).map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t.replace(/_/g, ' ')}</Badge>)}
                      </div>
                    </div>
                    <Link href={`/admin/visitors/${encodeURIComponent(r.session_id)}`} className="text-xs text-primary hover:underline whitespace-nowrap">journey →</Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

async function SpendAlerts() {
  const supabase = getSupabase()
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [{ data: spend3d }, { data: qual3d }] = await Promise.all([
    supabase.from('marketing_channel_daily').select('value')
      .eq('channel', 'meta_ads').eq('scope', 'account').eq('metric', 'spend').gte('date', threeDaysAgo),
    supabase.from('marketing_channel_daily').select('value')
      .eq('channel', 'fub').eq('scope', 'account').eq('metric', 'qualified_seller_leads').gte('date', threeDaysAgo),
  ])
  const totalSpend = (spend3d ?? []).reduce((acc, r) => acc + (Number((r as { value: number }).value) || 0), 0)
  const totalQual = (qual3d ?? []).reduce((acc, r) => acc + (Number((r as { value: number }).value) || 0), 0)
  const alerts: { severity: 'critical' | 'warning' | 'info'; message: string }[] = []
  if (totalSpend >= 60 && totalQual === 0) {
    alerts.push({
      severity: 'critical',
      message: `Spent ${fmtUsd(totalSpend)} on Meta over the last 3 days with zero qualified seller leads. Pause the weakest ad set and audit creative before more spend ships.`,
    })
  } else if (totalSpend > 0 && totalQual > 0) {
    const cpl = totalSpend / totalQual
    if (cpl > 150) {
      alerts.push({
        severity: 'warning',
        message: `3-day cost per qualified lead is ${fmtUsd(cpl)}, above the $150 healthy threshold. Tighten audience or pause weakest creative.`,
      })
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
          Spend alerts (last 3 days)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No spend anomalies detected. {fmtUsd(totalSpend)} spent for {totalQual} qualified leads.</p>
        ) : (
          alerts.map((a, i) => (
            <Alert key={i} variant={a.severity === 'critical' ? 'destructive' : 'default'}>
              <AlertDescription className="text-sm">
                <Badge variant={a.severity === 'critical' ? 'destructive' : 'secondary'} className="mr-2">{a.severity}</Badge>
                {a.message}
              </AlertDescription>
            </Alert>
          ))
        )}
      </CardContent>
    </Card>
  )
}

async function LpRebuildCard() {
  const supabase = getSupabase()
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('visitor_sessions')
    .select('landing_page, identified_at')
    .gte('first_seen_at', cutoff)
    .limit(5000)
  if (error) return null
  const byLp = new Map<string, { visits: number; identified: number }>()
  for (const raw of (data ?? [])) {
    const r = raw as { landing_page: string | null; identified_at: string | null }
    const variant = lpVariantFromPath(r.landing_page)
    if (!variant) continue
    const b = byLp.get(variant) ?? { visits: 0, identified: 0 }
    b.visits += 1
    if (r.identified_at) b.identified += 1
    byLp.set(variant, b)
  }
  const rebuilds = Array.from(byLp.entries())
    .filter(([, b]) => b.visits >= 20 && b.identified / b.visits < 0.05)
    .map(([v, b]) => ({ variant: v, visits: b.visits, identified: b.identified, rate: b.identified / b.visits }))
    .sort((a, b) => b.visits - a.visits)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          LPs to rebuild — {rebuilds.length}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rebuilds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No LPs are below the 5% identify threshold with enough volume. Check the LP leaderboard for full rankings.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">20+ visits in 7 days but identify rate under 5%. Traffic is landing but the form/sign-in is not working.</p>
            <ul className="space-y-2">
              {rebuilds.map((r) => (
                <li key={r.variant} className="flex items-center justify-between rounded border border-border p-2 text-sm">
                  <div>
                    <span className="font-medium">{r.variant}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {r.visits} visits · {r.identified} identified · {(r.rate * 100).toFixed(1)}% rate
                    </span>
                  </div>
                  <a href={`/lp/${r.variant}/`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">open LP →</a>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default async function ActionRequiredPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Action required</h1>
        <p className="text-sm text-muted-foreground">
          The dashboard you open first thing every morning. Burn through whatever is red before you touch anything else.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}><HotLeadsCard /></Suspense>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}><WarmActiveCard /></Suspense>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}><AnonymousHighEngagementCard /></Suspense>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}><LpRebuildCard /></Suspense>
      </div>

      <Suspense fallback={<Skeleton className="h-32 w-full" />}><SpendAlerts /></Suspense>
    </div>
  )
}

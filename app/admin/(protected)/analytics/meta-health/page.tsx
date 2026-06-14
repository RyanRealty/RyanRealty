/**
 * /admin/analytics/meta-health — live Meta (FB + IG) infrastructure
 * status board.
 *
 * Eight signal cards drawn live from the Meta Graph API + our own
 * Supabase tables. Pairs with scripts/meta-admin-setup.mjs (the CLI
 * audit) and docs/META_FIX_PLAN.md (the runbook).
 *
 * Sections:
 *   1. Pixel inventory — flags dead pixels still firing
 *   2. Lead-ad form inventory — active vs archived, lifetime leads_count
 *   3. Webhook subscription — leadgen subscribed?
 *   4. Page verification status
 *   5. Recent ad activity (campaigns last 30d)
 *   6. Recent lead processing (processed_meta_leads table)
 *   7. Meta Ads spend last 30d (from marketing_channel_daily)
 *   8. Action items (auto-generated from the data above)
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PAGE_ID = process.env.META_FB_PAGE_ID
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID
const TOKEN = (process.env.META_PAGE_ACCESS_TOKEN || process.env.META_PAGE_TOKEN || '').trim()

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`
  return `${Math.floor(s / (86400 * 30))}mo ago`
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

async function fb(path: string): Promise<unknown> {
  if (!TOKEN) throw new Error('META_PAGE_ACCESS_TOKEN not set')
  const sep = path.includes('?') ? '&' : '?'
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${path}${sep}access_token=${encodeURIComponent(TOKEN)}`, { cache: 'no-store' })
    return await res.json()
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : String(e) } }
  }
}

type PixelRow = { id: string; name: string; last_fired_time: string | null; is_canonical: boolean }
type FormQuestion = { type: string; label?: string; key?: string; options?: Array<{ key: string; value: string }> }
// Meta returns privacy_policy via the `legal_content` wrapper or as the flat
// `privacy_policy_url`. The bare `privacy_policy` field is NOT exposed via GET
// even when the value is set — that was a false-positive in earlier audits.
type LeadForm = { id: string; name: string; status: string; leads_count: number; questions?: FormQuestion[]; privacy_policy_url?: string; legal_content?: { id?: string; privacy_policy?: { url?: string; link_text?: string } }; follow_up_action_url?: string }
type Subscription = { id: string; name: string; subscribed_fields: string[] }
type CampaignRow = { id: string; name: string; objective?: string; status: string; effective_status: string; created_time: string }

/** Mirrors classifyIntent() in app/api/meta/lead-webhook/route.ts.
 *  Returns null when the option text wouldn't trigger any of the buckets,
 *  which means a lead with that answer would be classified as no-tier
 *  (i.e. the canonical FUB workflow would skip auto-routing). */
function classifyOption(label: string): 'hot' | 'warm' | 'nurture' | null {
  const a = label.toLowerCase()
  if (a.includes('asap') || a.includes('immediately') || a.includes('right now') || /\bnow\b/.test(a) || a.includes('this month') || a.includes('0-3') || a.includes('0 to 3') || a.includes('within 3')) return 'hot'
  if (a.includes('this year') || a.includes('next 3') || a.includes('next 6') || a.includes('3-12') || a.includes('3 to 12') || a.includes('within 12') || a.includes('soon') || a.includes('few months')) return 'warm'
  if (a.includes('explor') || a.includes('research') || a.includes('just') || a.includes('curious') || a.includes('12+') || a.includes('more than 12') || a.includes('next year') || a.includes('not sure') || a.includes('eventually')) return 'nurture'
  return null
}

type FormQuality = {
  form: LeadForm
  hasPrivacyPolicy: boolean
  hasFollowUp: boolean
  timelineQuestion: FormQuestion | null
  timelineCoverage: Array<{ value: string; classification: 'hot' | 'warm' | 'nurture' | null }>
  bogusQuestions: string[]
  status: 'ok' | 'warning' | 'broken'
}

function analyzeForm(f: LeadForm): FormQuality {
  // Real persistence check: legal_content.privacy_policy.url OR
  // the flat privacy_policy_url field. The plain `privacy_policy` field is
  // never exposed via GET regardless of whether it's set.
  const hasPrivacyPolicy = !!(f.privacy_policy_url || f.legal_content?.privacy_policy?.url)
  const hasFollowUp = !!f.follow_up_action_url
  // Find the question whose key/label suggests timeline / when-to-buy/sell.
  const tlMatch = (q: FormQuestion) => {
    const k = `${q.key ?? ''} ${q.label ?? ''}`.toLowerCase()
    return /timeline|when|how[ _]soon|ready[ _]to|looking[ _]to|plan[ _]to/.test(k)
  }
  const timelineQuestion = f.questions?.find((q) => q.type === 'CUSTOM' && tlMatch(q) && Array.isArray(q.options)) ?? null
  const timelineCoverage = (timelineQuestion?.options ?? []).map((o) => ({ value: o.value, classification: classifyOption(o.value) }))
  const bogusQuestions: string[] = []
  for (const q of f.questions ?? []) {
    const label = (q.label ?? '').toLowerCase()
    const key = (q.key ?? '').toLowerCase()
    if (q.type === 'CUSTOM' && (label.includes('inbox url') || key.includes('inbox') || label.includes('select your private tour'))) {
      bogusQuestions.push(q.label ?? q.key ?? '(unknown)')
    }
  }
  const hasUnclassified = timelineCoverage.some((c) => c.classification === null)
  let status: 'ok' | 'warning' | 'broken' = 'ok'
  if (bogusQuestions.length > 0) status = 'broken'
  else if (!hasPrivacyPolicy || hasUnclassified || !timelineQuestion) status = 'warning'
  return { form: f, hasPrivacyPolicy, hasFollowUp, timelineQuestion, timelineCoverage, bogusQuestions, status }
}

type FbList<T> = { data?: T[] }
type FbPage = { business?: { id: string }; verification_status?: string; name?: string }

async function MetaHealthContent() {
  const supabase = getServiceSupabase()
  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  const sinceDate = since.slice(0, 10)
  const accountId = AD_ACCOUNT_ID?.startsWith('act_') ? AD_ACCOUNT_ID : `act_${AD_ACCOUNT_ID ?? ''}`

  // Parallel: Meta API + Supabase
  const [page, formsRes, subsRes, campaignsRes, processedRes, spendRes] = await Promise.all([
    fb(`${PAGE_ID}?fields=id,name,verification_status,business`) as Promise<FbPage>,
    fb(`${PAGE_ID}/leadgen_forms?fields=id,name,status,leads_count,questions,privacy_policy_url,legal_content,follow_up_action_url&limit=100`) as Promise<FbList<LeadForm>>,
    fb(`${PAGE_ID}/subscribed_apps?fields=id,name,subscribed_fields`) as Promise<FbList<Subscription>>,
    fb(`${accountId}/campaigns?fields=id,name,objective,status,effective_status,created_time&limit=50`) as Promise<FbList<CampaignRow>>,
    supabase.from('processed_meta_leads').select('id, created_at, status, campaign_name, audience, intent', { count: 'exact' }).order('created_at', { ascending: false }).limit(20),
    supabase.from('marketing_channel_daily').select('date, metric, value').eq('channel', 'meta_ads').eq('scope', 'account').gte('date', sinceDate),
  ])

  // Pixel inventory — needs business id from the page response
  let pixels: PixelRow[] = []
  if (page?.business?.id) {
    const pixelsRes = await fb(`${page.business.id}/owned_pixels?fields=id,name,last_fired_time`) as FbList<{ id: string; name: string; last_fired_time?: string }>
    pixels = (pixelsRes.data ?? []).map((p) => ({
      id: String(p.id),
      name: p.name,
      last_fired_time: p.last_fired_time ?? null,
      is_canonical: String(p.id) === String(PIXEL_ID),
    }))
  }

  const forms = formsRes.data ?? []
  const activeForms = forms.filter((f) => f.status === 'ACTIVE')
  const archivedForms = forms.filter((f) => f.status !== 'ACTIVE')
  const activeFormQuality = activeForms.map(analyzeForm)

  const subs = subsRes.data ?? []
  const leadgenSubscribed = subs.some((s) => (s.subscribed_fields ?? []).includes('leadgen'))

  const campaigns = campaignsRes.data ?? []
  const activeCampaigns = campaigns.filter((c) => c.effective_status === 'ACTIVE')

  const processedLeads = processedRes.data ?? []
  const processedLeadsTotal = processedRes.count ?? 0

  const spendByMetric = new Map<string, number>()
  for (const r of spendRes.data ?? []) {
    spendByMetric.set(r.metric, (spendByMetric.get(r.metric) ?? 0) + (Number(r.value) || 0))
  }
  const spendTotal = spendByMetric.get('spend') ?? 0
  const impressions = spendByMetric.get('impressions') ?? 0
  const clicks = spendByMetric.get('clicks') ?? 0

  // Auto-generated action items
  const actions: Array<{ severity: 'critical' | 'warning' | 'info'; message: string; deepLink?: string }> = []
  if (activeForms.length === 0) {
    actions.push({ severity: 'critical', message: `NO ACTIVE LEAD-AD FORMS — ${archivedForms.length} archived, none live. No Meta campaign can capture a lead until at least one ACTIVE form exists. Create one in Ads Manager → Page → Publishing Tools → Lead Forms.` })
  }
  for (const fq of activeFormQuality) {
    if (fq.status === 'broken') {
      actions.push({
        severity: 'critical',
        message: `Form "${fq.form.name}" (${fq.form.id}) is MISCONFIGURED — bogus questions: ${fq.bogusQuestions.join(', ')}. Archive it via Ads Manager → Instant Forms.`,
        deepLink: 'https://business.facebook.com/latest/leads_forms',
      })
    } else if (fq.status === 'warning') {
      const issues: string[] = []
      if (!fq.hasPrivacyPolicy) issues.push('no privacy_policy URL')
      if (!fq.timelineQuestion) issues.push('no timeline question')
      else {
        const unclassified = fq.timelineCoverage.filter((c) => c.classification === null).map((c) => `"${c.value}"`)
        if (unclassified.length) issues.push(`timeline options that DO NOT classify: ${unclassified.join(', ')}`)
      }
      actions.push({
        severity: 'warning',
        message: `Form "${fq.form.name}" (${fq.form.id}) needs attention: ${issues.join('; ')}.`,
        deepLink: 'https://business.facebook.com/latest/leads_forms',
      })
    }
  }
  for (const p of pixels) {
    if (p.is_canonical) continue
    const daysAgo = p.last_fired_time ? Math.floor((Date.now() - new Date(p.last_fired_time).getTime()) / 86400000) : null
    if (daysAgo !== null && daysAgo <= 30) {
      actions.push({
        severity: 'warning',
        message: `Pixel "${p.name}" (${p.id}) is not your canonical pixel but fired ${daysAgo}d ago. Codebase + WordPress HTML already verified clean — source is an external integration (Zapier, OAuth-connected app, or stale CAPI sender). Open Events Manager → Diagnostics tab to identify.`,
        deepLink: `https://business.facebook.com/events_manager2/list/pixel/${p.id}/overview`,
      })
    }
  }
  if (!leadgenSubscribed) {
    actions.push({ severity: 'critical', message: 'Page is NOT subscribed to the leadgen webhook field. Re-subscribe in Meta App Dashboard → Webhooks → Page → leadgen.' })
  }
  if (page?.verification_status === 'not_verified' || !page?.verification_status) {
    actions.push({ severity: 'info', message: 'Facebook Page is not verified. Optional but helps trust signals. Apply via Meta Business Suite → Settings → Page Setup → Page Verification.' })
  }
  if (spendTotal === 0 && activeCampaigns.length === 0) {
    actions.push({ severity: 'info', message: 'No active campaigns and $0 spend in the last 30 days. When you re-launch, run `node scripts/meta-admin-setup.mjs` first to audit ad URLs.' })
  }
  if (actions.length === 0) {
    actions.push({ severity: 'info', message: 'All Meta infrastructure checks pass.' })
  }

  return (
    <div className="space-y-6">
      {/* Hero metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active campaigns</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{formatInt(activeCampaigns.length)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatInt(campaigns.length)} total (including paused)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active lead forms</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-3xl font-semibold tabular-nums ${activeForms.length === 0 ? 'text-destructive' : 'text-foreground'}`}>{formatInt(activeForms.length)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatInt(archivedForms.length)} archived</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Spend (30d)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-foreground">${spendTotal.toFixed(2)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatInt(impressions)} impr · {formatInt(clicks)} clicks</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Leads captured</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{formatInt(processedLeadsTotal)}</p>
            <p className="mt-1 text-xs text-muted-foreground">processed_meta_leads (lifetime)</p>
          </CardContent>
        </Card>
      </div>

      {/* Action items */}
      <Card>
        <CardHeader>
          <CardTitle>What needs your attention</CardTitle>
          <p className="text-xs text-muted-foreground">Auto-generated from the live audit below. Items here trace to specific Meta API findings.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {actions.map((a, i) => (
            <Alert key={i} variant={a.severity === 'critical' ? 'destructive' : 'default'}>
              <AlertDescription className="text-sm">
                <Badge variant={a.severity === 'critical' ? 'destructive' : a.severity === 'warning' ? 'default' : 'outline'} className="mr-2">{a.severity}</Badge>
                {a.message}
                {a.deepLink && (
                  <>
                    {' '}
                    <a href={a.deepLink} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline hover:no-underline">
                      Open in Meta ↗
                    </a>
                  </>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </CardContent>
      </Card>

      {/* Pixel inventory */}
      <Card>
        <CardHeader>
          <CardTitle>Pixels ({pixels.length})</CardTitle>
          <p className="text-xs text-muted-foreground">
            All pixels owned by your Business Manager. The canonical pixel (<code className="rounded bg-muted px-1">{PIXEL_ID}</code>) is the only one your code should reference. Any non-canonical pixel that has fired recently means stale code is sending events to the wrong destination — search the codebase for that id.
          </p>
        </CardHeader>
        <CardContent>
          {pixels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No owned pixels found, or Business Manager API access denied.</p>
          ) : (
            <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Pixel ID</TableHead>
                    <TableHead>Last fired</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pixels.map((p) => {
                    const daysAgo = p.last_fired_time ? Math.floor((Date.now() - new Date(p.last_fired_time).getTime()) / 86400000) : null
                    const leaking = !p.is_canonical && daysAgo !== null && daysAgo <= 30
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium whitespace-nowrap">{p.name}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{p.id}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{p.last_fired_time ? `${formatRelative(p.last_fired_time)} (${daysAgo}d)` : '(never)'}</TableCell>
                        <TableCell>
                          {p.is_canonical && <Badge variant="default">canonical</Badge>}
                          {leaking && <Badge variant="destructive">leaking</Badge>}
                          {!p.is_canonical && !leaking && <Badge variant="outline">dead</Badge>}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead forms */}
      <Card>
        <CardHeader>
          <CardTitle>Lead-ad forms ({forms.length})</CardTitle>
          <p className="text-xs text-muted-foreground">
            Every lead-form ever created on this page. Only ACTIVE forms can accept new lead submissions. <code className="rounded bg-muted px-1">leads_count</code> is the lifetime count Meta reports for that form.
          </p>
        </CardHeader>
        <CardContent>
          {forms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lead forms on this page.</p>
          ) : (
            <>
              {/* Lead-form cards — phones */}
              <div className="space-y-2 md:hidden">
                {forms.map((f) => (
                  <div key={f.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 break-words text-sm font-medium text-foreground">{f.name}</span>
                      <Badge variant={f.status === 'ACTIVE' ? 'default' : 'outline'} className="shrink-0">{f.status}</Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate font-mono">{f.id}</span>
                      <span className="shrink-0 tabular-nums">{formatInt(f.leads_count)} lifetime leads</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Lead-form table — desktop */}
              <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Form ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right tabular-nums">Lifetime leads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forms.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.name}</TableCell>
                        <TableCell className="font-mono text-xs">{f.id}</TableCell>
                        <TableCell><Badge variant={f.status === 'ACTIVE' ? 'default' : 'outline'}>{f.status}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums">{formatInt(f.leads_count)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Form quality per ACTIVE form */}
      {activeFormQuality.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active lead-form quality</CardTitle>
            <p className="text-xs text-muted-foreground">
              For each ACTIVE form: privacy_policy presence, follow_up URL, and a per-option classification through the webhook handler&apos;s <code className="rounded bg-muted px-1">classifyIntent()</code> logic. An option that classifies as <code className="rounded bg-muted px-1">null</code> means a lead picking that answer will be enrolled as <em>nurture</em> (or skipped) regardless of actual intent.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {activeFormQuality.map((fq) => (
              <div key={fq.form.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{fq.form.name}</div>
                    <div className="text-xs text-muted-foreground">id {fq.form.id} · {fq.form.leads_count} lifetime leads</div>
                  </div>
                  <Badge variant={fq.status === 'broken' ? 'destructive' : fq.status === 'warning' ? 'default' : 'outline'}>
                    {fq.status === 'broken' ? 'misconfigured — archive' : fq.status === 'warning' ? 'needs attention' : 'ok'}
                  </Badge>
                </div>
                <ul className="mt-3 space-y-1 text-xs">
                  <li>privacy_policy URL: {fq.hasPrivacyPolicy ? '✓ set' : <span className="text-destructive">✗ missing (Meta requires this for ad approval)</span>}</li>
                  <li>follow_up URL: {fq.hasFollowUp ? '✓ set' : <span className="text-muted-foreground">not set (recommended for retention)</span>}</li>
                  <li>
                    timeline question:{' '}
                    {fq.timelineQuestion ? (
                      <>
                        ✓ found ({fq.timelineQuestion.key ?? fq.timelineQuestion.label})
                        <ul className="mt-1 space-y-0.5 pl-4 font-mono">
                          {fq.timelineCoverage.map((c, i) => (
                            <li key={i}>
                              &quot;{c.value}&quot; →{' '}
                              {c.classification ? (
                                <Badge variant="outline" className="text-[10px]">{c.classification}</Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px]">unclassified (lead becomes nurture)</Badge>
                              )}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <span className="text-destructive">✗ none — leads cannot be tiered automatically</span>
                    )}
                  </li>
                  {fq.bogusQuestions.length > 0 && (
                    <li className="text-destructive">bogus questions: {fq.bogusQuestions.join(', ')}</li>
                  )}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Webhook subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook subscriptions ({subs.length})</CardTitle>
          <p className="text-xs text-muted-foreground">
            Apps subscribed to this page&apos;s webhook fields. The <code className="rounded bg-muted px-1">leadgen</code> field must be subscribed for inbound Lead-Ad submissions to hit our <code className="rounded bg-muted px-1">/api/meta/lead-webhook</code> endpoint.
          </p>
        </CardHeader>
        <CardContent>
          {subs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscribed apps.</p>
          ) : (
            <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App</TableHead>
                    <TableHead>App ID</TableHead>
                    <TableHead>Subscribed fields</TableHead>
                    <TableHead>leadgen?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map((s) => {
                    const ok = (s.subscribed_fields ?? []).includes('leadgen')
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium whitespace-nowrap">{s.name}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{s.id}</TableCell>
                        <TableCell className="text-xs">{(s.subscribed_fields ?? []).join(', ')}</TableCell>
                        <TableCell>{ok ? <Badge variant="default">✓ subscribed</Badge> : <Badge variant="destructive">missing</Badge>}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign inventory */}
      <Card>
        <CardHeader>
          <CardTitle>Campaigns ({campaigns.length})</CardTitle>
          <p className="text-xs text-muted-foreground">
            Every campaign in the Meta ad account, regardless of status. Use the Meta-admin setup script to audit each campaign&apos;s ad URLs and auto-tag missing UTMs: <code className="rounded bg-muted px-1">node scripts/meta-admin-setup.mjs --fix-utms</code>.
          </p>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns in the account.</p>
          ) : (
            <>
              {/* Campaign cards — phones */}
              <div className="space-y-2 md:hidden">
                {campaigns.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 break-words text-sm font-medium text-foreground">{c.name}</span>
                      <Badge variant={c.effective_status === 'ACTIVE' ? 'default' : 'outline'} className="shrink-0">{c.effective_status}</Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{c.objective}</span>
                      <span className="shrink-0">{formatRelative(c.created_time)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Campaign table — desktop */}
              <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Objective</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-xs">{c.objective}</TableCell>
                        <TableCell>
                          <Badge variant={c.effective_status === 'ACTIVE' ? 'default' : 'outline'}>{c.effective_status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{formatRelative(c.created_time)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent processed leads */}
      <Card>
        <CardHeader>
          <CardTitle>Recent inbound leads ({formatInt(processedLeadsTotal)} lifetime)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Every lead the webhook has processed. Each row was created by an inbound POST from Meta after a user submitted a Lead-Ad form.
          </p>
        </CardHeader>
        <CardContent>
          {processedLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leads processed yet. The webhook is wired correctly but no campaigns are live with an active lead form.</p>
          ) : (
            <>
              {/* Lead cards — phones */}
              <div className="space-y-2 md:hidden">
                {processedLeads.map((r) => {
                  const row = r as { id: string; created_at: string; status: string | null; campaign_name: string | null; audience: string | null; intent: string | null }
                  return (
                    <div key={row.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 break-words text-sm font-medium text-foreground">{row.campaign_name ?? '—'}</span>
                        <Badge variant="outline" className="shrink-0">{row.status ?? '—'}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{formatRelative(row.created_at)}</span>
                        <span className="capitalize">· {row.audience ?? '—'}</span>
                        <span className="capitalize">· {row.intent ?? '—'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Lead table — desktop */}
              <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Audience</TableHead>
                      <TableHead>Intent</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedLeads.map((r) => {
                      const row = r as { id: string; created_at: string; status: string | null; campaign_name: string | null; audience: string | null; intent: string | null }
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="text-xs">{formatRelative(row.created_at)}</TableCell>
                          <TableCell className="text-xs">{row.campaign_name ?? '—'}</TableCell>
                          <TableCell className="text-xs capitalize">{row.audience ?? '—'}</TableCell>
                          <TableCell className="text-xs capitalize">{row.intent ?? '—'}</TableCell>
                          <TableCell><Badge variant="outline">{row.status ?? '—'}</Badge></TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">Data sources:</strong> Meta Graph API v21.0 (pixels, lead forms, subscriptions, campaigns, page),
          Supabase <code className="rounded bg-muted px-1">processed_meta_leads</code> + <code className="rounded bg-muted px-1">marketing_channel_daily</code>.
        </p>
        <p>
          <strong className="text-foreground">Tools:</strong>{' '}
          <code className="rounded bg-muted px-1">scripts/meta-admin-setup.mjs</code> (CLI audit with optional --fix-utms),{' '}
          <Link href="/admin/reports/traffic-sources" className="underline hover:no-underline">Traffic sources</Link>,{' '}
          <Link href="/admin/analytics/google-business-profile" className="underline hover:no-underline">GBP dashboard</Link>,{' '}
          <code className="rounded bg-muted px-1">docs/META_FIX_PLAN.md</code>.
        </p>
      </div>
    </div>
  )
}

export default async function MetaHealthPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Meta health</h1>
        <p className="text-sm text-muted-foreground">
          Live infrastructure status for the Meta ad account, pixel, lead forms, and webhook. Pairs with <code className="rounded bg-muted px-1">scripts/meta-admin-setup.mjs</code> (CLI fixer) and <code className="rounded bg-muted px-1">docs/META_FIX_PLAN.md</code> (runbook).
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <MetaHealthContent />
      </Suspense>
    </div>
  )
}

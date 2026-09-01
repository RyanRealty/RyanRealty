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
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md)
 * onto the verdict + needs-you pattern. Presentation only — every Graph API call,
 * every Supabase read, classifyOption(), analyzeForm() and the whole action-item
 * generator are carried over verbatim.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { getMetaPageToken } from '@/lib/meta-env'
import { QueueRow, SectionHead, StateWord, VerdictLine } from '@/components/admin/v2'
import { DataList, Figures, Loading, Trouble } from '../_components/v2/kit'
import { readMetaAudienceHold } from '@/lib/data/loop/meta-audience-hold'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PAGE_ID = process.env.META_FB_PAGE_ID
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID
const TOKEN = (getMetaPageToken() || '').trim()

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
 *  (i.e. the canonical CRM workflow would skip auto-routing). */
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
    supabase.from('processed_meta_leads').select('id, created_at, status, campaign_name, audience, intent, fub_person_id', { count: 'exact' }).order('created_at', { ascending: false }).limit(20),
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

  // D11 — detect Meta token errors and surface a clear hero alert instead
  // of silently showing empty tables.
  const pageError = (page as { error?: { message: string; code?: number } }).error
  const tokenMissing = !TOKEN

  if (tokenMissing || pageError) {
    const msg = tokenMissing
      ? 'META_PAGE_ACCESS_TOKEN is not set in environment variables.'
      : `Meta API error (code ${pageError?.code ?? '?'}): ${pageError?.message ?? 'unknown error'}.`
    const isExpired = pageError?.message?.toLowerCase().includes('expired') || pageError?.message?.toLowerCase().includes('invalid')
    return (
      <Trouble>
        <p>
          <b>Meta connection error.</b> {msg}
          {isExpired && (
            <> The page access token has expired or been revoked. Reconnect it via{' '}
              <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--a-accent)' }}>
                Meta Graph API Explorer
              </a>{' '}
              and update the <code>META_PAGE_ACCESS_TOKEN</code> environment variable.
            </>
          )}
        </p>
        <p style={{ marginTop: 'var(--a-s2)', color: 'var(--a-text-2)', fontSize: 'var(--a-text-xs)' }}>
          Once the token is refreshed, reload this page. No Meta infrastructure data is available until the token is valid.
        </p>
      </Trouble>
    )
  }

  const needsYou = actions.filter((a) => a.severity !== 'info')

  return (
    <>
      <VerdictLine tone={needsYou.length > 0 ? 'attention' : 'ok'}>
        {needsYou.length > 0 ? (
          <>
            <b>
              {needsYou.length} Meta thing{needsYou.length === 1 ? '' : 's'} need{needsYou.length === 1 ? 's' : ''} you.
            </b>{' '}
            Everything else on the account checks out.
          </>
        ) : (
          <>
            <b>Nothing needs you.</b> Pixel, lead forms, webhook and campaigns all check out.
          </>
        )}
      </VerdictLine>

      <Figures
        figures={[
          { label: 'Active campaigns', value: formatInt(activeCampaigns.length), caption: `${formatInt(campaigns.length)} total (incl. paused)` },
          { label: 'Active lead forms', value: formatInt(activeForms.length), caption: `${formatInt(archivedForms.length)} archived`, tone: activeForms.length === 0 ? 'warn' : undefined },
          { label: 'Spend (30d)', value: `$${spendTotal.toFixed(2)}`, caption: `${formatInt(impressions)} impr · ${formatInt(clicks)} clicks` },
          { label: 'Leads captured', value: formatInt(processedLeadsTotal), caption: 'processed_meta_leads (lifetime)' },
        ]}
      />

      <section aria-label="What needs your attention">
        <SectionHead>What needs your attention</SectionHead>
        <p className="av2-note">Auto-generated from the live audit below. Items here trace to specific Meta API findings.</p>
        <ul className="av2-queue">
          {actions.map((a, i) => (
            <QueueRow
              key={i}
              kind={a.severity === 'critical' ? 'Broken' : a.severity === 'warning' ? 'Check' : 'Note'}
              kindTone={a.severity === 'critical' ? 'down' : a.severity === 'warning' ? 'slow' : 'waiting'}
              title={a.message}
              action={
                a.deepLink ? (
                  <a
                    href={a.deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="av2-btn av2-btn--quiet"
                    style={{ textDecoration: 'none' }}
                  >
                    Open in Meta
                  </a>
                ) : undefined
              }
            />
          ))}
        </ul>
      </section>

      <section aria-label="Pixels">
        <SectionHead>Pixels ({pixels.length})</SectionHead>
        <p className="av2-note">
          All pixels owned by your Business Manager. The canonical pixel (<code>{PIXEL_ID}</code>) is the only one your code should reference. Any non-canonical pixel that has fired recently means stale code is sending events to the wrong destination — search the codebase for that id.
        </p>
        <DataList
          label="Pixels"
          rows={pixels}
          cap={10}
          rowKey={(p) => p.id}
          columns={[
            { key: 'name', header: 'Name', lead: true, cell: (p) => p.name },
            { key: 'id', header: 'Pixel ID', mono: true, cell: (p) => p.id },
            {
              key: 'fired',
              header: 'Last fired',
              num: true,
              cell: (p) => {
                const daysAgo = p.last_fired_time ? Math.floor((Date.now() - new Date(p.last_fired_time).getTime()) / 86400000) : null
                return p.last_fired_time ? `${formatRelative(p.last_fired_time)} (${daysAgo}d)` : '(never)'
              },
            },
            {
              key: 'status',
              header: 'Status',
              cell: (p) => {
                const daysAgo = p.last_fired_time ? Math.floor((Date.now() - new Date(p.last_fired_time).getTime()) / 86400000) : null
                const leaking = !p.is_canonical && daysAgo !== null && daysAgo <= 30
                return p.is_canonical ? (
                  <StateWord state="ok">canonical</StateWord>
                ) : leaking ? (
                  <StateWord state="down">leaking</StateWord>
                ) : (
                  <StateWord state="waiting">dead</StateWord>
                )
              },
            },
          ]}
          empty={<>No owned pixels found, or Business Manager API access denied.</>}
        />
      </section>

      <section aria-label="Lead-ad forms">
        <SectionHead>Lead-ad forms ({forms.length})</SectionHead>
        <p className="av2-note">
          Every lead-form ever created on this page. Only ACTIVE forms can accept new lead submissions. <code>leads_count</code> is the lifetime count Meta reports for that form.
        </p>
        <DataList
          label="Lead-ad forms"
          rows={forms}
          cap={10}
          rowKey={(f) => f.id}
          columns={[
            { key: 'name', header: 'Name', lead: true, cell: (f) => f.name },
            { key: 'id', header: 'Form ID', mono: true, cell: (f) => f.id },
            {
              key: 'status',
              header: 'Status',
              cell: (f) => <StateWord state={f.status === 'ACTIVE' ? 'ok' : 'waiting'}>{f.status}</StateWord>,
            },
            { key: 'leads', header: 'Lifetime leads', num: true, cell: (f) => formatInt(f.leads_count) },
          ]}
          empty={<>No lead forms on this page.</>}
        />
      </section>

      {activeFormQuality.length > 0 && (
        <section aria-label="Active lead-form quality">
          <SectionHead>Active lead-form quality</SectionHead>
          <p className="av2-note">
            For each ACTIVE form: privacy_policy presence, follow_up URL, and a per-option classification through the webhook handler&apos;s <code>classifyIntent()</code> logic. An option that classifies as <code>null</code> means a lead picking that answer will be enrolled as nurture (or skipped) regardless of actual intent.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--a-s3)', marginBottom: 'var(--a-s5)' }}>
            {activeFormQuality.map((fq) => (
              <div key={fq.form.id} className="av2-pane">
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--a-s3)', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{fq.form.name}</div>
                    <div className="av2-stamp">id {fq.form.id} · {fq.form.leads_count} lifetime leads</div>
                  </div>
                  <StateWord state={fq.status === 'broken' ? 'down' : fq.status === 'warning' ? 'slow' : 'ok'}>
                    {fq.status === 'broken' ? 'misconfigured — archive' : fq.status === 'warning' ? 'needs attention' : 'ok'}
                  </StateWord>
                </div>
                <ul className="av2-quietlist">
                  <li className="av2-quiet">
                    <span className="av2-quiet__name">privacy_policy URL</span>
                    <span style={{ color: fq.hasPrivacyPolicy ? 'var(--a-ok)' : 'var(--a-danger)' }}>
                      {fq.hasPrivacyPolicy ? 'set' : 'missing — Meta requires this for ad approval'}
                    </span>
                  </li>
                  <li className="av2-quiet">
                    <span className="av2-quiet__name">follow_up URL</span>
                    <span style={{ color: fq.hasFollowUp ? 'var(--a-ok)' : 'var(--a-text-2)' }}>
                      {fq.hasFollowUp ? 'set' : 'not set — recommended for retention'}
                    </span>
                  </li>
                  <li className="av2-quiet">
                    <span className="av2-quiet__name">timeline question</span>
                    <span style={{ color: fq.timelineQuestion ? 'var(--a-text)' : 'var(--a-danger)' }}>
                      {fq.timelineQuestion
                        ? `found (${fq.timelineQuestion.key ?? fq.timelineQuestion.label})`
                        : 'none — leads cannot be tiered automatically'}
                    </span>
                  </li>
                </ul>
                {fq.timelineQuestion ? (
                  <ul className="av2-quietlist">
                    {fq.timelineCoverage.map((c, i) => (
                      <li key={i} className="av2-quiet">
                        <span className="av2-quiet__name" style={{ fontFamily: 'var(--a-font-mono)', minWidth: 200 }}>
                          {c.value}
                        </span>
                        {c.classification ? (
                          <StateWord state="waiting">{c.classification}</StateWord>
                        ) : (
                          <StateWord state="down">unclassified — lead becomes nurture</StateWord>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {fq.bogusQuestions.length > 0 && (
                  <p style={{ color: 'var(--a-danger)', fontSize: 'var(--a-text-sm)' }}>
                    bogus questions: {fq.bogusQuestions.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Webhook subscriptions">
        <SectionHead>Webhook subscriptions ({subs.length})</SectionHead>
        <p className="av2-note">
          Apps subscribed to this page&apos;s webhook fields. The <code>leadgen</code> field must be subscribed for inbound Lead-Ad submissions to hit our <code>/api/meta/lead-webhook</code> endpoint.
        </p>
        <DataList
          label="Webhook subscriptions"
          rows={subs}
          cap={10}
          rowKey={(s) => s.id}
          columns={[
            { key: 'app', header: 'App', lead: true, cell: (s) => s.name },
            { key: 'id', header: 'App ID', mono: true, cell: (s) => s.id },
            { key: 'fields', header: 'Subscribed fields', cell: (s) => (s.subscribed_fields ?? []).join(', ') },
            {
              key: 'leadgen',
              header: 'leadgen?',
              cell: (s) =>
                (s.subscribed_fields ?? []).includes('leadgen') ? (
                  <StateWord state="ok">subscribed</StateWord>
                ) : (
                  <StateWord state="down">missing</StateWord>
                ),
            },
          ]}
          empty={<>No subscribed apps.</>}
        />
      </section>

      <section aria-label="Campaigns">
        <SectionHead>Campaigns ({campaigns.length})</SectionHead>
        <p className="av2-note">
          Every campaign in the Meta ad account, regardless of status. Use the Meta-admin setup script to audit each campaign&apos;s ad URLs and auto-tag missing UTMs: <code>node scripts/meta-admin-setup.mjs --fix-utms</code>.
        </p>
        <DataList
          label="Campaigns"
          rows={campaigns}
          cap={10}
          rowKey={(c) => c.id}
          columns={[
            { key: 'name', header: 'Name', lead: true, cell: (c) => c.name },
            { key: 'objective', header: 'Objective', cell: (c) => c.objective },
            {
              key: 'status',
              header: 'Status',
              cell: (c) => <StateWord state={c.effective_status === 'ACTIVE' ? 'ok' : 'waiting'}>{c.effective_status}</StateWord>,
            },
            { key: 'created', header: 'Created', num: true, cell: (c) => formatRelative(c.created_time) },
          ]}
          empty={<>No campaigns in the account.</>}
        />
      </section>

      <section aria-label="Recent inbound leads">
        <SectionHead>Recent inbound leads ({formatInt(processedLeadsTotal)} lifetime)</SectionHead>
        <p className="av2-note">
          Every lead the webhook has processed. Each row was created by an inbound POST from Meta after a user submitted a Lead-Ad form.
        </p>
        <DataList
          label="Recent inbound leads"
          rows={processedLeads as Array<{ id: string; created_at: string; status: string | null; campaign_name: string | null; audience: string | null; intent: string | null; fub_person_id: number | null }>}
          cap={10}
          rowKey={(row) => row.id}
          columns={[
            {
              key: 'campaign',
              header: 'Campaign',
              lead: true,
              // The processed lead's person record is the entity behind the row
              // (bar rule 3) — same /admin/people/<fub_person_id> door social
              // uses; the person route resolves legacy ids.
              cell: (row) =>
                row.fub_person_id != null ? (
                  <Link href={`/admin/people/${row.fub_person_id}`} style={{ color: 'var(--a-accent)' }}>
                    {row.campaign_name ?? '—'}
                  </Link>
                ) : (
                  row.campaign_name ?? '—'
                ),
            },
            { key: 'when', header: 'When', num: true, cell: (row) => formatRelative(row.created_at) },
            { key: 'audience', header: 'Audience', cell: (row) => row.audience ?? '—' },
            { key: 'intent', header: 'Intent', cell: (row) => row.intent ?? '—' },
            { key: 'status', header: 'Status', cell: (row) => <StateWord state="waiting">{row.status ?? '—'}</StateWord> },
          ]}
          empty={<>No leads processed yet. The webhook is wired correctly but no campaigns are live with an active lead form.</>}
        />
      </section>

      <p className="av2-note">
        Data sources: Meta Graph API v21.0 (pixels, lead forms, subscriptions, campaigns, page), Supabase <code>processed_meta_leads</code> + <code>marketing_channel_daily</code>.
      </p>
      <p className="av2-note">
        Tools: <code>scripts/meta-admin-setup.mjs</code> (CLI audit with optional --fix-utms),{' '}
        <Link href="/admin/reports/traffic-sources" style={{ color: 'var(--a-accent)' }}>Traffic sources</Link>,{' '}
        <Link href="/admin/analytics/google-business-profile" style={{ color: 'var(--a-accent)' }}>GBP dashboard</Link>,{' '}
        <code>docs/META_FIX_PLAN.md</code>.
      </p>
    </>
  )
}

export default async function MetaHealthPage() {
  const hold = await readMetaAudienceHold(getServiceSupabase())
  return (
    <div className="av2-scope" style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={hold.status === 'unreadable' || !hold.current ? 'attention' : 'ok'}>
          {hold.status === 'unreadable' ? (
            <>
              <b>Audience log unreadable.</b> INT-007 hold cannot be graded.
            </>
          ) : hold.holdMet ? (
            <>
              <b>Audience hold met.</b> {hold.consecutiveDays} consecutive UTC days ending {hold.lastDay}.
            </>
          ) : (
            <>
              <b>Audience holding {hold.consecutiveDays}/7 days.</b> Last {hold.lastDay}. KEEP waits for 2026-08-22.
            </>
          )}
        </VerdictLine>
      </div>
      <p className="av2-note">
        Live infrastructure status for the Meta ad account, pixel, lead forms, and webhook. Pairs with <code>scripts/meta-admin-setup.mjs</code> (CLI fixer) and <code>docs/META_FIX_PLAN.md</code> (runbook).
      </p>
      <Suspense fallback={<Loading what="the Meta account" />}>
        <MetaHealthContent />
      </Suspense>
    </div>
  )
}

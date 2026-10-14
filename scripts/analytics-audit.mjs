#!/usr/bin/env node
/**
 * analytics-audit.mjs — THE read-only health check of GA4, Search Console and
 * Google Tag Manager for ryan-realty.com. `npm run analytics:audit`.
 *
 * WHY ONE SCRIPT. Before 2026-10-14 every session that needed to know "is
 * tracking working" wrote its own probe (scripts/_gsc-*.mjs, scratch files in
 * session scratchpads, a GA4 Admin audit inside ga4-admin.mjs). Each one read a
 * different slice and none compared the three systems with the code. This
 * script is registered in docs/analytics/README.md ("Registry"). Extend it;
 * do not write another probe. ci:analytics-registry fails on an unregistered
 * file that calls these APIs.
 *
 * READ-ONLY. Scopes are *.readonly. It changes nothing in Google. GTM publishes
 * are Matt's (docs/GTM_GA4_BROWSER_EVENTS.md).
 *
 * Credentials: GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
 * GOOGLE_GA4_PROPERTY_ID (env or .env.local). Never printed.
 *
 *   npm run analytics:audit             # last 28 days, text report
 *   npm run analytics:audit -- --days=7
 *   npm run analytics:audit -- --json   # machine-readable
 *
 * Exit code: 0 when every check passes, 1 when any FAIL or ERROR (an API read that
 * failed) is printed, 2 when credentials are missing.
 */
import { existsSync, readFileSync } from 'node:fs'
import { google } from 'googleapis'

if (existsSync('.env.local')) {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    // Unparseable .env.local: fall back to the process environment.
  }
}

const args = process.argv.slice(2)
const DAYS = Number((args.find((a) => a.startsWith('--days=')) || '--days=28').split('=')[1]) || 28
const JSON_OUT = args.includes('--json')

const EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
const KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
const PROPERTY = process.env.GOOGLE_GA4_PROPERTY_ID?.trim()
const GSC_SITE = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim() || 'https://ryan-realty.com/'
const GTM_PUBLIC_ID = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID?.trim() || 'GTM-WV6R4NZ5'
if (!EMAIL || !KEY || !PROPERTY) {
  console.error('analytics-audit: GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY and GOOGLE_GA4_PROPERTY_ID are required.')
  process.exit(2)
}

const auth = new google.auth.JWT({
  email: EMAIL,
  key: KEY,
  scopes: [
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/tagmanager.readonly',
  ],
})
const P = `properties/${PROPERTY}`
const adminB = google.analyticsadmin({ version: 'v1beta', auth })
const adminA = google.analyticsadmin({ version: 'v1alpha', auth })
const data = google.analyticsdata({ version: 'v1beta', auth })
const gsc = google.searchconsole({ version: 'v1', auth })
const tm = google.tagmanager({ version: 'v2', auth })

const report = { generatedAt: new Date().toISOString(), days: DAYS, sections: {}, findings: [] }
const finding = (level, area, text) => report.findings.push({ level, area, text })
const safe = async (fn) => {
  try {
    return await fn()
  } catch (e) {
    return { error: String(e?.errors?.[0]?.message || e?.message || e).slice(0, 300) }
  }
}
const run = async (body) => {
  const { data: d } = await data.properties.runReport({ property: P, requestBody: { dateRanges: [{ startDate: `${DAYS}daysAgo`, endDate: 'yesterday' }], ...body } })
  return (d.rows || []).map((r) => [...(r.dimensionValues || []).map((v) => v.value), ...(r.metricValues || []).map((v) => Number(v.value))])
}

// The code's own lists, read from source so the audit can never drift from them.
function codeList(file, exportName) {
  const src = readFileSync(file, 'utf8')
  const start = src.indexOf(`export const ${exportName}`)
  if (start < 0) return []
  const body = src.slice(start, src.indexOf('] as const', start))
  return [...body.matchAll(/^\s*'([A-Za-z_]+)'/gm)].map((m) => m[1])
}
const BROWSER_EVENTS = codeList('lib/analytics/ga4-browser-events.ts', 'GA4_BROWSER_EVENTS')

// ── GA4 configuration ───────────────────────────────────────────────────────
const cfg = {}
cfg.property = await safe(async () => {
  const { data: d } = await adminB.properties.get({ name: P })
  return { displayName: d.displayName, timeZone: d.timeZone, currency: d.currencyCode }
})
cfg.retention = await safe(async () => (await adminB.properties.getDataRetentionSettings({ name: `${P}/dataRetentionSettings` })).data.eventDataRetention)
cfg.signals = await safe(async () => (await adminA.properties.getGoogleSignalsSettings({ name: `${P}/googleSignalsSettings` })).data.state)
cfg.streams = await safe(async () => ((await adminB.properties.dataStreams.list({ parent: P })).data.dataStreams || []).map((s) => ({ name: s.name, measurementId: s.webStreamData?.measurementId, uri: s.webStreamData?.defaultUri })))
if (Array.isArray(cfg.streams)) {
  for (const s of cfg.streams) {
    s.enhancedMeasurement = await safe(async () => {
      const { data: d } = await adminA.properties.dataStreams.getEnhancedMeasurementSettings({ name: `${s.name}/enhancedMeasurementSettings` })
      return Object.fromEntries(Object.entries(d).filter(([k]) => k.endsWith('Enabled')))
    })
    s.mpSecrets = await safe(async () => ((await adminB.properties.dataStreams.measurementProtocolSecrets.list({ parent: s.name })).data.measurementProtocolSecrets || []).length)
  }
}
cfg.keyEvents = await safe(async () => ((await adminB.properties.keyEvents.list({ parent: P })).data.keyEvents || []).map((k) => k.eventName))
cfg.customDimensions = await safe(async () => ((await adminB.properties.customDimensions.list({ parent: P, pageSize: 200 })).data.customDimensions || []).map((d) => `${d.parameterName}:${d.scope}`))
cfg.googleAdsLinks = await safe(async () => ((await adminB.properties.googleAdsLinks.list({ parent: P })).data.googleAdsLinks || []).map((l) => l.customerId))
cfg.primaryChannelGroup = await safe(async () => ((await adminA.properties.channelGroups.list({ parent: P })).data.channelGroups || []).find((c) => c.primary)?.displayName || 'Default channel group')
report.sections.ga4Config = cfg
// An API error is reported as ERROR (could not read), never as a finding about
// the data: a failed read is a fact about the query, not about tracking (CLAUDE.md §0).
const isErr = (v) => v && typeof v === 'object' && !Array.isArray(v) && 'error' in v
for (const [k, v] of Object.entries(cfg)) if (isErr(v)) finding('ERROR', 'ga4', `Could not read GA4 ${k}: ${v.error}`)
if (!isErr(cfg.retention) && cfg.retention !== 'FOURTEEN_MONTHS') finding('FAIL', 'ga4', `Event data retention is ${JSON.stringify(cfg.retention)}, not 14 months.`)
if (!isErr(cfg.signals) && cfg.signals !== 'GOOGLE_SIGNALS_ENABLED') finding('WARN', 'ga4', `Google Signals is ${JSON.stringify(cfg.signals)}. Matt's decision is ON.`)

// ── GA4 data health ─────────────────────────────────────────────────────────
const health = {}
const events = await safe(() => run({ dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], limit: 500 }))
const evCount = Array.isArray(events) ? Object.fromEntries(events.map(([n, c]) => [n, c])) : {}
health.events = evCount
const totals = await safe(() => run({ metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }, { name: 'engagementRate' }] }))
health.totals = Array.isArray(totals) && totals[0] ? { sessions: totals[0][0], pageViews: totals[0][1], engagementRate: totals[0][2] } : totals
health.channels = await safe(() => run({ dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 20 }))
health.hostnames = await safe(() => run({ dimensions: [{ name: 'hostName' }], metrics: [{ name: 'sessions' }], limit: 20 }))
health.leadEventsByHost = await safe(() =>
  run({ dimensions: [{ name: 'hostName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'generate_lead' } } }, limit: 10 }),
)
report.sections.ga4Health = health
for (const [k, v] of Object.entries({ events, totals, channels: health.channels, hostnames: health.hostnames, leadEventsByHost: health.leadEventsByHost }))
  if (isErr(v)) finding('ERROR', 'ga4', `Could not read the GA4 ${k} report: ${v.error}`)

if (Array.isArray(events) && !evCount.session_start) finding('FAIL', 'ga4', `session_start is 0 over ${DAYS} days: the browser Google tag is not reaching GA4 (outage canary).`)
if (Array.isArray(health.channels)) {
  const total = health.channels.reduce((a, r) => a + r[1], 0)
  const unassigned = health.channels.find((r) => r[0] === 'Unassigned')?.[1] || 0
  const share = total ? unassigned / total : 0
  health.unassignedShare = Number(share.toFixed(3))
  if (share > 0.2) finding('WARN', 'ga4', `${(share * 100).toFixed(1)}% of sessions are Unassigned (${unassigned} of ${total}). Server Measurement Protocol hits without a browser session are the usual cause.`)
}
if (Array.isArray(health.hostnames)) {
  for (const [host, sessions] of health.hostnames) {
    if (host && host !== '(not set)' && host !== 'ryan-realty.com' && !host.endsWith('.ryan-realty.com')) finding('WARN', 'ga4', `Hostname ${host} sent ${sessions} sessions to the production property.`)
  }
}
if (Array.isArray(health.leadEventsByHost)) {
  const total = health.leadEventsByHost.reduce((a, r) => a + r[1], 0)
  const orphan = health.leadEventsByHost.find((r) => r[0] === '(not set)')?.[1] || 0
  if (total && orphan / total > 0.2) finding('WARN', 'ga4', `${orphan} of ${total} generate_lead events have no hostname: they are not joined to the visitor's GA4 session (lib/analytics/ga4-server-context.ts).`)
}
if (Array.isArray(cfg.keyEvents) && Array.isArray(events)) {
  const dead = cfg.keyEvents.filter((k) => !evCount[k] && k !== 'purchase')
  health.keyEventsWithNoEvents = dead
  if (dead.length) finding('INFO', 'ga4', `Key events with 0 events in ${DAYS} days: ${dead.join(', ')}.`)
}

// ── Search Console ──────────────────────────────────────────────────────────
const sc = {}
sc.sites = await safe(async () => ((await gsc.sites.list()).data.siteEntry || []).map((s) => `${s.siteUrl} (${s.permissionLevel})`))
sc.sitemaps = await safe(async () =>
  ((await gsc.sitemaps.list({ siteUrl: GSC_SITE })).data.sitemap || []).map((m) => ({
    path: m.path,
    lastDownloaded: m.lastDownloaded,
    errors: Number(m.errors || 0),
    warnings: Number(m.warnings || 0),
    submitted: (m.contents || []).filter((c) => c.type === 'web').reduce((a, c) => a + Number(c.submitted || 0), 0),
  })),
)
const end = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10)
const start = new Date(Date.now() - (DAYS + 2) * 864e5).toISOString().slice(0, 10)
sc.searchTotals = await safe(async () => {
  const { data: d } = await gsc.searchanalytics.query({ siteUrl: GSC_SITE, requestBody: { startDate: start, endDate: end, dimensions: [] } })
  const r = (d.rows || [])[0] || {}
  return { startDate: start, endDate: end, clicks: r.clicks ?? 0, impressions: r.impressions ?? 0, ctr: r.ctr ?? 0, position: r.position ?? null }
})
report.sections.searchConsole = sc
for (const [k, v] of Object.entries(sc)) if (isErr(v)) finding('ERROR', 'gsc', `Could not read Search Console ${k}: ${v.error}`)
if (Array.isArray(sc.sitemaps)) {
  for (const m of sc.sitemaps) {
    if (m.errors) finding('FAIL', 'gsc', `Sitemap ${m.path} has ${m.errors} errors.`)
    const age = m.lastDownloaded ? (Date.now() - Date.parse(m.lastDownloaded)) / 864e5 : Infinity
    if (age > 14) finding('WARN', 'gsc', `Google last downloaded ${m.path} ${Number.isFinite(age) ? age.toFixed(0) + ' days ago' : 'never'}.`)
  }
  // The Sitemaps API stopped reporting indexed counts; it returns 0. Use URL Inspection (lib/crawl-probe/gsc.ts).
}

// ── Google Tag Manager ──────────────────────────────────────────────────────
const gtm = {}
const containers = await safe(async () => {
  const accounts = (await tm.accounts.list()).data.account || []
  const out = []
  for (const a of accounts) for (const c of (await tm.accounts.containers.list({ parent: a.path })).data.container || []) out.push(c)
  return out
})
const container = Array.isArray(containers) ? containers.find((c) => c.publicId === GTM_PUBLIC_ID) : null
if (!container) {
  gtm.error = Array.isArray(containers) ? `container ${GTM_PUBLIC_ID} not visible to the service account` : containers.error
  finding('WARN', 'gtm', `Could not read ${GTM_PUBLIC_ID}: ${gtm.error}`)
} else {
  const live = await safe(async () => (await tm.accounts.containers.versions.live({ parent: container.path })).data)
  if (!live.error) {
    gtm.liveVersion = `${live.containerVersionId} ${live.name || ''}`.trim()
    gtm.tags = (live.tag || []).map((t) => `${t.name} [${t.type}]`)
    gtm.triggers = (live.trigger || []).length
    gtm.variables = (live.variable || []).length
    const ga4Tags = (live.tag || []).filter((t) => t.type === 'googtag' || t.type === 'gaawc')
    if (ga4Tags.length !== 1) finding('FAIL', 'gtm', `Live container has ${ga4Tags.length} Google tags for GA4; it must have exactly 1 (it owns page_view).`)
    const regexTrigger = (live.trigger || []).find((t) => t.name === 'CE - GA4 browser events')
    const regex = regexTrigger?.customEventFilter?.[0]?.parameter?.find((p) => p.key === 'arg1')?.value || ''
    const live_names = new Set((regex.match(/^\^\((.*)\)\$$/)?.[1] || '').split('|').filter(Boolean))
    const missing = BROWSER_EVENTS.filter((e) => !live_names.has(e))
    const extra = [...live_names].filter((e) => !BROWSER_EVENTS.includes(e))
    gtm.browserEventsInCode = BROWSER_EVENTS.length
    gtm.browserEventsInTrigger = live_names.size
    if (!regexTrigger) finding('FAIL', 'gtm', 'Live container has no "CE - GA4 browser events" trigger: browser events reach no GA4 tag.')
    else if (missing.length || extra.length)
      finding('FAIL', 'gtm', `Trigger regex and GA4_BROWSER_EVENTS disagree. Missing in GTM: ${missing.join(', ') || 'none'}. Only in GTM: ${extra.join(', ') || 'none'}. Rebuild with npx tsx scripts/build-gtm-ga4-import.ts; Matt imports with Merge.`)
  }
  const ws = await safe(async () => (await tm.accounts.containers.workspaces.list({ parent: container.path })).data.workspace || [])
  if (Array.isArray(ws)) {
    gtm.workspaces = []
    for (const w of ws) {
      const st = await safe(async () => (await tm.accounts.containers.workspaces.getStatus({ path: w.path })).data)
      const pending = (st.workspaceChange || []).length
      gtm.workspaces.push({ name: w.name, pendingChanges: pending })
      if (pending) finding('INFO', 'gtm', `Workspace "${w.name}" has ${pending} unpublished change(s).`)
    }
  }
}
report.sections.gtm = gtm

// ── Output ──────────────────────────────────────────────────────────────────
const failed = report.findings.some((f) => f.level === 'FAIL' || f.level === 'ERROR')
if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const line = (s = '') => console.log(s)
  line(`Analytics audit · ${report.generatedAt} · last ${DAYS} days · GA4 ${PROPERTY} · GSC ${GSC_SITE} · GTM ${GTM_PUBLIC_ID}`)
  line()
  line('GA4 configuration')
  line(`  retention ${cfg.retention} · signals ${cfg.signals} · primary channel group ${cfg.primaryChannelGroup}`)
  if (Array.isArray(cfg.streams)) for (const s of cfg.streams) line(`  stream ${s.measurementId} ${s.uri} · MP secrets ${s.mpSecrets} · enhanced ${JSON.stringify(s.enhancedMeasurement)}`)
  line(`  key events (${Array.isArray(cfg.keyEvents) ? cfg.keyEvents.length : '?'}): ${Array.isArray(cfg.keyEvents) ? cfg.keyEvents.join(', ') : JSON.stringify(cfg.keyEvents)}`)
  line(`  custom dimensions (${Array.isArray(cfg.customDimensions) ? cfg.customDimensions.length : '?'}): ${Array.isArray(cfg.customDimensions) ? cfg.customDimensions.join(', ') : JSON.stringify(cfg.customDimensions)}`)
  line(`  Google Ads links: ${JSON.stringify(cfg.googleAdsLinks)}`)
  line()
  line('GA4 data')
  line(`  totals ${JSON.stringify(health.totals)} · Unassigned share ${health.unassignedShare ?? '?'}`)
  line(`  channels ${JSON.stringify(health.channels)}`)
  line(`  hostnames ${JSON.stringify(health.hostnames)}`)
  line(`  generate_lead by hostname ${JSON.stringify(health.leadEventsByHost)}`)
  line(`  top events ${JSON.stringify(Object.entries(evCount).sort((a, b) => b[1] - a[1]).slice(0, 25))}`)
  line()
  line('Search Console')
  line(`  sites ${JSON.stringify(sc.sites)}`)
  line(`  search ${JSON.stringify(sc.searchTotals)}`)
  if (Array.isArray(sc.sitemaps)) for (const m of sc.sitemaps) line(`  sitemap ${m.path} · submitted ${m.submitted} · errors ${m.errors} · last downloaded ${m.lastDownloaded}`)
  line('  (the Sitemaps API always reports indexed 0; use URL Inspection via lib/crawl-probe/gsc.ts)')
  line()
  line('Google Tag Manager')
  line(`  ${JSON.stringify(gtm)}`)
  line()
  line(`Findings (${report.findings.length})`)
  for (const f of report.findings) line(`  ${f.level.padEnd(5)} [${f.area}] ${f.text}`)
  if (!report.findings.length) line('  none')
}
process.exit(failed ? 1 : 0)

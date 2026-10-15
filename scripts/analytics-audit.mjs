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
// `{ name, from }` tables (GA4_USER_PROPERTIES, GA4_PAGE_VIEW_PARAMS), read from source the same way.
function codeMappings(file, exportName) {
  const src = readFileSync(file, 'utf8')
  const start = src.indexOf(`export const ${exportName}`)
  if (start < 0) return []
  const body = src.slice(start, src.indexOf('] as const', start))
  return [...body.matchAll(/\{\s*name:\s*'([A-Za-z_]+)',\s*from:\s*'([A-Za-z_.]+)'\s*\}/g)].map((m) => ({ name: m[1], from: m[2] }))
}
const USER_PROPERTIES = codeMappings('lib/analytics/ga4-browser-events.ts', 'GA4_USER_PROPERTIES')

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

// ── Personal information in GA4 (Matt 2026-10-14) ───────────────────────────
// GA4's terms forbid personal information, and a mailing address is one. Until
// 2026-10-14 GA4 received a CMA or BPO subject's address slug as the page path
// (/cma/cma-828-florida), a typed home address or inquiry as a page_location
// query (/sell?address=, /contact?inquiry=), the same through page_referrer,
// and a legacy CMA link's slug as the campaign name. The code now sends
// /cma/[document] and strips those params (app/api/visitors/track/strip-identity.ts,
// the one implementation). This section COUNTS what GA4 holds, never prints a
// value. Hits dated on or after PERSON_DATA_CHECK_FROM are a FAIL: something
// started sending again. The week before it lets tabs opened on the old code age out.
const PERSON_DATA_CHECK_FROM = '2026-10-21'
const stripSrc = readFileSync('app/api/visitors/track/strip-identity.ts', 'utf8')
const PERSON_PARAMS = [
  ...['_pid', '_fuid', 'rr_doc'],
  ...codeList('app/api/visitors/track/strip-identity.ts', 'PERSON_TEXT_PARAMS'),
]
const DOC_PREFIXES = (/export const GA4_PERSON_DOCUMENT_PREFIXES = \[([^\]]*)\]/.exec(stripSrc)?.[1] || '')
  .split(',')
  .map((x) => x.trim().replace(/'/g, ''))
  .filter(Boolean)
const docPathRe = `/(${DOC_PREFIXES.join('|')})/[^/?#\\[]`
const personParamRe = `[?&](${PERSON_PARAMS.join('|')})=`
const sf = (fieldName, matchType, value) => ({ filter: { fieldName, stringFilter: { matchType, value, caseSensitive: false } } })
const PERSON_DATA_QUERIES = {
  documentPaths: {
    dimension: 'pagePath',
    metric: 'eventCount',
    filter: { andGroup: { expressions: [sf('pagePath', 'PARTIAL_REGEXP', `^${docPathRe}`), { notExpression: sf('pagePath', 'CONTAINS', '[document]') }] } },
  },
  personParamLocations: { dimension: 'pageLocation', metric: 'eventCount', filter: sf('pageLocation', 'PARTIAL_REGEXP', personParamRe) },
  personReferrers: { dimension: 'pageReferrer', metric: 'eventCount', filter: sf('pageReferrer', 'PARTIAL_REGEXP', `ryan-realty\\.com(${docPathRe}|[^ ]*${personParamRe})`) },
  // A legacy utm_campaign=<cma slug> on the page address itself (event-level,
  // so a new one means something sent it). The rewrite to cma-letter is checked
  // here in JS: GA4's RE2 regex has no lookahead.
  cmaSlugLocations: {
    dimension: 'pageLocation',
    metric: 'eventCount',
    filter: sf('pageLocation', 'PARTIAL_REGEXP', '[?&]utm_[a-z]+=(test-)?cma-'),
    keep: (v) => /[?&]utm_[a-z]+=(?:test-)?cma-(?!letter(?:&|$))[a-z0-9-]+/i.test(v),
  },
  // Informational only, never a FAIL: GA4 credits a later direct session to
  // the visitor's earlier campaign (last non-direct click), so an old slug
  // keeps appearing on new sessions after nothing sends it any more.
  cmaSlugCampaigns: {
    informational: true,
    dimension: 'sessionCampaignName',
    metric: 'sessions',
    filter: {
      andGroup: {
        expressions: [
          sf('sessionCampaignName', 'FULL_REGEXP', '(test-)?cma-.+'),
          { notExpression: { filter: { fieldName: 'sessionCampaignName', inListFilter: { values: ['cma-letter', 'test-cma-letter'] } } } },
        ],
      },
    },
  },
}
async function countPersonData(q, startDate, endDate) {
  const { data: d } = await data.properties.runReport({
    property: P,
    requestBody: { dateRanges: [{ startDate, endDate }], dimensions: [{ name: q.dimension }], metrics: [{ name: q.metric }], dimensionFilter: q.filter, limit: 10000 },
  })
  const all = d.rows || []
  const rows = q.keep ? all.filter((r) => q.keep(String(r.dimensionValues?.[0]?.value || ''))) : all
  // Counts only: the values themselves are personal information and are never printed.
  const out = {
    distinct: q.keep ? rows.length : Number(d.rowCount || rows.length),
    [q.metric]: rows.reduce((a, r) => a + Number(r.metricValues?.[0]?.value || 0), 0),
  }
  if (q.dimension === 'pageLocation' || q.dimension === 'pageReferrer') {
    // Which param names (never values), so a deletion request can name them.
    const byParam = {}
    const byPage = {}
    for (const r of rows) {
      const v = String(r.dimensionValues?.[0]?.value || '')
      for (const name of PERSON_PARAMS) if (new RegExp(`[?&]${name}=`, 'i').test(v)) byParam[name] = (byParam[name] || 0) + 1
      if (new RegExp(docPathRe, 'i').test(v)) byParam['(document path)'] = (byParam['(document path)'] || 0) + 1
      // The page each one is on: the path only, a document's slug masked.
      let page = '(unparsed)'
      try {
        page = new URL(v, 'https://ryan-realty.com').pathname.replace(new RegExp(`^/(${DOC_PREFIXES.join('|')})/[^/]+`, 'i'), '/$1/[document]')
      } catch {}
      byPage[page] = (byPage[page] || 0) + 1
    }
    out.byParam = byParam
    out.byPage = Object.fromEntries(Object.entries(byPage).sort((x, y) => y[1] - x[1]).slice(0, 12))
  }
  return out
}
const personData = { window: `${DAYS}daysAgo..today`, checkFrom: PERSON_DATA_CHECK_FROM, inWindow: {}, sinceCheck: {} }
const checkStarted = new Date().toISOString().slice(0, 10) >= PERSON_DATA_CHECK_FROM
for (const [k, q] of Object.entries(PERSON_DATA_QUERIES)) {
  personData.inWindow[k] = await safe(() => countPersonData(q, `${DAYS}daysAgo`, 'today'))
  personData.sinceCheck[k] = checkStarted ? await safe(() => countPersonData(q, PERSON_DATA_CHECK_FROM, 'today')) : { distinct: 0 }
  if (isErr(personData.inWindow[k])) finding('ERROR', 'ga4', `Could not count ${k} in GA4: ${personData.inWindow[k].error}`)
}
const failing = Object.entries(personData.sinceCheck).filter(([k]) => !PERSON_DATA_QUERIES[k].informational).map(([, v]) => v)
personData.hitsSinceCheck = failing.some(isErr) ? undefined : failing.reduce((a, v) => a + (v.distinct || 0), 0)
report.sections.personData = personData
{
  const held = Object.entries(personData.inWindow).filter(([, v]) => !isErr(v) && v.distinct > 0)
  if (held.length)
    finding(
      'WARN',
      'ga4',
      `GA4 holds personal information from before the 2026-10-14 fix (last ${DAYS} days, counts only): ${held.map(([k, v]) => `${k} ${v.distinct} distinct`).join(', ')}. A GA4 data-deletion request is Matt's call (docs/analytics/README.md "No personal information in GA4").`,
    )
  if (personData.hitsSinceCheck > 0)
    finding('FAIL', 'ga4', `Personal information reached GA4 on or after ${PERSON_DATA_CHECK_FROM}: ${JSON.stringify(personData.sinceCheck)}. Find the sender; every page_location goes through stripGa4UrlParams.`)
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
    if (ga4Tags.length !== 1) finding('FAIL', 'gtm', `Live container has ${ga4Tags.length} Google tags for GA4; it must have exactly 1.`)
    // ONE page_view sender (docs/analytics/README.md "page_view"). Either the
    // Google tag sends it (send_page_view on, enhanced measurement's history
    // page views on) or, since GTM version 9, the "GA4 - page_view" tag on the
    // dataLayer push (send_page_view false, history page views off). Any other
    // mix sends none or two per page.
    const param = (t, key) => (t.parameter || []).find((p) => p.key === key)
    const configRows = (t) =>
      (param(t, 'configSettingsTable')?.list || []).map((row) => Object.fromEntries((row.map || []).map((m) => [m.key, m.value])))
    const googleTag = ga4Tags[0]
    // googtag: configSettingsTable row send_page_view=false. Legacy gaawc: the sendPageView checkbox.
    const googleTagSendsPageView = !googleTag
      ? false
      : googleTag.type === 'gaawc'
        ? String(param(googleTag, 'sendPageView')?.value ?? 'true').toLowerCase() !== 'false'
        : !configRows(googleTag).some((r) => r.parameter === 'send_page_view' && String(r.parameterValue).toLowerCase() === 'false')
    const pageViewTags = (live.tag || []).filter((t) => t.type === 'gaawe' && param(t, 'eventName')?.value === 'page_view')
    const stream = Array.isArray(cfg.streams) ? cfg.streams.find((s) => s.measurementId === 'G-ST40W4WM6T') : null
    // The Admin API omits a false boolean, so a readable settings object without
    // pageChangesEnabled means the setting is off (verified 2026-10-14 after it was turned off).
    const em = stream && !isErr(stream.enhancedMeasurement) ? stream.enhancedMeasurement : null
    const historyPageViews = em ? em.pageChangesEnabled === true : null
    gtm.googleTagTriggerIds = googleTag?.firingTriggerId || []
    gtm.pageViewOwner = googleTagSendsPageView ? 'google tag' : pageViewTags.length ? pageViewTags.map((t) => t.name).join(', ') : 'none'
    gtm.historyPageViews = historyPageViews
    if (googleTagSendsPageView && pageViewTags.length)
      finding('FAIL', 'gtm', `Two page_view senders: the Google tag and ${pageViewTags.map((t) => `"${t.name}"`).join(', ')}. Set send_page_view false on the Google tag or remove the tag.`)
    else if (!googleTagSendsPageView && pageViewTags.length === 0)
      finding('FAIL', 'gtm', 'No page_view sender: the Google tag has send_page_view false and no GA4 Event tag sends page_view.')
    else if (pageViewTags.length > 1) finding('FAIL', 'gtm', `${pageViewTags.length} GA4 Event tags send page_view; one is the rule.`)
    else if (!googleTagSendsPageView && historyPageViews === true)
      finding('FAIL', 'ga4', 'Enhanced measurement "page changes based on browser history events" is on while the dataLayer owns page_view: every client-side navigation and every ?bbox= map move counts twice. Turn it off in GA4 Admin > Data streams.')
    else if (googleTagSendsPageView && historyPageViews === false)
      finding('WARN', 'ga4', 'The Google tag owns page_view but enhanced measurement history page views are off: client-side navigations send no page_view.')
    // GTM version 10 (2026-10-14): both GA4 Event tags send content_group (= page_type)
    // and the user properties in GA4_USER_PROPERTIES (visitor_intent, primary_market),
    // each from its flat dataLayer key through a "DLV - ga4 <key>" variable.
    const listRows = (t, key, k, v) =>
      Object.fromEntries((param(t, key)?.list || []).map((row) => {
        const m = Object.fromEntries((row.map || []).map((x) => [x.key, x.value]))
        return [m[k], m[v]]
      }))
    const dlvByName = Object.fromEntries(
      (live.variable || []).filter((v) => v.type === 'v').map((v) => [v.name, (v.parameter || []).find((p) => p.key === 'name')?.value]),
    )
    const readsKey = (ref, key) => {
      const m = /^\{\{(.+)\}\}$/.exec(String(ref ?? ''))
      return !!m && dlvByName[m[1]] === key
    }
    gtm.userProperties = {}
    for (const tagName of ['GA4 - page_view', 'GA4 - dataLayer events']) {
      const t = (live.tag || []).find((x) => x.type === 'gaawe' && x.name === tagName)
      if (!t) {
        finding('FAIL', 'gtm', `Live container has no GA4 Event tag "${tagName}": its hits carry no content_group and no visitor_intent / primary_market user properties.`)
        continue
      }
      const ups = listRows(t, 'userProperties', 'name', 'value')
      const params = listRows(t, 'eventSettingsTable', 'parameter', 'parameterValue')
      gtm.userProperties[tagName] = Object.keys(ups)
      const missing = USER_PROPERTIES.filter((u) => !readsKey(ups[u.name], u.from)).map((u) => u.name)
      if (missing.length)
        finding('FAIL', 'gtm', `"${tagName}" does not set user properties ${missing.join(', ')} from their dataLayer keys (GA4_USER_PROPERTIES, GTM version 10).`)
      if (!readsKey(params.content_group, 'page_type'))
        finding('FAIL', 'gtm', `"${tagName}" does not send content_group from page_type (GTM version 10).`)
    }
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

// ── Pinned tracking decisions ───────────────────────────────────────────────
// data/analytics/decisions.json holds Matt's tracking calls. A `check` entry is
// compared with the live setup read above; a mismatch is a FAIL because GA4 or
// GTM drifted from a decision (fix the setting, never the entry:
// scripts/check-tracking-decisions.mjs guards the file).
const GTM_INITIALIZATION_TRIGGER = '2147479573' // built-in "Initialization - All Pages" (read from version 8, 2026-10-14)
const facts = {
  'gtm.pageViewOwner': gtm.pageViewOwner,
  'gtm.googleTagOnInitialization': Array.isArray(gtm.googleTagTriggerIds) ? gtm.googleTagTriggerIds.includes(GTM_INITIALIZATION_TRIGGER) : undefined,
  'ga4.historyPageViews': gtm.historyPageViews ?? undefined,
  'ga4.signals': cfg.signals,
  'ga4.retention': cfg.retention,
  'ga4.keyEvents': cfg.keyEvents,
  'ga4.primaryChannelGroup': cfg.primaryChannelGroup,
  'ga4.googleAdsLinks': cfg.googleAdsLinks,
  'ga4.customDimensions': cfg.customDimensions,
  'ga4.personDataHitsSinceFix': personData.hitsSinceCheck,
}
const canon = (v) => JSON.stringify(Array.isArray(v) ? [...v].sort() : v)
const pinned = await safe(async () => JSON.parse(readFileSync('data/analytics/decisions.json', 'utf8')).decisions || [])
const decisions = { pinned: 0, checkedLive: 0, held: [], code: 0, manual: 0 }
if (isErr(pinned)) finding('ERROR', 'decisions', `Could not read data/analytics/decisions.json: ${pinned.error}`)
else {
  decisions.pinned = pinned.length
  for (const d of pinned) {
    if (d.code) decisions.code += 1
    if (d.manual) decisions.manual += 1
    if (!d.check) continue
    const actual = facts[d.check.fact]
    if (!(d.check.fact in facts)) {
      finding('FAIL', 'decisions', `${d.id}: the audit has no fact named ${d.check.fact}.`)
      continue
    }
    if (actual === undefined || isErr(actual)) {
      finding('ERROR', 'decisions', `${d.id}: could not read ${d.check.fact} to check it.`)
      continue
    }
    decisions.checkedLive += 1
    const ok =
      'equals' in d.check
        ? canon(actual) === canon(d.check.equals)
        : Array.isArray(actual) && (d.check.includes || []).every((v) => actual.includes(v))
    if (ok) decisions.held.push(d.id)
    else finding('FAIL', 'decisions', `${d.id} (${d.decided}): live ${d.check.fact} is ${JSON.stringify(actual)}, decided ${JSON.stringify(d.check.equals ?? d.check.includes)}. ${d.why}`)
  }
}
report.sections.decisions = decisions

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
  line(`Personal information in GA4 (counts only; ${personData.window}; FAIL from ${personData.checkFrom})`)
  for (const [k, v] of Object.entries(personData.inWindow)) line(`  ${k} ${JSON.stringify(v)}`)
  line(`  since ${personData.checkFrom}: ${personData.hitsSinceCheck ?? '?'} distinct values`)
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
  line('Pinned tracking decisions (data/analytics/decisions.json)')
  line(`  ${decisions.pinned} pinned · ${decisions.checkedLive} checked live, ${decisions.held.length} held · ${decisions.code} held by code · ${decisions.manual} manual`)
  line()
  line(`Findings (${report.findings.length})`)
  for (const f of report.findings) line(`  ${f.level.padEnd(5)} [${f.area}] ${f.text}`)
  if (!report.findings.length) line('  none')
}
process.exit(failed ? 1 : 0)

#!/usr/bin/env node
/**
 * ci:page-analytics — public pages stay on one tracking philosophy.
 *
 * Layout owns page_view (PageViewTracker + VisitTracker). The URL map in
 * lib/analytics/page-type.ts is the only taxonomy. A new route is tracked
 * once its first path segment is in PUBLIC_PAGE_SEGMENTS — not by adding a
 * new GTM tag or a per-page pageType prop.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const fails = []
function check(ok, msg) {
  if (!ok) fails.push(msg)
}

function read(p) {
  if (!existsSync(p)) {
    fails.push(`missing ${p}`)
    return ''
  }
  return readFileSync(p, 'utf8')
}

const pageType = read('lib/analytics/page-type.ts')
check(/export function pageTypeFromPath/.test(pageType), 'pageTypeFromPath must exist')
check(/export function visitorPageCategoryFromPath/.test(pageType), 'visitorPageCategoryFromPath must exist (scoring trigger vocabulary)')
check(/export const PUBLIC_PAGE_SEGMENTS/.test(pageType), 'PUBLIC_PAGE_SEGMENTS must list every public first path segment')
for (const prefix of [
  "'/homes-for-sale'",
  "'/search'",
  "'/cities'",
  "'/communities'",
  "'/housing-market'",
  "'/lp/'",
  "'/sell'",
  "'/contact'",
  "'/central-oregon'",
  "'/luxury-homes-bend'",
]) {
  check(pageType.includes(prefix), `page-type.ts must classify ${prefix}`)
}

const visit = read('components/VisitTracker.tsx')
check(/from '@\/lib\/analytics\/page-type'/.test(visit), 'VisitTracker must import the shared page-type map')
check(/visitorPageCategoryFromPath/.test(visit), 'VisitTracker must use visitorPageCategoryFromPath')

const pvt = read('components/PageViewTracker.tsx')
check(/from '@\/lib\/analytics\/page-type'/.test(pvt), 'PageViewTracker must import pageTypeFromPath')
check(/trackPageView/.test(pvt), 'PageViewTracker must fire trackPageView on SPA navigations')

const scripts = read('components/site/providers/AnalyticsScripts.tsx')
check(/PageViewTracker/.test(scripts), 'AnalyticsScripts must mount PageViewTracker')
check(/GoogleAnalytics/.test(scripts), 'AnalyticsScripts must mount GoogleAnalytics')
check(/GTMBody/.test(scripts), 'AnalyticsScripts must mount GTMBody')

const layer = read('components/layout/PublicClientLayer.tsx')
check(/VisitTrackerWithSession/.test(layer), 'PublicClientLayer must mount VisitTracker')

const gtm = read('components/GTMHead.tsx')
check(/page_type/.test(gtm), 'GTMHead must push page_type onto dataLayer before gtm.js')
check(/hasAnalyticsConsent/.test(gtm), 'GTMHead must stay consent-gated')

const cookies = read('app/cookies/page.tsx')
check(!/\bfub_cid\b/.test(cookies), 'cookies page must not advertise the retired fub_cid cookie')
check(/\brr_pid\b/.test(cookies), 'cookies page must list rr_pid (the live CRM identity cookie)')

const section = read('components/site/v3/V3SectionTracker.client.tsx')
check(/from '@\/lib\/analytics\/page-type'/.test(section), 'V3SectionTracker must import the shared page-type map')
check(/pageTypeFromPath/.test(section), 'V3SectionTracker must derive page_type from the URL, not a per-page prop')

const identity = read('components/AnalyticsIdentityBridge.tsx')
check(!/gtag\(\s*['"]config['"]\s*,/.test(identity), 'AnalyticsIdentityBridge must not gtag(config) — that doubles page_view')
check(/gtag\(\s*['"]set['"]/.test(identity), 'AnalyticsIdentityBridge must set user_id via gtag(set)')

const lead = read('lib/lead-tracking.ts')
check(/crm_person_id:/.test(lead), 'lead-tracking must send crm_person_id to GA4, not a Follow Up Boss name')
check(!/fub_person_id:\s*params/.test(lead), 'lead-tracking must not emit fub_person_id as a GA4 event param')

const setup = read('scripts/ga4-admin-setup.mjs')
check(/parameterName:\s*'page_type'/.test(setup), 'ga4-admin-setup must register the page_type custom dimension')
check(/parameterName:\s*'crm_person_id'/.test(setup), 'ga4-admin-setup must register crm_person_id (not a Follow Up Boss name)')

const SKIP_FIRST = new Set(['admin', 'api', 'actions', 'components', 'data'])

function walkPages(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory()) walkPages(p, acc)
    else if (name.name === 'page.tsx' || name.name === 'page.ts') acc.push(p)
  }
  return acc
}

const listed = new Set(
  [...pageType.matchAll(/'([a-z0-9-]+)'/g)]
    .map((m) => m[1])
    .filter((s) => s.includes('-') || ['about', 'account', 'activity', 'alerts', 'areas', 'blog', 'builders', 'buy', 'cities', 'communities', 'compare', 'contact', 'cookies', 'dashboard', 'dev', 'dmca', 'faq', 'feed', 'join', 'listing', 'login', 'lp', 'marketing', 'newsletter', 'offline', 'oregon', 'parks', 'privacy', 'pulse', 'reports', 'resources', 'reviews', 'schools', 'search', 'sell', 'sign', 'signup', 'team', 'terms', 'tools', 'videos', 'zip'].includes(s)),
)

// Prefer the explicit PUBLIC_PAGE_SEGMENTS block when present.
const segBlock = pageType.match(/export const PUBLIC_PAGE_SEGMENTS = \[([\s\S]*?)\] as const/)
const publicSegs = new Set(
  segBlock ? [...segBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [...listed],
)

for (const file of walkPages('app')) {
  const src = read(file)
  check(!/<(V3|Kb)SectionTracker\s+pageType=/.test(src), `${file} must not pass a per-page pageType — the URL map owns it`)
  const rel = file.replace(/^app\//, '')
  const first = rel.split('/')[0]
  if (!first || first === 'page.tsx' || first === 'page.ts' || SKIP_FIRST.has(first)) continue
  check(publicSegs.has(first), `public page ${file} first segment /${first} is not in PUBLIC_PAGE_SEGMENTS — add it to lib/analytics/page-type.ts`)
}

if (fails.length) {
  console.error('ci:page-analytics FAILED')
  for (const f of fails) console.error('  -', f)
  process.exit(1)
}
console.log('ci:page-analytics OK — layout owns tracking; page-type map is the taxonomy.')

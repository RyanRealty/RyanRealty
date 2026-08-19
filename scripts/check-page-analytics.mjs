#!/usr/bin/env node
/**
 * ci:page-analytics — public pages stay on one tracking philosophy.
 *
 * Layout owns page_view (PageViewTracker + VisitTracker). The URL map in
 * lib/analytics/page-type.ts is the only taxonomy. A new route is tracked
 * once its prefix is in that file — not by adding a new GTM tag.
 */
import { readFileSync, existsSync } from 'node:fs'

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
for (const prefix of [
  "'/homes-for-sale'",
  "'/search'",
  "'/cities'",
  "'/communities'",
  "'/housing-market'",
  "'/lp/'",
  "'/sell'",
  "'/contact'",
]) {
  check(pageType.includes(prefix), `page-type.ts must classify ${prefix}`)
}

const visit = read('components/VisitTracker.tsx')
check(/from '@\/lib\/analytics\/page-type'/.test(visit), 'VisitTracker must import the shared page-type map')
check(/visitorPageCategoryFromPath/.test(visit), 'VisitTracker must use visitorPageCategoryFromPath')

const pvt = read('components/PageViewTracker.tsx')
check(/from '@\/lib\/analytics\/page-type'/.test(pvt), 'PageViewTracker must import pageTypeFromPath')
check(/trackPageView/.test(pvt), 'PageViewTracker must fire trackPageView (the only GA4 page_view)')

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

if (fails.length) {
  console.error('ci:page-analytics FAILED')
  for (const f of fails) console.error('  -', f)
  process.exit(1)
}
console.log('ci:page-analytics OK — layout owns tracking; page-type map is the taxonomy.')

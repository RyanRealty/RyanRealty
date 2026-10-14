#!/usr/bin/env node
/**
 * check-sitemap-url-health.mjs — ci:sitemap-url-health
 *
 * Static (default, secret-less ci:gates): robots.ts does not hide public
 * place / listing / sitemap paths; community and resort pages throw on a
 * failed listings read instead of caching "did not load" as a 200; the live
 * sweep is wired into deploy:verify.
 *
 * Live (`--live` or `npm run seo:sitemap-urls`): every loc in every sitemap
 * Google reads is HTTP 200, self-canonical on https://ryan-realty.com, and
 * not noindex. robots.txt does not block the important public paths.
 * deploy:verify uses a 400-URL stratified sample (every child sitemap +
 * community doors). Unset the cap for a full walk.
 *
 *   node scripts/check-sitemap-url-health.mjs
 *   node scripts/check-sitemap-url-health.mjs --live
 *   SITEMAP_URL_HEALTH_MAX=40 npm run seo:sitemap-urls
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LIVE_SEO_UA } from './lib/live-seo-audit.mjs'
import { auditRobotsSource, runSitemapUrlHealth } from './lib/sitemap-url-health.mjs'

const ROOT = process.cwd()
const LIVE = process.argv.includes('--live')

function fail(problems) {
  console.error('ci:sitemap-url-health FAILED:')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}

function staticAudit() {
  const problems = []
  const robotsSrc = readFileSync(join(ROOT, 'app/robots.ts'), 'utf8')
  problems.push(...auditRobotsSource(robotsSrc))

  const communityPage = readFileSync(join(ROOT, 'app/communities/[slug]/page.tsx'), 'utf8')
  if (!communityPage.includes('readOrRefuseListings')) {
    problems.push('app/communities/[slug]/page.tsx must retry then throw via readOrRefuseListings')
  }
  if (!communityPage.includes('refuseEmptyFailedListings')) {
    problems.push('app/communities/[slug]/page.tsx must refuse a timed-out empty population')
  }
  if (communityPage.includes('CommunityDegraded')) {
    problems.push('app/communities/[slug]/page.tsx must not render CommunityDegraded as a cacheable 200')
  }
  if (communityPage.includes('unstable_noStore') || /\bnoStore\s*\(/.test(communityPage)) {
    problems.push('app/communities/[slug]/page.tsx must not call noStore() (ISR 500 / ci:degraded-isr)')
  }

  const typePage = readFileSync(join(ROOT, 'app/communities/[slug]/types/[type]/page.tsx'), 'utf8')
  if (!typePage.includes('refuseUnavailableListings')) {
    problems.push('community type page must throw via refuseUnavailableListings when listings miss')
  }

  const errorSrc = readFileSync(join(ROOT, 'app/communities/[slug]/error.tsx'), 'utf8')
  if (!/noindex/.test(errorSrc)) {
    problems.push('app/communities/[slug]/error.tsx must noindex the 500 body')
  }

  if (existsSync(join(ROOT, 'app/communities/[slug]/_v3/CommunityDegraded.tsx'))) {
    problems.push('CommunityDegraded.tsx still exists — a cacheable 200 listings-miss body')
  }

  const helper = readFileSync(join(ROOT, 'lib/site/listings-unavailable.ts'), 'utf8')
  if (!helper.includes('last good ISR')) {
    problems.push('lib/site/listings-unavailable.ts must keep the last-good-ISR contract in its header')
  }

  const deploy = readFileSync(join(ROOT, 'scripts/check-vercel-deploy.mjs'), 'utf8')
  if (!deploy.includes('runSitemapUrlHealth')) {
    problems.push('scripts/check-vercel-deploy.mjs must run runSitemapUrlHealth after READY')
  }

  return problems
}

const staticProblems = staticAudit()
if (staticProblems.length) fail(staticProblems)
console.log('ci:sitemap-url-health: static robots + community listings-failure contract hold')

if (!LIVE) process.exit(0)

if (process.env.SITEMAP_URL_HEALTH_SKIP === '1') {
  console.log('seo:sitemap-urls: SKIPPED (SITEMAP_URL_HEALTH_SKIP=1)')
  process.exit(0)
}

const base = process.env.SITEMAP_URL_HEALTH_BASE ?? 'https://ryan-realty.com'
const maxUrls = process.env.SITEMAP_URL_HEALTH_MAX
  ? Number(process.env.SITEMAP_URL_HEALTH_MAX)
  : Infinity
const concurrency = Number(process.env.SITEMAP_URL_HEALTH_CONCURRENCY ?? 8)

const { fails, lines, checked } = await runSitemapUrlHealth(base, {
  ua: LIVE_SEO_UA,
  maxUrls,
  concurrency,
})
for (const line of lines) console.log(`sitemap-url-health: ${line}`)
if (fails.length > 0) {
  console.error(`✗ sitemap-url-health FAILED (${fails.length} of ${checked} checked):`)
  for (const f of fails) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`✓ sitemap-url-health: ${checked} sitemap URLs are 200, self-canonical on ryan-realty.com, and indexable`)

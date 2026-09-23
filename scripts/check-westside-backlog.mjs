#!/usr/bin/env node
/**
 * G7 lock: every WESTSIDE_BACKLOG row has a disposition, luxury money
 * surfaces link the Bend luxury page (the chrome: /homes-for-sale/bend/luxury
 * since 2026-09-23; the city and index pages: /luxury-homes-bend), and
 * deal-close stages a review-ask
 * draft without sending.
 *
 *   node scripts/check-westside-backlog.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const DISPOSITIONS = /SHIPPED|CLOSED|DONE|GATED|RE-RANKED|DEFERRED/
const backlog = src('docs/plans/WESTSIDE_BACKLOG.md')
const tableStart = backlog.indexOf('## Ranked backlog')
const tableEnd = backlog.indexOf('## Teardown findings')
const table = tableStart >= 0 && tableEnd > tableStart ? backlog.slice(tableStart, tableEnd) : ''
const rows = table
  .split('\n')
  .filter((line) => /^\| \d/.test(line) || /^\| \d+[a-z]/.test(line))
checks.push({
  label: 'WESTSIDE_BACKLOG ranked table has rows',
  ok: rows.length >= 8,
})
const undisposed = rows.filter((line) => {
  const cells = line.split('|').map((c) => c.trim())
  const last = cells[cells.length - 2] ?? ''
  return !DISPOSITIONS.test(last)
})
checks.push({
  label: 'every ranked backlog row has a disposition',
  ok: undisposed.length === 0,
  detail: undisposed.join(' | '),
})

// The chrome's luxury link moved to the INDEXABLE luxury page (visibility
// audit 2026-09-23, gsc-trend-5; owner directive MATT 2026-09-23, "nothing is
// permanent"). /luxury-homes-bend 308s (next.config.ts) to
// /homes-for-sale/bend?minPrice=1500000, which serves "noindex, follow"
// (shouldNoIndexSearchVariant), so a chrome link there spent the site's
// strongest internal link on a redirect into a page barred from the index.
// /homes-for-sale/bend/luxury is 200, "index, follow", self-canonical and in
// the sitemap (curl + live sitemaps, 2026-09-23). The rule this check locks is
// unchanged: the Buy rail links the Bend luxury page.
const nav = src('lib/site-nav.ts')
checks.push({
  label: 'site-nav buy rail links the indexable Bend luxury page, not the redirect',
  ok:
    nav.includes("href: '/homes-for-sale/bend/luxury'") &&
    /KB_TOP_NAV[\s\S]*homes-for-sale\/bend\/luxury/.test(nav) &&
    !nav.includes("href: '/luxury-homes-bend'"),
})

// The city page moved onto components/site/v3 (2026-08-26) and its
// KbPopularSearches rail left with the register. The RULE — Bend's city page
// links /luxury-homes-bend — moved into the closing Quiet's edge list, built
// by cityExploreItems, so the check follows it there.
const cityEdges = src('app/cities/[slug]/_v3/city-sections.ts')
checks.push({
  label: 'city closing edges link /luxury-homes-bend for Bend',
  ok:
    /href:\s*'\/luxury-homes-bend'/.test(cityEdges) &&
    cityEdges.includes("slug === 'bend'"),
})

// Both index pages moved onto components/site/v3 (2026-08-26), where an
// outbound edge is a `{ label, href }` item rather than an anchor attribute.
// What this gate locks is that the two indexes still LINK the luxury page
// through the shared builder, so it accepts either spelling of the href. It
// does not lock which register renders it.
const LUXURY_HREF = /href\s*[:=]\s*["']\/luxury-homes-bend["']/

const cities = src('app/cities/page.tsx')
const cityLinks = src('app/cities/CityFeaturedLinks.tsx')
checks.push({
  label: 'cities index Bend row links /luxury-homes-bend',
  ok:
    /cityFeaturedLinks/i.test(cities) &&
    LUXURY_HREF.test(cityLinks) &&
    cityLinks.includes("slug === 'bend'"),
})

const communities = src('app/communities/page.tsx')
checks.push({
  label: 'communities index links /luxury-homes-bend',
  ok: LUXURY_HREF.test(communities),
})

const template = src('lib/crm/review-ask.ts')
checks.push({
  label: 'review-ask template imports GBP_REVIEW_URL',
  ok: /GBP_REVIEW_URL/.test(template) && /export function buildReviewAskBody/.test(template),
})
checks.push({
  label: 'review-ask module never sends',
  ok: !/sendAgentSms|resend|twilio/i.test(template),
})

const stager = src('lib/data/crm/stageReviewAskDraft.ts')
checks.push({
  label: 'stager writes crm_message_drafts via upsertDraft only',
  ok: /upsertDraft/.test(stager) && !/sendEmail|sendSms|sendAgentSms/.test(stager),
})

const draftsDal = src('lib/data/crm/drafts.ts')
checks.push({
  label: 'upsertDraft insert-or-update (expression unique index, no onConflict)',
  ok:
    /getDraftsForPerson/.test(draftsDal) &&
    /\.insert\(payload\)/.test(draftsDal) &&
    !/onConflict:/.test(draftsDal),
})
checks.push({
  label: 'stager refuses to overwrite a broker draft',
  ok: /skipped-existing-draft/.test(stager),
})

// restageCrmDeal (app/actions/crm-deals.ts) was deleted as an orphan in the
// 2026-09-01 dead-code sweep (90b71b0a): nothing imported it, so the on-close
// staging it claimed never ran through it. The surviving on-close path is the
// review-ask-on-close cron below, which calls the TC scanner that stages the
// draft (lib/data/tc/stageReviewAsksForRecentCloses.ts).
const scanner = src('lib/data/tc/stageReviewAsksForRecentCloses.ts')
checks.push({
  label: 'the TC close scanner stages the review-ask draft',
  ok: /stageReviewAskDraft\(/.test(scanner),
})

const cron = src('app/api/cron/review-ask-on-close/route.ts')
checks.push({
  label: 'review-ask-on-close cron calls the TC scanner and never sends',
  ok:
    /stageReviewAsksForRecentCloses/.test(cron) &&
    !/sendEmail|sendSms|sendAgentSms/.test(cron),
})

const vercel = src('vercel.json')
checks.push({
  label: 'review-ask-on-close is registered in vercel.json',
  ok: vercel.includes('/api/cron/review-ask-on-close'),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label}${c.detail ? ` — ${c.detail}` : ''}`)
}
if (failed.length) {
  console.error(`\n${failed.length} westside-backlog check(s) failed`)
  process.exit(1)
}
console.log(`\n${checks.length} westside-backlog checks passed`)

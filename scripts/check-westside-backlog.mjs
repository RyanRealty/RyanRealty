#!/usr/bin/env node
/**
 * G7 lock: every WESTSIDE_BACKLOG row has a disposition, luxury money
 * surfaces link the luxury page, and deal-close stages a review-ask draft
 * without sending.
 *
 * THE LUXURY PAGE MOVED (UXLIVE-8, visibility audit 2026-09-22). The luxury
 * surface is /homes-for-sale/bend/luxury, the indexable search preset
 * ("Luxury Homes in Bend", 200, index,follow, self-canonical).
 * /luxury-homes-bend has been a 308 since 2026-09-06, so a door typed as
 * /luxury-homes-bend spent every page's link on a redirect hop. The rule is
 * unchanged (the money surfaces keep a luxury door); the URL it pins is now the
 * destination, and the old redirect source is refused.
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

// Both index pages moved onto components/site/v3 (2026-08-26), where an
// outbound edge is a `{ label, href }` item rather than an anchor attribute.
// What this gate locks is that the surfaces still LINK the luxury page, so it
// accepts either spelling of the href. It does not lock which register renders
// it. The redirect source is refused on every arm (UXLIVE-8).
const LUXURY_HREF = /href\s*[:=]\s*["']\/homes-for-sale\/bend\/luxury["']/
const LUXURY_REDIRECT_HREF = /href\s*[:=]\s*["']\/luxury-homes-bend["']/

const nav = src('lib/site-nav.ts')
checks.push({
  label: 'site-nav buy rail links the luxury page (/homes-for-sale/bend/luxury)',
  ok:
    LUXURY_HREF.test(nav) &&
    /KB_TOP_NAV[\s\S]*LUXURY_BEND/.test(nav) &&
    !LUXURY_REDIRECT_HREF.test(nav),
})

// The city page moved onto components/site/v3 (2026-08-26) and its
// KbPopularSearches rail left with the register. The RULE — Bend's city page
// links the luxury page — moved into the closing Quiet's edge list, built by
// cityExploreItems, so the check follows it there.
const cityEdges = src('app/cities/[slug]/_v3/city-sections.ts')
checks.push({
  label: 'city closing edges link the luxury page for Bend',
  ok:
    LUXURY_HREF.test(cityEdges) &&
    !LUXURY_REDIRECT_HREF.test(cityEdges) &&
    cityEdges.includes("slug === 'bend'"),
})

const cities = src('app/cities/page.tsx')
const cityLinks = src('app/cities/CityFeaturedLinks.tsx')
checks.push({
  label: 'cities index Bend row links the luxury page',
  ok:
    /cityFeaturedLinks/i.test(cities) &&
    LUXURY_HREF.test(cityLinks) &&
    !LUXURY_REDIRECT_HREF.test(cityLinks) &&
    cityLinks.includes("slug === 'bend'"),
})

const communities = src('app/communities/page.tsx')
checks.push({
  label: 'communities index links the luxury page',
  ok: LUXURY_HREF.test(communities) && !LUXURY_REDIRECT_HREF.test(communities),
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

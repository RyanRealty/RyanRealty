#!/usr/bin/env node
/**
 * G7 lock: every WESTSIDE_BACKLOG row has a disposition, luxury money
 * surfaces link /luxury-homes-bend, and deal-close stages a review-ask
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

const nav = src('lib/site-nav.ts')
checks.push({
  label: 'site-nav footer + buy rail link /luxury-homes-bend',
  ok:
    nav.includes("href: '/luxury-homes-bend'") &&
    /KB_FOOTER_COLUMNS[\s\S]*luxury-homes-bend/.test(nav) &&
    /KB_TOP_NAV[\s\S]*luxury-homes-bend/.test(nav),
})

// city-d deleted the popular-searches rail. The city page's luxury door now
// arrives through the shared footer columns — whose /luxury-homes-bend link
// the site-nav check above already locks — so this pins the city-d footer to
// that source instead of the retired rail.
const cityFooter = src('components/site/city-d/CityDFooter.tsx')
checks.push({
  label: 'city-d footer renders the shared KB_FOOTER_COLUMNS (carries /luxury-homes-bend)',
  ok: /KB_FOOTER_COLUMNS/.test(cityFooter) && /from ['"]@\/lib\/site-nav['"]/.test(cityFooter),
})

const cities = src('app/cities/page.tsx')
const cityLinks = src('app/cities/CityFeaturedLinks.tsx')
checks.push({
  label: 'cities index Bend row links /luxury-homes-bend',
  ok:
    cities.includes('CityFeaturedLinks') &&
    cityLinks.includes('href="/luxury-homes-bend"') &&
    cityLinks.includes("slug === 'bend'"),
})

const communities = src('app/communities/page.tsx')
checks.push({
  label: 'communities index links /luxury-homes-bend',
  ok: communities.includes('href="/luxury-homes-bend"'),
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

const restage = src('app/actions/crm-deals.ts')
checks.push({
  label: 'restageCrmDeal stages a review-ask draft on close',
  ok: /stageReviewAskDraft/.test(restage) && /shouldStageReviewAsk/.test(restage),
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

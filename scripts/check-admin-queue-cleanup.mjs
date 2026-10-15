#!/usr/bin/env node
/**
 * check-admin-queue-cleanup.mjs — holds the 2026-10-14 admin queue cleanup.
 *
 * Matt approved the audit: Today is a right-now strip, People is table-first,
 * Prospecting defaults to ready-to-send, Messages lands on Needs attention,
 * listings default Active and distinguish a query error from empty, the + FAB
 * does not cover row actions at 375px and stays off Valuations, CMA board is
 * unlinked from nav and capped, /admin/email/campaigns redirects.
 *
 * Textual on purpose: secret-less, in ci:gates.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const failures = []

function read(rel) {
  try {
    return readFileSync(join(ROOT, rel), 'utf8')
  } catch {
    failures.push(`${rel}: missing`)
    return ''
  }
}

const nav = read('lib/admin/nav.ts')
const campaigns = read('app/admin/(protected)/email/campaigns/page.tsx')
const prospecting = read('app/admin/(protected)/prospecting/page.tsx')
const filterSelect = read('app/admin/(protected)/prospecting/FilterSelect.tsx')
const messages = read('app/admin/(protected)/messages/page.tsx')
const folderSelect = read('app/admin/(protected)/messages/MessagesFolderSelect.tsx')
const messagesQueue = read('app/admin/(protected)/messages/MessagesQueue.tsx')
const peopleSidebar = read('components/admin/shared/people-list/PeopleSidebar.tsx')
const prospectBatch = read('lib/data/prospecting/batch.ts')
const prospectList = read('lib/data/prospecting/list.ts')
const listings = read('app/admin/(protected)/listings/page.tsx')
const listingsAction = read('app/actions/admin-listings.ts')
const fab = read('components/console/ConsoleQuickAction.tsx')
const shell = read('components/console/ConsoleShell.tsx')
const today = read('app/admin/(protected)/today/page.tsx')
const crm = read('app/admin/(protected)/crm/page.tsx')
const clock = read('components/admin/crm/ResponseClockPanel.tsx')
const ask = read('lib/crm/response-clock-run.ts')
const cmaQueue = read('lib/data/cma/unified-queue.ts')
const valuations = read('app/admin/(protected)/valuations/page.tsx')
const defaults = read('lib/admin/queue-defaults.ts')
const cmasPage = read('app/admin/(protected)/cmas/page.tsx')

if (!/href:\s*'\/admin\/valuations'/.test(nav) || /label:\s*'CMAs',\s*href:\s*'\/admin\/cmas'/.test(nav)) {
  failures.push('nav: CMAs child must point at /admin/valuations, not /admin/cmas')
}

if (!/redirect\(\s*(EMAIL_CAMPAIGNS_REDIRECT|'\/admin\/audiences')\s*\)/.test(campaigns)) {
  failures.push('email/campaigns: must redirect to /admin/audiences')
}
if (/getEmailCampaigns|engineering footnote|KPI strip/i.test(campaigns) && !/redirect\(/.test(campaigns)) {
  failures.push('email/campaigns: leftover campaign UI must not ship next to the redirect')
}

if (!/resolveProspectingStatus/.test(prospecting)) {
  failures.push('prospecting: must resolve status through resolveProspectingStatus (default sendable)')
}
if (!/status:\s*'sendable'/.test(filterSelect) || /status:\s*'all',\s*label:\s*'all'/.test(filterSelect.split('BUCKETS')[1]?.slice(0, 200) ?? '')) {
  // First bucket must be sendable, not all.
  const buckets = filterSelect.split('const BUCKETS')[1] ?? ''
  const first = buckets.match(/status:\s*'([^']+)'/)
  if (first?.[1] !== 'sendable') {
    failures.push(`prospecting FilterSelect: first bucket must be sendable, got ${first?.[1] ?? 'none'}`)
  }
}

if (!/resolveMessagesFolder/.test(messages)) {
  failures.push('messages: must resolve folder through resolveMessagesFolder (default inbox)')
}
if (!/if \(e\.target\.value === 'inbox'\) next\.delete\('f'\)/.test(folderSelect)) {
  failures.push("messages folder select: inbox is the default — omit ?f= for Needs attention")
}
if (!/minWidth:\s*'12\.5rem'/.test(folderSelect) || !/maxWidth:\s*'none'/.test(folderSelect)) {
  failures.push('messages folder select: must keep Needs attention readable on a 375px toolbar (minWidth 12.5rem, maxWidth none)')
}
if (!/flexWrap:\s*'wrap'/.test(messagesQueue) || !/minWidth:\s*'12\.5rem'/.test(messagesQueue)) {
  failures.push('messages queue: folder chip must not flex:1 squeeze on mobile')
}

if (!/resolveListingsStatus/.test(listings)) {
  failures.push('listings: must resolve status through resolveListingsStatus (default Active)')
}
if (!/listingsFeedCopy/.test(listings)) {
  failures.push('listings: must use listingsFeedCopy so a query error is not an empty feed')
}
if (!/error:\s*string\s*\|\s*null/.test(listingsAction) && !/error:/.test(listingsAction)) {
  failures.push('getAdminListingsPage: must return an error field instead of silent empty rows')
}

if (!/isConsoleFabSuppressed/.test(fab)) {
  failures.push('ConsoleQuickAction: must hide via isConsoleFabSuppressed (includes /admin/valuations)')
}
if (!/ADMIN_FAB_HEADER_SLOT_ID/.test(fab) || !/createPortal/.test(fab)) {
  failures.push('ConsoleQuickAction: mobile + must portal into ADMIN_FAB_HEADER_SLOT_ID')
}
if (/fixed bottom-20 right-5/.test(fab)) {
  failures.push('ConsoleQuickAction: must not pin the + over row actions at 375 (move it to the header)')
}
if (!/admin-console-header-actions/.test(shell)) {
  failures.push('ConsoleShell: must render #admin-console-header-actions for the mobile +')
}
if (!/pb-36/.test(shell) || /<main className="[^"]*pb-24/.test(shell)) {
  failures.push('ConsoleShell: mobile main padding must be pb-36 so the tab bar does not cover the last row')
}

if (!/dedupeInboundReplies|capRightNow/.test(today)) {
  failures.push('today: must build the right-now strip from dedupeInboundReplies (not the uncapped firehose)')
}
if (/Sequence steps waiting on you/.test(today)) {
  failures.push('today: parked sequence steps must not render on this screen')
}

if (!/ContactsSearch/.test(crm)) {
  failures.push('people: search must stay on the page')
}
if (/SITE-09[\s\S]{0,80}response clock is the first thing/.test(crm)) {
  failures.push('people: do not lead with the methodology clock; table first')
}

if (/Last 28 days\. \{sourceLine\}/.test(clock) && !/showMethodology \? \(/.test(clock)) {
  failures.push('ResponseClockPanel: methodology sourceLine must not render by default')
}
if (/return 'to talk to a broker'/.test(ask)) {
  failures.push("askOf: fallback must not be 'to talk to a broker' (prints as Asked for to talk to a broker)")
}

const limitMatch = cmaQueue.match(/export const CMA_QUEUE_READ_LIMIT\s*=\s*(\d+)/)
if (!limitMatch || Number(limitMatch[1]) > 250) {
  failures.push(`CMA_QUEUE_READ_LIMIT must be <= 250 so /admin/cmas cannot hang (got ${limitMatch?.[1] ?? 'missing'})`)
}
if (!/RetryCmaForm/.test(valuations)) {
  failures.push('valuations: failed builds must offer RetryCmaForm')
}
{
  const failedAt = valuations.indexOf('aria-label="Failed builds"')
  const draftsAt = valuations.indexOf('aria-label="CMA drafts"')
  if (failedAt < 0 || draftsAt < 0 || failedAt > draftsAt) {
    failures.push('valuations: Failed builds must render above CMA drafts')
  }
  if ((valuations.match(/aria-label="Failed builds"/g) ?? []).length !== 1) {
    failures.push('valuations: Failed builds must appear once')
  }
}

if (!defaults.includes("PROSPECTING_DEFAULT_STATUS = 'sendable'")) {
  failures.push('queue-defaults: PROSPECTING_DEFAULT_STATUS must be sendable')
}
if (!defaults.includes("ADMIN_FAB_HEADER_SLOT_ID = 'admin-console-header-actions'")) {
  failures.push('queue-defaults: ADMIN_FAB_HEADER_SLOT_ID must name the header portal slot')
}
if (!/prospectOutreachAlreadySent/.test(prospectBatch) || !/PROSPECTING_RELIST_IN_CHUNK/.test(prospectBatch)) {
  failures.push('prospecting batch: skip already-sent rows and paginate listings .in()')
}
if (!/PROSPECTING_WORKLIST_READ_LIMIT/.test(prospectList)) {
  failures.push('prospecting list: must cap the default worklist read')
}
if (!/defaultOpen=\{col\.views\.some/.test(peopleSidebar)) {
  failures.push('PeopleSidebar: collection groups must start collapsed unless they hold the active view')
}
if (!/listCmaQueue\(\{\s*limit:\s*CMA_QUEUE_READ_LIMIT/.test(cmasPage) && !/CMA_QUEUE_PAGE_READ_LIMIT/.test(cmasPage)) {
  failures.push('cmas page: must read a capped page, not an unbounded firehose')
}

if (failures.length) {
  console.error('✗ admin queue cleanup:')
  for (const f of failures) console.error('  ' + f)
  process.exit(1)
}
console.log('✓ admin queue cleanup: redirects, defaults, header FAB, Today strip, CMA cap.')

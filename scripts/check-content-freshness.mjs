#!/usr/bin/env node
/**
 * G-FRESH — no stale confirmed dates on content pages
 * (docs/CONTENT_ENGINE_SPEC.md §8 / §5.2). A live page must never advertise a
 * past date as "next" — it is both a §0 accuracy failure and a freshness/quality
 * signal failure (fake or stale freshness backfires for AI citation). This gate
 * FAILS THE BUILD when any event's `nextConfirmedDate` is in the past, forcing
 * the roll-forward-or-null decision. Deterministic; uses today's date.
 *
 * Research basis: content updated within ~30 days earns materially more AI
 * citations; stale/past-dated events are the opposite signal.
 * (Ahrefs freshness study; Google publication-date guidance)
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const today = new Date().toISOString().slice(0, 10)
const GRACE_DAYS = 1 // allow the day-of + one day of slack before failing

function minusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}
const cutoff = minusDays(today, GRACE_DAYS)

const src = fs.readFileSync(path.join(ROOT, 'data/co-events.ts'), 'utf8')
const slugs = [...src.matchAll(/\n\s*slug:\s*'([^']+)'/g)]
const fail = []
for (let i = 0; i < slugs.length; i++) {
  const block = src.slice(slugs[i].index, i + 1 < slugs.length ? slugs[i + 1].index : src.length)
  const slug = slugs[i][1]
  // Use endDate when present (a multi-day event is "current" through its end).
  const end = block.match(/\bendDate:\s*'(\d{4}-\d{2}-\d{2})'/)?.[1]
  const start = block.match(/\bnextConfirmedDate:\s*'(\d{4}-\d{2}-\d{2})'/)?.[1]
  const last = end ?? start
  if (last && last < cutoff) {
    fail.push(`event/${slug}: ${end ? 'endDate' : 'nextConfirmedDate'} ${last} is in the past (today ${today}) — roll it forward or set null + recurrence.`)
  }
}

console.log('content-freshness gate (G-FRESH)')
console.log('================================')
if (fail.length) {
  console.error(`\n✗ ${fail.length} stale-date violation(s):`)
  for (const f of fail) console.error('  ' + f)
  console.error('\nA page must never show a past date as upcoming (§0 + freshness). Re-verify against the official source, then bump the date or null it.')
  process.exit(1)
}
console.log(`✓ No stale confirmed dates (checked against ${today}).`)

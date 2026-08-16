#!/usr/bin/env node
/**
 * G10 lock: /join convert cannot go UNKNOWN on the packet.
 * Visits + conversions are read from visitor_events via getJoinConversionStats.
 *
 *   node scripts/check-join-conversion.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const dal = src('lib/data/loop/join-conversion.ts')
checks.push({
  label: 'DAL exports getJoinConversionStats + recordJoinConversion + isJoinInquiry',
  ok:
    /export async function getJoinConversionStats/.test(dal) &&
    /export async function readJoinConversionStats/.test(dal) &&
    /export async function recordJoinConversion/.test(dal) &&
    /export function isJoinInquiry/.test(dal) &&
    /JOIN_CONVERT_EVENT = 'join_convert'/.test(dal),
})
checks.push({
  label: 'DAL names visitor_events as the series table',
  ok: /visitor_events via getJoinConversionStats/.test(dal) && /event_type=join_convert/.test(dal),
})

const signals = src('lib/data/loop/signals.ts')
checks.push({
  label: 'scoreboard reads join via the DAL (not a raw count)',
  ok:
    /readJoinConversionStats/.test(signals) &&
    /join:/.test(signals) &&
    /visits7d/.test(signals) &&
    /conversions7d/.test(signals) &&
    /joinStats\.source/.test(signals),
})

const contact = src('app/contact/actions.ts')
checks.push({
  label: 'contact form writes join_convert and skips buyer enroll on Join the team',
  ok:
    /isJoinInquiry/.test(contact) &&
    /recordJoinConversion/.test(contact) &&
    /tagRecruitJoin/.test(contact) &&
    (/lead_type: 'recruit'/.test(contact) || /\? 'recruit'/.test(contact)),
})

const track = src('app/api/visitors/track/route.ts')
checks.push({
  label: 'visitor track allowlist includes join_convert',
  ok: /'join_convert'/.test(track),
})

const today = src('app/admin/(protected)/today/page.tsx')
checks.push({
  label: 'Today reads the same DAL the packet reads',
  ok: /getJoinConversionStats/.test(today) && /join\.visits7d/.test(today),
})

const joinPage = src('app/join/page.tsx')
checks.push({
  label: '/join mounts JoinCtaTracker for phone + contact CTA',
  ok: /JoinCtaTracker/.test(joinPage),
})

const packet = src('docs/plans/COMPANY_SCOREBOARD.md')
checks.push({
  label: 'packet no longer writes /join convert UNKNOWN',
  ok: !/\/join`? convert UNKNOWN/i.test(packet) && !/`\/join` UNKNOWN/.test(packet) && !/\/join UNKNOWN/.test(packet),
})
checks.push({
  label: 'packet cites getJoinConversionStats / visitor_events',
  ok: /getJoinConversionStats/.test(packet) && /visitor_events/.test(packet) && /join_convert/.test(packet),
})

const lookup = src('docs/DATABASE_FOR_AI_AGENTS.md')
checks.push({
  label: 'DATABASE_FOR_AI_AGENTS lookup names /join conversion',
  ok: /getJoinConversionStats/.test(lookup) && /join_convert/.test(lookup),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\n${failed.length}/${checks.length} failed`)
  process.exit(1)
}
console.log(`\n${checks.length}/${checks.length} passed`)

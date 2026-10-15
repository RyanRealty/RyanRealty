/**
 * scripts/audit-visitor-automation.ts
 *
 * Read-only audit of the automation classifier (lib/analytics/automation.ts)
 * over a window of visitor_sessions: what it flags today, what the provisional
 * cold-arrival rules would flag, and whether any session that proved to be a
 * person would end up flagged. Every figure printed is a count over rows the
 * DAL returned (lib/data/analytics/visitorAutomationAudit.ts), with the window
 * and the filter beside it (CLAUDE.md §0). No personal data is printed: counts,
 * towns and browser families only.
 *
 *   npx tsx scripts/audit-visitor-automation.ts              # the 14 days to now
 *   npx tsx scripts/audit-visitor-automation.ts --days 30
 *   npx tsx scripts/audit-visitor-automation.ts --since 2026-10-07 --until 2026-10-14
 *   ... --reflag-csv out/reflag.csv   # also write session_id,reason for every session the
 *                                     # replay flags that is not flagged today (gitignored out/;
 *                                     # input to the re-flag proposal, which only Matt approves)
 *
 * How a rule is replayed on history. The track route classifies a session from
 * the request's User-Agent and IP geo headers at every consent tier, but stores
 * them only at the analytics tier, so a session stored without a user agent and
 * town cannot be replayed (counted as `not replayable`). The landing page is
 * stored with the identity token stripped, so a tracked-link arrival reads as
 * cold here; such a session is identified, and identification clears a
 * provisional flag, which the replay applies. A replayed session ends flagged
 * when its arrival is provisional, no event shows a person (isPersonEvidence),
 * and it was never identified.
 *
 * "People" (the must-not-flag check): sessions stamped with a CRM contact, on a
 * browser the identity map holds against a contact, or carrying a form, opt-in,
 * save or click event. The check that can fail is the arrival one: every person
 * a rule flagged at birth is listed (for review). Still flagged at the end is
 * reported too and exits 1, but identification and person evidence clear a
 * provisional class by design, so it holds by construction.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()

// `server-only` throws in a bare tsx process; install the resolve hook before any lib import.
const { installServerOnlyShim } = require('./lib/server-only-shim.cjs') as {
  installServerOnlyShim: (repoRoot?: string) => void
}
installServerOnlyShim()

import type { AuditEvent, AuditSessionRow } from '@/lib/data/analytics/visitorAutomationAudit'

const PERSON_EVENT_TYPES = new Set(['identify', 'signin', 'intent_declared', 'email_opt', 'sms_opt', 'join_convert', 'save_listing', 'cta_click'])

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}

function browserFamily(ua: string | null): string {
  if (!ua) return '(not stored)'
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'macOS'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'other'
  const m = ua.match(/(Edg|OPR|SamsungBrowser|CriOS|FxiOS|Firefox|Chrome|Version)\/(\d+)/)
  const name = m ? (m[1] === 'Version' ? 'Safari' : m[1]) : 'unknown'
  return `${os} ${name}${m ? ` ${m[2]}` : ''}`
}

function top(counts: Map<string, number>, n: number): string {
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `      ${String(v).padStart(5)}  ${k}`)
    .join('\n')
}

function bump(m: Map<string, number>, k: string) {
  m.set(k, (m.get(k) ?? 0) + 1)
}

async function main() {
  const auto = await import('@/lib/analytics/automation')
  const { readAutomationAuditWindow } = await import('@/lib/data/analytics/visitorAutomationAudit')

  const until = arg('--until') ? new Date(`${arg('--until')}T00:00:00Z`) : new Date()
  const since = arg('--since')
    ? new Date(`${arg('--since')}T00:00:00Z`)
    : new Date(until.getTime() - Number(arg('--days') ?? 14) * 86_400_000)

  const w = await readAutomationAuditWindow({ sinceIso: since.toISOString(), untilIso: until.toISOString() })
  if (w.unreadable) {
    console.error(`unreadable: ${w.errorMessage}`)
    process.exit(1)
  }

  const isPerson = (s: AuditSessionRow, evs: AuditEvent[]) =>
    s.crm_person_id != null ||
    (s.rr_vid != null && w.knownBrowsers.has(s.rr_vid)) ||
    evs.some((e) => PERSON_EVENT_TYPES.has(e.type))
  const identified = (s: AuditSessionRow) => s.crm_person_id != null || (s.rr_vid != null && w.knownBrowsers.has(s.rr_vid))
  // The stored landing page has the identity token stripped, so a tracked-link
  // arrival is read back from how the session was identified: the route saw the
  // token on that request (hasToken) and never flagged it.
  const arrivedWithToken = (s: AuditSessionRow) =>
    typeof s.identified_via === 'string' && (s.identified_via.startsWith('tracked_link:') || s.identified_via.startsWith('email_click'))

  let flaggedNow = 0
  let unflaggedNow = 0
  let replayable = 0
  let notReplayable = 0
  let people = 0
  let peopleBirthFlagged = 0
  let peopleEndFlagged = 0
  const peopleBirth = new Map<string, number>()
  const byReason = new Map<string, number>()
  type Tally = { birth: number; end: number; endOnUnflagged: number; towns: Map<string, number>; browsers: Map<string, number> }
  const rule = new Map<string, Tally>()
  const clearedBy = new Map<string, number>()
  const reflag: Array<{ sessionId: string; reason: string }> = []

  for (const s of w.sessions) {
    const evs = w.events.get(s.session_id) ?? []
    if (s.is_automated) {
      flaggedNow++
      bump(byReason, s.automation_reason ?? '(none)')
    } else unflaggedNow++
    const person = isPerson(s, evs)
    if (person) people++

    // A UA-class flag stands as it is: the provisional rules apply to sessions it left alone.
    if (s.is_automated && !auto.isProvisionalReason(s.automation_reason) && s.automation_reason !== null) continue
    // Without a stored user agent or town only the contact-deep-link shape replays.
    if (!s.user_agent && !s.ip_city) notReplayable++
    else replayable++
    const shape = auto.classifyArrivalShape({
      landingPage: s.landing_page,
      referrer: s.referrer,
      userAgent: s.user_agent,
      geo: { city: s.ip_city, region: s.ip_region, country: s.ip_country },
      atMs: Date.parse(s.first_seen_at),
      hasToken: arrivedWithToken(s),
    })
    if (!shape.automated || !shape.reason) continue
    const landing = s.landing_page
    const birthEvidence = evs.length > 0 && auto.isPersonEvidence({ eventType: evs[0].type, pageUrl: evs[0].pageUrl, landingPage: landing })
    if (birthEvidence) {
      bump(clearedBy, 'not set: the first event showed a person')
      continue
    }
    const t = rule.get(shape.reason) ?? { birth: 0, end: 0, endOnUnflagged: 0, towns: new Map(), browsers: new Map() }
    rule.set(shape.reason, t)
    t.birth++
    if (person) {
      peopleBirthFlagged++
      bump(peopleBirth, `${shape.reason}, identified via ${s.identified_via ?? '(not identified)'}, ${browserFamily(s.user_agent)}, ${s.ip_city ?? '(no town)'}`)
    }
    const later = evs.slice(1).find((e) => auto.isPersonEvidence({ eventType: e.type, pageUrl: e.pageUrl, landingPage: landing }))
    if (later) {
      bump(clearedBy, `cleared by a later ${later.type}`)
      continue
    }
    if (identified(s)) {
      bump(clearedBy, 'cleared by identification')
      continue
    }
    t.end++
    if (!s.is_automated) {
      t.endOnUnflagged++
      reflag.push({ sessionId: s.session_id, reason: shape.reason })
    }
    if (person) peopleEndFlagged++
    bump(t.towns, `${s.ip_city ?? '(no town)'}, ${s.ip_region ?? '-'} ${s.ip_country ?? ''}`.trim())
    bump(t.browsers, browserFamily(s.user_agent))
  }

  const newlyFlagged = [...rule.values()].reduce((a, t) => a + t.endOnUnflagged, 0)
  console.log(`Visitor automation audit (read ${new Date().toISOString()})`)
  console.log(`  window: visitor_sessions.first_seen_at in [${w.sinceIso}, ${w.untilIso})`)
  console.log(`  rows: ${w.sessions.length} sessions, ${w.eventRowsRead} visitor_events rows read, ${w.knownBrowsers.size} browsers in visitor_identity_map with a contact`)
  console.log(`\nAs stored today: ${flaggedNow} flagged, ${unflaggedNow} not flagged`)
  console.log(top(byReason, 20))
  console.log(`\nReplay of the provisional cold-arrival rules (contact-deep-link, stale-browser, datacenter-geo)`)
  console.log(
    `  stale-browser and datacenter-geo replay on ${replayable} sessions with a stored user agent or town; ` +
      `${notReplayable} were stored at the essential tier without them (only contact-deep-link replays there)`,
  )
  for (const [reason, t] of rule) {
    console.log(`\n  ${reason}: set at birth ${t.birth}, still flagged after the session's events ${t.end} (of which not flagged today ${t.endOnUnflagged})`)
    console.log('    towns:')
    console.log(top(t.towns, 12))
    console.log('    browsers:')
    console.log(top(t.browsers, 12))
  }
  console.log('\n  sessions the rules did not end up flagging:')
  console.log(top(clearedBy, 10))
  console.log(`\nNot flagged today, flagged by the replay: ${newlyFlagged} (not flagged today after: ${unflaggedNow - newlyFlagged})`)
  console.log(`\nPeople check: ${people} sessions proved a person (contact, known browser, form, opt-in, save or click)`)
  // The test that can fail: did a rule fire on a person's arrival at all, before
  // their own events or identification could clear it? (Still flagged at the end
  // is reported too, but identification and person evidence clear by design.)
  console.log(`  flagged at birth by a provisional rule: ${peopleBirthFlagged}${peopleBirthFlagged === 0 ? '  (PASS)' : '  (REVIEW: listed below)'}`)
  if (peopleBirth.size) console.log(top(peopleBirth, 20))
  console.log(`  still flagged after their events and identification: ${peopleEndFlagged}${peopleEndFlagged === 0 ? '  (PASS)' : '  (FAIL)'}`)
  if (peopleEndFlagged > 0) process.exitCode = 1

  const csv = arg('--reflag-csv')
  if (csv) {
    const { writeFileSync, mkdirSync } = await import('node:fs')
    const { dirname } = await import('node:path')
    mkdirSync(dirname(csv), { recursive: true })
    writeFileSync(csv, ['session_id,reason', ...reflag.map((r) => `${r.sessionId},${r.reason}`)].join('\n') + '\n')
    console.log(`\nWrote ${reflag.length} rows to ${csv} (session_id,reason; nothing written to the database)`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

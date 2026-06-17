/**
 * G49 — CRM lead-integrity gate (Follow Up Boss).
 *
 * Locks the lead-ingestion invariants verified by the 2026 CRM deep-research
 * (docs/CRM_INTEGRATION.md). Each maps to a Follow Up Boss API rule + a real
 * conversion/attribution consequence:
 *
 *   - events-not-people: inbound leads MUST be created via POST /v1/events, never
 *     POST /v1/people. Only /events runs dedup AND fires action plans / the
 *     speed-to-lead auto-text. A /people-created lead is silently NOT auto-texted
 *     and can duplicate. (FUB docs: "Do not use POST /v1/people to send leads.")
 *   - textMessages is log-only: POST /v1/textMessages only RECORDS a message, it
 *     does NOT send. No code path may treat it as a send mechanism (TCPA-adjacent).
 *   - source is required on every event so marketing attribution survives.
 *
 * This gate prevents NEW violations. The ONE pre-existing violation (the Meta
 * Lead Ads webhook still POSTs /people) is tracked in KNOWN_PEOPLE_POST with a
 * FIXME: it must migrate to /events (a live-verified pass — see CRM_INTEGRATION
 * backlog #1). When fixed, delete its entry and the lock is total.
 *
 * Usage: node scripts/check-crm-lead-integrity.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const BT = String.fromCharCode(96) // backtick — endpoint template-literal close

// Files that legitimately contain a /people POST. The Meta Lead Ads webhook is
// now EVENTS-FIRST (creates leads via POST /v1/events through sendEvent, so they
// get dedup + action plans + the speed-to-lead auto-text). Its /v1/people POST
// remains ONLY as a fallback when the events path fails, so a paid lead is never
// lost — an intentional safety net, not a lead-creation path. (events-first 2026-06-17)
const KNOWN_PEOPLE_POST = new Set([
  'app/api/meta/lead-webhook/route.ts',
])

const SCAN = ['lib', 'app']
function walk(dir, out = []) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return out
  for (const name of readdirSync(abs)) {
    if (name === 'node_modules' || name === '.next') continue
    const rel = `${dir}/${name}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel)
  }
  return out
}

const files = SCAN.flatMap((d) => walk(d))
const fails = []

// ── 1. events-not-people ──────────────────────────────────────────────────────
// The bare `/people` endpoint (template-literal close, e.g. `${FUB_BASE}/people`)
// is the lead-creation anti-pattern. PUT updates use `/people/${id}` (a slash, not
// a backtick) so they are not matched. Query reads use `/people?...`.
for (const rel of files) {
  const src = readFileSync(join(ROOT, rel), 'utf8')
  const postsToBarePeople = src.includes('/people' + BT) && /method:\s*['"]POST['"]/.test(src)
  if (postsToBarePeople && !KNOWN_PEOPLE_POST.has(rel)) {
    fails.push(
      `${rel}: POSTs to the bare FUB /people endpoint to create a lead. Inbound leads MUST go through POST /v1/events (use sendEvent from '@/lib/followupboss') so dedup + action plans + the speed-to-lead auto-text fire. /people creates the person but runs NO automations.`,
    )
  }
  // ── 2. textMessages is log-only (tripwire) ──
  // The bare `/textMessages` endpoint POST. Query reads use `/textMessages?...`.
  const postsTextMessages = src.includes('/textMessages' + BT) && /method:\s*['"]POST['"]/.test(src)
  if (postsTextMessages) {
    fails.push(
      `${rel}: POSTs to FUB /v1/textMessages. That endpoint only LOGS a message, it never sends. If you are logging an already-sent message this is fine — confirm it, then allowlist it here. If you intended to SEND an SMS, that is wrong (FUB cannot send for integrations; route real sends through the approved sender + consent gate).`,
    )
  }
}

// ── 3. source required on every event ──────────────────────────────────────────
const fub = existsSync(join(ROOT, 'lib/followupboss.ts'))
  ? readFileSync(join(ROOT, 'lib/followupboss.ts'), 'utf8')
  : ''
if (!fub) {
  fails.push('lib/followupboss.ts missing — the FUB lead path is the CRM spine.')
} else if (!/\bsource:\s*string\b/.test(fub)) {
  fails.push(
    "lib/followupboss.ts: SendEventParams must keep `source: string` (required, not optional) so every lead event carries marketing attribution.",
  )
}

if (fails.length) {
  console.error(`\n✗ crm-lead-integrity: ${fails.length} issue(s):\n`)
  for (const f of fails) console.error('  • ' + f + '\n')
  console.error('  See docs/CRM_INTEGRATION.md for the rationale + FUB API citations.')
  process.exit(1)
}
const tracked = KNOWN_PEOPLE_POST.size
console.log(
  `✓ crm-lead-integrity: leads use POST /v1/events (not /people), textMessages is log-only, source is required.` +
    (tracked ? ` ${tracked} file keeps a documented /people fallback (events-first path is primary; CRM_INTEGRATION #1).` : ''),
)

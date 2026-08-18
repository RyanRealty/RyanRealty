/**
 * G49 — CRM lead-integrity gate.
 *
 * Locks lead-ingestion invariants for the in-house CRM:
 *
 *   - inbound leads go through sendEvent → ensureNativeLead (crm_people), never
 *     a third-party people POST
 *   - SMS must go through the approved sender + consent gate, not a log-only
 *     third-party textMessages POST
 *   - source is required on every event so marketing attribution survives
 *   - lead-type events tag audience:buyer or audience:seller
 *
 * Usage: node scripts/check-crm-lead-integrity.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const BT = String.fromCharCode(96)

const KNOWN_PEOPLE_POST = new Set([
  'app/api/meta/lead-webhook/route.ts',
])

const AUDIENCE_TAG_ALLOW = new Set([
  'app/actions/home.ts', // subscribeNewsletter — audience unknown at signup
])

const SCAN = ['lib', 'app']
function walk(dir, out = []) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return out
  for (const name of readdirSync(abs)) {
    if (name === 'node_modules' || name === '.next') continue
    const rel = `${dir}/${name}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name)) out.push(rel)
  }
  return out
}

const files = SCAN.flatMap((d) => walk(d))
const fails = []

for (const rel of files) {
  const src = readFileSync(join(ROOT, rel), 'utf8')
  const postsToBarePeople = src.includes('/people' + BT) && /method:\s*['"]POST['"]/.test(src)
  if (postsToBarePeople && !KNOWN_PEOPLE_POST.has(rel)) {
    fails.push(
      `${rel}: POSTs to a bare /people endpoint to create a lead. Inbound leads MUST go through sendEvent from '@/lib/crm/send-event' so dedup and enrollment run.`,
    )
  }
  const postsTextMessages = src.includes('/textMessages' + BT) && /method:\s*['"]POST['"]/.test(src)
  if (postsTextMessages) {
    fails.push(
      `${rel}: POSTs to /textMessages. That is a log-only third-party path, not a send. Route real SMS through the approved sender + consent gate.`,
    )
  }

  const isClientDef = rel === 'lib/crm/send-event.ts'
  const createsLead = /\bsendEvent\s*\(/.test(src)
  const firesLeadEvent = /['"](Registration|Seller Inquiry|Buyer Inquiry|Open House RSVP)['"]/.test(src)
  const tagsAudience = /canonicallyTagLead|['"]audience:/.test(src)
  if (createsLead && firesLeadEvent && !isClientDef && !tagsAudience && !AUDIENCE_TAG_ALLOW.has(rel)) {
    fails.push(
      `${rel}: creates a lead (sendEvent with a lead-type event) but never tags the audience. Route the person through canonicallyTagLead from '@/lib/canonical-lead-tagger', or apply an audience:* tag. Allowlist in AUDIENCE_TAG_ALLOW only if it is genuinely a non-lead activity event.`,
    )
  }
}

const sendEventSrc = existsSync(join(ROOT, 'lib/crm/send-event.ts'))
  ? readFileSync(join(ROOT, 'lib/crm/send-event.ts'), 'utf8')
  : ''
if (!sendEventSrc) {
  fails.push('lib/crm/send-event.ts missing — native lead capture is the CRM spine.')
} else if (!/\bsource:\s*string\b/.test(sendEventSrc)) {
  fails.push(
    'lib/crm/send-event.ts: SendEventParams must keep `source: string` (required, not optional) so every lead event carries marketing attribution.',
  )
}

if (fails.length) {
  console.error(`\n✗ crm-lead-integrity: ${fails.length} issue(s):\n`)
  for (const f of fails) console.error('  • ' + f + '\n')
  process.exit(1)
}
const tracked = KNOWN_PEOPLE_POST.size
console.log(
  `✓ crm-lead-integrity: leads use sendEvent → crm_people, source is required, every lead-creation path tags an audience.` +
    (tracked ? ` ${tracked} file keeps a documented /people fallback.` : ''),
)

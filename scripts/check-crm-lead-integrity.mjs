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
 *   - the site's doors write the DOOR label as source, never the host, and the
 *     reuse path keeps source first-touch (FUNNEL-4, 2026-09-23)
 *   - the public intake screen (quality:suspect) is wired from the contact-form
 *     honeypot through sendEvent/ensureNativeLead to every machine that acts on
 *     a new lead: enroll, broker alerts, tasks, response clock, hot-lead
 *     escalation (FUNNEL-1, 2026-09-23)
 *
 * Usage: node scripts/check-crm-lead-integrity.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.cwd()
const BT = String.fromCharCode(96)

const KNOWN_PEOPLE_POST = new Set([
  'app/api/meta/lead-webhook/route.ts',
])

const AUDIENCE_TAG_ALLOW = new Set([
  'app/actions/home.ts', // subscribeNewsletter — audience unknown at signup
])

/** Balanced-paren argument text of every `sendEvent(` call in a file. */
export function sendEventCalls(src) {
  const calls = []
  let from = 0
  for (;;) {
    const at = src.indexOf('sendEvent(', from)
    if (at === -1) break
    let depth = 0
    let end = at + 'sendEvent'.length
    for (; end < src.length; end++) {
      const ch = src[end]
      if (ch === '(' || ch === '{' || ch === '[') depth++
      else if (ch === ')' || ch === '}' || ch === ']') {
        depth--
        if (depth === 0) break
      }
    }
    calls.push(src.slice(at + 'sendEvent('.length, end))
    from = end
  }
  return calls
}

/** The value expression of the object literal's own (depth-1) `source:` key. */
export function topLevelSource(arg) {
  let depth = 0
  for (let i = 0; i < arg.length; i++) {
    const ch = arg[i]
    if (ch === '(' || ch === '{' || ch === '[') depth++
    else if (ch === ')' || ch === '}' || ch === ']') depth--
    else if (depth === 1 && arg.startsWith('source:', i) && !/[\w$]/.test(arg[i - 1] ?? '')) {
      let j = i + 'source:'.length
      let d = 0
      let expr = ''
      for (; j < arg.length; j++) {
        const c = arg[j]
        if (c === '(' || c === '{' || c === '[') d++
        else if (c === ')' || c === '}' || c === ']') {
          if (d === 0) break
          d--
        } else if (c === ',' && d === 0) break
        expr += c
      }
      return expr.trim()
    }
  }
  return null
}

/** A sendEvent `source:` expression that derives the site host instead of naming the door. */
export function isHostDerivedSource(expr) {
  return /replace\(|NEXT_PUBLIC_SITE_URL|siteUrl|\bbase\b|'ryan-realty\.com'/.test(expr) || expr.trim() === 'source'
}

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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
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

  // ── FUNNEL-4 (visibility audit 2026-09-22): source is the DOOR, and it is first-touch ──
  // Every site door stamped crm_people.source with the site host ('ryan-realty.com',
  // 76 of 88 site leads in 30 days), so no report could tell a contact-form note from
  // an alerts signup, and the reuse path overwrote the column with the latest door.

  const DOOR_FILES = [
    'app/contact/actions.ts',
    'app/actions/search-alert-capture.ts',
    'app/lp/seller-home-value/actions.ts',
    'app/communities/[slug]/_v3/place-value-actions.ts',
  ]
  for (const rel of DOOR_FILES) {
    if (!existsSync(join(ROOT, rel))) {
      fails.push(`${rel}: door file missing — update DOOR_FILES in scripts/check-crm-lead-integrity.mjs.`)
      continue
    }
    const src = readFileSync(join(ROOT, rel), 'utf8')
    for (const call of sendEventCalls(src)) {
      const expr = topLevelSource(call)
      if (expr === null) continue
      if (isHostDerivedSource(expr)) {
        fails.push(
          `${rel}: sendEvent source is \`${expr}\`, the site host. Write the door label ('contact-form', 'join', 'idx-registration', 'seller-lp', 'place-page') so crm_people.source says which form it was (FUNNEL-4).`,
        )
      }
    }
  }

  const ensureSrc = existsSync(join(ROOT, 'lib/data/crm/ensureNativeLead.ts'))
    ? readFileSync(join(ROOT, 'lib/data/crm/ensureNativeLead.ts'), 'utf8')
    : ''
  if (/update\.source\s*=\s*input\.source/.test(ensureSrc) || !/reuseSourcePatch\(/.test(ensureSrc)) {
    fails.push(
      'lib/data/crm/ensureNativeLead.ts: the REUSE path must keep crm_people.source first-touch through reuseSourcePatch (a later door lands as a source:<door> tag), never overwrite it with the latest door (FUNNEL-4).',
    )
  }

  // ── FUNNEL-1 (visibility audit 2026-09-22): the intake screen is wired end to end ──
  // 44 of 47 contact-form arrivals in 30 days were scripted; each got a workflow,
  // three broker texts and a task. The screen tags quality:suspect at the chokepoint;
  // every machine that acts on a new lead must read the tag.
  const SCREEN_WIRING = [
    ['lib/crm/send-event.ts', /ensureNativeLead\(\{[^}]*\bscreen\b/, 'forwards the intake `screen` to ensureNativeLead'],
    ['lib/data/crm/ensureNativeLead.ts', /classifyLeadQuality\(/, 'runs classifyLeadQuality on a screened submit'],
    ['lib/data/crm/ensureNativeLead.ts', /hasSuspectTag\(person\?\.tags\)/, 'createNativeTask skips a quality:suspect person'],
    ['app/contact/actions.ts', /formData\.get\(CONTACT_TRAP\.name\)/, 'reads the contact-form honeypot'],
    ['app/contact/actions.ts', /screen:\s*\{\s*honeypot/, 'passes the honeypot to the intake screen'],
    ['app/contact/_v3/ContactAsk.client.tsx', /name=\{CONTACT_TRAP\.name\}/, 'renders the honeypot inside the form'],
    ['app/contact/_v3/ContactAsk.client.tsx', /formData\.set\(CONTACT_TRAP\.name/, 'forwards the honeypot value verbatim'],
    ['lib/crm/enroll.ts', /hasSuspectTag\(tags\)/, 'autoEnrollPerson refuses a quality:suspect person'],
    ['lib/crm/broker-alerts.ts', /isSuspectSilencedAlertKind\(params\.kind\)/, 'queueBrokerAlert silences lead pings for a quality:suspect person'],
    ['lib/crm/response-clock-run.ts', /hasSuspectTag\(tags\)/, 'the response clock leaves a quality:suspect person off the clock'],
    ['app/api/cron/visitor-hot-lead-escalation/route.ts', /person\?\.suspect/, 'hot-lead escalation skips a quality:suspect person'],
  ]
  for (const [rel, re, what] of SCREEN_WIRING) {
    const src = existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : ''
    if (!re.test(src)) {
      fails.push(`${rel}: no longer ${what} (FUNNEL-1 intake screen, lib/crm/lead-quality.ts).`)
    }
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
}

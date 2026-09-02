#!/usr/bin/env node
/**
 * check-email-link-tracking.mjs — ci:email-link-tracking
 *
 * Anytime a lead-facing email goes out, its links must be click-tracked
 * (attributeOutbound / instrumentEmailHtml) or the send must go through
 * sendGovernedEmail, which instruments internally. Brokers never opt in.
 *
 * Same doctrine as ci:sms-link-tracking: a file that calls a raw email
 * provider send must also instrument, unless it is a documented internal
 * (broker-only) exemption. Comment/string stripped so a TODO cannot pass.
 *
 * Usage: node scripts/check-email-link-tracking.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SEND_CALL = /\b(?:sendEmail|sendCrmEmail|sendGmailMessage|sendBatchEmails)\s*\(/
const INSTRUMENTS = /\b(?:attributeOutbound|instrumentEmailHtml|sendGovernedEmail)\s*\(/
// Chokepoints auto-wrap when the caller passes track= (sendCrmEmail) or
// personId= (sendEmail / sendGmailMessage). That IS instrumentation.
const AUTO_WRAP = /\b(?:track|personId)\s*:/

const EXEMPT = new Map([
  ['lib/resend.ts', 'the Resend primitive — optional personId auto-instruments inside sendEmail'],
  ['lib/crm/gmail.ts', 'the Gmail primitive — track= auto-runs attributeOutbound inside sendCrmEmail'],
  ['lib/gmail-draft.ts', 'Gmail draft/send primitive — sendGmailMessage auto-wraps when personId is set'],
  ['lib/comms/sendGovernedEmail.ts', 'the governed chokepoint — always instruments before sendCrmEmail/sendEmail'],
  ['lib/deploy-health-alert.ts', 'internal ops alert to a broker mailbox, no lead recipient'],
  ['lib/market-stat-alert.ts', 'internal ops alert to a broker mailbox, no lead recipient'],
  ['lib/fsbo-alert.ts', 'internal broker alert, no lead recipient'],
  ['app/api/cron/loop-health-check/route.ts', 'internal heartbeat to a broker mailbox'],
  ['app/api/cron/daily-broker-digest/route.ts', 'broker digest, recipient is the broker'],
  ['app/api/cron/newsletter-monthly-draft/route.ts', 'internal draft ping to a broker mailbox'],
  ['app/api/twilio/inbound-sms/route.ts', 'forwards inbound lead SMS to the broker cell/mailbox'],
  ['app/api/twilio/conversations-events/route.ts', 'broker notification of a conversation event'],
  ['app/api/twilio/recording/route.ts', 'broker notification that a recording is ready'],
  ['lib/digest-email-templates.tsx', 'react-email templates consumed by the broker digest, not a send site'],
  ['app/actions/crm-template-test.ts', "broker self-test template preview to the calling broker's own mailbox — not a lead-facing send (same reason as the SMS self-test EXEMPT)"],
  ['app/actions/newsletter.ts', 'only adminTestSendNewsletterAction remains after the 2026-09-01 export trim — a [TEST] copy to the calling admin\'s own inbox (gate.email); the real subscriber send rides the instrumented newsletter queue'],
  ['app/api/cma/[slug]/gmail-draft/route.ts', 'Resend fallback emails the PDF to the BROKER when Gmail draft creation fails — never auto-sends to the lead'],
  ['app/api/cron/broker-agent-digest/route.ts', 'internal digest to the broker mailbox, no lead recipient'],
  ['app/api/cron/weekly-pipeline-digest/route.ts', 'internal pipeline digest to the broker mailbox, no lead recipient'],
  ['lib/cma-delivery.ts', 'broker-review notify only — the lead CMA send lives in lib/cma-deliver.ts and is already instrumented'],
])

function stripNonCode(src) {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    const c2 = src[i + 1]
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && c2 === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      out += ' '
      i++
      while (i < n) {
        if (src[i] === '\\') {
          i += 2
          continue
        }
        if (src[i] === quote) {
          i++
          break
        }
        out += src[i] === '\n' ? '\n' : ' '
        i++
      }
      continue
    }
    out += c
    i++
  }
  return out
}

function walk(dir, out) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(e.name) && !/\.test\.|\.spec\./.test(e.name)) out.push(full)
  }
}

const files = []
for (const root of ['app', 'lib']) walk(root, files)

const problems = []
for (const f of files) {
  const code = stripNonCode(readFileSync(f, 'utf8'))
  if (!SEND_CALL.test(code)) continue
  const rel = f.replace(/\\/g, '/')
  if (EXEMPT.has(rel)) continue
  if (!INSTRUMENTS.test(code) && !AUTO_WRAP.test(code)) {
    problems.push(
      `${rel}: calls a raw email send (sendEmail/sendCrmEmail/sendGmailMessage) but never instruments links (attributeOutbound / instrumentEmailHtml / sendGovernedEmail). Lead-facing mail with a raw URL loses click + site stitch — wrap via attributeOutbound, pass personId into the chokepoint, or add a documented EXEMPT entry if it is genuinely not lead-facing.`,
    )
  }
}

console.log('Email link-tracking gate (ci:email-link-tracking)')
console.log('================================================')
console.log(`raw-send files scanned · exemptions: ${EXEMPT.size}`)
if (problems.length) {
  console.error(`\n\x1b[31m✗ ci:email-link-tracking: ${problems.length} un-instrumented email sender(s)\x1b[0m`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log('✓ Every lead-facing email sender instruments its links (or is a documented exemption).')
process.exit(0)

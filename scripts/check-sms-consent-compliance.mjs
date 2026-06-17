#!/usr/bin/env node
/**
 * check-sms-consent-compliance.mjs — locks the A2P 10DLC / TCPA consent surface.
 *
 * Ryan Realty's Twilio A2P campaign (messaging service MG592bf50afb3f10e6f1078995dae496e4)
 * is vetted against the LIVE website. Carriers re-crawl the lead forms and the
 * privacy policy and will reject / suspend the campaign if the required consent
 * language or links disappear. This gate fails the build if any of the
 * carrier-verified elements are removed, so a routine refactor can never
 * silently break SMS sending (history: campaign CMb1d8153... was rejected
 * 2026-06-16 for errors 30882 + 30917; see docs/HANDOFF-a2p-sms-consent.md).
 *
 * Required, immutable without re-submitting the A2P campaign:
 *  1. The consent disclosure component carries the EXACT carrier-verified
 *     sentence and links BOTH the privacy policy and the terms of service.
 *  2. The privacy policy keeps its SMS section, the message-frequency +
 *     msg&data-rates + STOP language, and the carrier-mandatory clause that no
 *     mobile information is shared with third parties or affiliates.
 *
 * Usage: node scripts/check-sms-consent-compliance.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const CONSENT = 'components/site/SmsConsentDisclosure.tsx'
const PRIVACY = 'app/privacy/page.tsx'
const ROOT = process.cwd()

const fails = []
const read = (p) => {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    fails.push(`Cannot read ${p} — this file is part of the A2P consent surface and must exist.`)
    return ''
  }
}

// ── 1. consent disclosure component ─────────────────────────────────────────
const consent = read(CONSENT)
// The exact sentence carriers verify word-for-word on every lead form.
const EXACT =
  'By submitting, you agree to receive calls and texts from Ryan Realty about your request. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.'
if (consent && !consent.includes(EXACT)) {
  fails.push(
    `${CONSENT}: the carrier-verified consent sentence was changed. It must read EXACTLY:\n      "${EXACT}"`,
  )
}
if (consent && !/href="\/privacy"/.test(consent)) {
  fails.push(`${CONSENT}: missing the /privacy link (A2P 30917 requires a privacy policy link in the disclosure).`)
}
if (consent && !/href="\/terms"/.test(consent)) {
  fails.push(`${CONSENT}: missing the /terms link (A2P 30917 requires a terms of service link in the disclosure).`)
}

// ── 2. privacy policy SMS section ───────────────────────────────────────────
const privacy = read(PRIVACY)
const required = [
  { label: 'SMS section heading', re: /SMS and text messaging/i },
  {
    label: 'no-sharing clause (carrier-mandatory)',
    re: /No mobile information will be shared with third parties or affiliates/i,
  },
  { label: 'message frequency language', re: /message frequency/i },
  { label: 'STOP opt-out language', re: /reply STOP|text STOP|STOP to/i },
]
for (const r of required) {
  if (privacy && !r.re.test(privacy)) {
    fails.push(`${PRIVACY}: missing the ${r.label}. The privacy policy must keep the full SMS consent terms.`)
  }
}

// ── 3. coverage — every PUBLIC phone-collecting form must render the disclosure ──
// The checks above lock the shared component + privacy policy. This locks that
// every public form which COLLECTS a phone number actually renders
// <SmsConsentDisclosure>, so a new lead form cannot silently collect phones
// without TCPA/A2P consent. Admin, logged-in-account, and broker-self-service
// surfaces are exempt — the person entering the phone there is not a public lead
// opting in to be contacted.
const SCAN_DIRS = ['app', 'components']
const PHONE_INPUT = /type=["']tel["']|autoComplete=["']tel["']|name=["']phone["']/
const EXEMPT_PREFIXES = [
  'app/admin/',
  'app/components/admin/',
  'components/admin/',
  'app/account/',
  'app/dashboard/',
  'components/dashboard/',
]
const EXEMPT_FILES = new Set([
  'app/team/[slug]/edit/page.tsx', // broker self-service profile edit (auth-gated)
  'components/site/SmsConsentDisclosure.tsx', // the disclosure component itself
])
function walkTsx(dir, out = []) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return out
  for (const name of readdirSync(abs)) {
    if (name === 'node_modules' || name === '.next') continue
    const rel = `${dir}/${name}`
    if (statSync(join(ROOT, rel)).isDirectory()) walkTsx(rel, out)
    else if (name.endsWith('.tsx')) out.push(rel)
  }
  return out
}
for (const rel of SCAN_DIRS.flatMap((d) => walkTsx(d))) {
  if (EXEMPT_FILES.has(rel)) continue
  if (EXEMPT_PREFIXES.some((p) => rel.startsWith(p))) continue
  const src = readFileSync(join(ROOT, rel), 'utf8')
  if (!PHONE_INPUT.test(src)) continue // not a phone-collecting form
  if (/SmsConsentDisclosure/.test(src)) continue // already renders the disclosure
  fails.push(
    `${rel}: collects a phone number but does not render <SmsConsentDisclosure />. Every public lead form that collects a phone must show the TCPA/A2P consent disclosure. Add it (import from '@/components/site/SmsConsentDisclosure'), or if this is an admin/account/self-service surface, add it to EXEMPT in this gate.`,
  )
}

if (fails.length) {
  console.error('✗ sms-consent-compliance FAILED — this breaks the Twilio A2P campaign:\n')
  for (const f of fails) console.error('  • ' + f + '\n')
  console.error('  See docs/HANDOFF-a2p-sms-consent.md before changing the consent surface.')
  process.exit(1)
}
console.log('✓ sms-consent-compliance: consent sentence intact; privacy + terms linked; privacy SMS terms + no-sharing clause present; every public phone-collecting form renders the disclosure.')

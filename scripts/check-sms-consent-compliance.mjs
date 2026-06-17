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
import { readFileSync } from 'node:fs'

const CONSENT = 'components/site/SmsConsentDisclosure.tsx'
const PRIVACY = 'app/privacy/page.tsx'

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

if (fails.length) {
  console.error('✗ sms-consent-compliance FAILED — this breaks the Twilio A2P campaign:\n')
  for (const f of fails) console.error('  • ' + f + '\n')
  console.error('  See docs/HANDOFF-a2p-sms-consent.md before changing the consent surface.')
  process.exit(1)
}
console.log('✓ sms-consent-compliance: consent sentence intact; privacy + terms linked; privacy SMS terms + no-sharing clause present.')

#!/usr/bin/env node
/**
 * Email Bend Policy Pulse Instagram captions (parts 1–3) for manual posting.
 *
 *   node --env-file=.env.local scripts/email-bend-pulse-instagram-captions.mjs
 *
 * Recipient: RESEND_ADMIN_EMAIL, ADMIN_EMAIL, or matt@ryan-realty.com
 */
import fs from 'node:fs'

try {
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z_0-9]+)=(.*)$/)
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch {
  /* optional */
}

const RESEND_API_KEY = process.env.RESEND_API_KEY
const to =
  process.env.EMAIL_TO?.trim() ||
  process.env.RESEND_ADMIN_EMAIL?.trim() ||
  process.env.ADMIN_EMAIL?.trim() ||
  'matt@ryan-realty.com'

const HASHTAGS =
  '#RyanRealtyBend #BendOregon #CityCouncil #CentralOregon #LocalNews #Housing #Electrification #ClimatePolicy #Bend'

const PARTS = [
  {
    n: 1,
    body: `Bend Policy Pulse — Part 1 of 3

What Bend is proposing on the new home climate pollution fee. Council workshop clips from the public record, with narration.

Watch part 2 for the back and forth. Part 3 for dates and how to weigh in.

Clips are from the public meeting record.`,
  },
  {
    n: 2,
    body: `Bend Policy Pulse — Part 2 of 3

What people are arguing as Bend tightens the math on new home electrification and the climate pollution fee. Workshop and council context from public video.

Start with part 1 if you need the proposal basics. Part 3 is the calendar.`,
  },
  {
    n: 3,
    body: `Bend Policy Pulse — Part 3 of 3

Hearings, readings, and effective dates. The “what happens next” episode.

Parts 1–2 cover the proposal and the debate.

Confirm dates on the official City of Bend agenda when you calendar it.`,
  },
]

if (!RESEND_API_KEY?.trim()) {
  console.error('RESEND_API_KEY not set in environment')
  process.exit(1)
}

const textFull = PARTS.map(
  (p) =>
    `========== PART ${p.n} OF 3 (Instagram caption + hashtags) ==========\n\n${p.body}\n\n${HASHTAGS}\n`
).join('\n')

const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;max-width:640px;">
<p>Bend Policy Pulse — Instagram caption text for all three Reels (matches <code>scripts/publish-bend-policy-pulse.mjs</code>).</p>
${PARTS.map(
  (p) => `<h2 style="margin-top:2rem;">Part ${p.n} of 3</h2>
<pre style="white-space:pre-wrap;background:#f4f4f5;padding:1rem;border-radius:8px;">${escapeHtml(`${p.body}\n\n${HASHTAGS}`)}</pre>`
).join('')}
<p style="margin-top:2rem;color:#666;font-size:14px;">Add your blog permalink above the hashtags if you want link-in-bio traffic.</p>
</body></html>`

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const fromPrimary = 'Ryan Realty <matt@ryan-realty.com>'
const fromFallback = 'Ryan Realty <onboarding@resend.dev>'

const res = await trySend(fromPrimary)
if (!res.ok) {
  console.warn(`Primary From rejected (${res.status}): ${res.body.slice(0, 180)}`)
  console.warn('Retrying with onboarding@resend.dev …')
  const r2 = await trySend(fromFallback)
  if (!r2.ok) {
    console.error('Resend error:', r2.status, r2.body)
    process.exit(1)
  }
  console.log('Sent to', to, '(from', fromFallback + ')')
  process.exit(0)
}
console.log('Sent to', to, '(from', fromPrimary + ')')

async function trySend(from) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Bend Policy Pulse — Instagram captions (parts 1–3)',
      text: textFull,
      html,
    }),
  })
  const body = await r.text()
  return { ok: r.ok, status: r.status, body }
}

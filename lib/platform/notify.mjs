/**
 * Cross-platform internal notification. Replaces the `osascript` → Messages.app
 * calls that only ever worked on the Mac mini.
 *
 * Channel order: Twilio SMS → email (Resend) → stdout. Every channel is
 * best-effort; a notification failure NEVER blocks the caller. That matches
 * how the osascript path already behaved in render-worker.mjs.
 *
 * Scope: INTERNAL broker alerts only. Never route a lead or homeowner message
 * through here — `scripts/check-crm-sms-channel-safety.mjs` (G-gate) fails the
 * build if the CRM sequence engine reaches for a personal channel.
 *
 *   import { notify } from '../lib/platform/notify.mjs'
 *   await notify({ to: '+15412136706', body: 'render finished' })
 */
import { loadEnv, env } from './env.mjs'

/**
 * @param {{to?: string, body: string, subject?: string}} opts
 * @returns {Promise<{channel: 'twilio'|'email'|'stdout', ok: boolean, error?: string}>}
 */
export async function notify({ to, body, subject }) {
  await loadEnv()

  const sid = env('TWILIO_ACCOUNT_SID')
  const token = env('TWILIO_AUTH_TOKEN')
  const svc = env('TWILIO_MESSAGING_SERVICE_SID')
  const dest = to ?? env('BROKER_ALERT_PHONE')

  if (sid && token && svc && dest) {
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: dest, MessagingServiceSid: svc, Body: body }),
      })
      if (res.ok) return { channel: 'twilio', ok: true }
      const detail = (await res.text()).slice(0, 140)
      console.warn(`notify: twilio ${res.status} — ${detail}`)
    } catch (e) {
      console.warn(`notify: twilio threw — ${e.message.slice(0, 140)}`)
    }
  }

  const resendKey = env('RESEND_API_KEY')
  const alertEmail = env('BROKER_ALERT_EMAIL') ?? env('MATT_EMAIL')
  if (resendKey && alertEmail) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env('RESEND_FROM') ?? 'alerts@mail.ryan-realty.com',
          to: alertEmail,
          subject: subject ?? 'Ryan Realty alert',
          text: body,
        }),
      })
      if (res.ok) return { channel: 'email', ok: true }
      console.warn(`notify: resend ${res.status}`)
    } catch (e) {
      console.warn(`notify: resend threw — ${e.message.slice(0, 140)}`)
    }
  }

  console.log(`[notify] ${subject ? subject + ': ' : ''}${body}`)
  return { channel: 'stdout', ok: true }
}

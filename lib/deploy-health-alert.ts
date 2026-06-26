/**
 * Deploy-health alert — emails Matt when production has fallen behind `main`,
 * i.e. the latest commit has NOT reached the live deployment within a grace
 * window. The classic failure mode this catches: a build break that Vercel
 * deploys as `state: ERROR`, so the last good deployment keeps serving and new
 * code silently never goes live (the entire CRM Wave 3->9 series shipped this
 * way — green gates, dead deploys, unnoticed for days).
 *
 * Internal ops alert to matt@ryan-realty.com only — there is no lead recipient,
 * so this sendEmail is allowlisted in scripts/email-send-gated-baseline.json
 * (same class as lib/expired-alert.ts / lib/seller-lead-alert.ts).
 */

import { sendEmail } from '@/lib/resend'
import { EMAIL_FONT_STACK } from '@/lib/email/brand'

const ALERT_TO = process.env.MATT_ALERT_EMAIL ?? 'matt@ryan-realty.com'
const ALERT_FROM = process.env.RESEND_FROM ?? 'alerts@mail.ryan-realty.com'

export type DeployHealthAlertParams = {
  /** The commit SHA the live production deployment was built from. */
  deployedSha: string
  /** The current HEAD of origin/main on GitHub. */
  latestSha: string
  /** First line of the latest commit message. */
  latestCommitSubject: string
  /** How long the latest commit has been undeployed (minutes). */
  behindMinutes: number
}

const short = (sha: string) => sha.slice(0, 8)

export async function sendDeployHealthAlertEmail(
  p: DeployHealthAlertParams,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const html = `<!doctype html>
<html><body style="font-family:${EMAIL_FONT_STACK};color:#1a1a1a;font-size:14px;line-height:1.55;max-width:640px;margin:0 auto;padding:24px;">
<h2 style="margin:0 0 8px 0;color:#102742;">Production is behind main — a deploy may have failed</h2>
<p style="margin:0 0 16px 0;color:#666;">The latest commit has not reached the live site in ${p.behindMinutes} minutes. The last good deployment is still serving, so new code is NOT live.</p>
<ul style="margin:0 0 16px 0;padding-left:20px;">
  <li><strong>Live deployment built from:</strong> ${short(p.deployedSha)}</li>
  <li><strong>main HEAD (not deployed):</strong> ${short(p.latestSha)} — ${p.latestCommitSubject}</li>
  <li><strong>Behind by:</strong> ${p.behindMinutes} min</li>
</ul>
<h3 style="margin:24px 0 8px 0;color:#102742;">Check</h3>
<p style="margin:0 0 8px 0;">Vercel deployments: <a href="https://vercel.com/ryanrealtys-projects/ryanrealty/deployments">vercel.com/ryanrealtys-projects/ryanrealty/deployments</a></p>
<p style="margin:0;">If the latest deployment is <strong>ERROR</strong>, read its build log — most likely a Turbopack build break (use-server / RSC) that tsc + ci:gates do not catch. The pre-push build gate (G47) should now stop these locally; this alert is the backstop.</p>
</body></html>`

  const subject = `[Deploy] Production behind main by ${p.behindMinutes}m (${short(p.latestSha)} not live)`

  try {
    const r = await sendEmail({ to: ALERT_TO, from: `Ryan Realty Ops <${ALERT_FROM}>`, subject, html })
    if (r.error) return { ok: false, error: r.error }
    return { ok: true, id: r.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

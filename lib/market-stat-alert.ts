/**
 * Market-stat consistency alert — emails Matt when the one-number-per-metric
 * contract breaks (design-audit P0: the same "Bend: N active" ledger rendered
 * 788 on one page and 500 on the next from two different sources).
 *
 * Fired by /api/cron/market-stat-consistency when:
 *   - a city snapshot returned by the DAL disagrees with its market_pulse_live
 *     row (the canonical override in lib/data/geo/getGeoSnapshot.ts broke), or
 *   - the pulse is stale (refresh_market_pulse not running), or
 *   - the geo_snapshot_mv SFR-median sentinel regressed (land contamination).
 *
 * Internal ops alert to matt@ryan-realty.com only — no lead recipient, so this
 * sendEmail is allowlisted in scripts/email-send-gated-baseline.json (same
 * class as lib/deploy-health-alert.ts).
 */

import { sendEmail } from '@/lib/resend'
import { EMAIL_FONT_STACK } from '@/lib/email/brand'

const ALERT_TO = process.env.MATT_ALERT_EMAIL ?? 'matt@ryan-realty.com'
const ALERT_FROM = process.env.RESEND_FROM ?? 'alerts@mail.ryan-realty.com'

export type MarketStatAlertParams = {
  failures: string[]
}

export async function sendMarketStatAlertEmail(
  p: MarketStatAlertParams,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const items = p.failures.map((f) => `<li>${f}</li>`).join('')
  const html = `<!doctype html>
<html><body style="font-family:${EMAIL_FONT_STACK};color:#1a1a1a;font-size:14px;line-height:1.55;max-width:640px;margin:0 auto;padding:24px;">
<h2 style="margin:0 0 8px 0;color:#102742;">Market stats are contradicting themselves</h2>
<p style="margin:0 0 16px 0;color:#666;">The nightly consistency check found the site could be showing two different numbers for the same stat. This is the exact failure class the 2026-07-07 design audit flagged (Bend 788 vs 500).</p>
<ul style="margin:0 0 16px 0;padding-left:20px;">${items}</ul>
<p style="margin:0;">Sources: market_pulse_live (canonical, city/region) and geo_snapshot_mv (community/neighborhood + fallback). The DAL contract lives in lib/data/geo/getGeoSnapshot.ts.</p>
</body></html>`

  const subject = `[Data] Market-stat consistency check failed (${p.failures.length} issue${p.failures.length === 1 ? '' : 's'})`

  try {
    const r = await sendEmail({ to: ALERT_TO, from: `Ryan Realty Ops <${ALERT_FROM}>`, subject, html })
    if (r.error) return { ok: false, error: r.error }
    return { ok: true, id: r.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * westside-digest-email — pure renderer for the weekly West Side cohort digest.
 *
 * Turns the getWestsideCohortActivity DAL result into a compact internal ops
 * email for the broker (matt@ryan-realty.com): rollup KPI row + the ranked
 * active people with deep links into /admin/people/<id>. This is an INTERNAL
 * broker alert (analytics-daily-digest pattern), never a lead send — the cron
 * route owns the recipient and the Resend call; this module is render-only and
 * has no I/O, so the subject/HTML shaping is unit-testable.
 */
import type { WestsideCohortActivity } from '@/lib/data/crm/getWestsideCohortActivity'
import { formatDate } from '@/lib/format/date'

const SITE = 'https://ryan-realty.com'

/** How many ranked people the email lists (the admin page shows the full set). */
export const DIGEST_MAX_PEOPLE = 15

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function fmtDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return formatDate(d, { year: undefined })
}

function plural(n: number, noun: string): string {
  return `${fmtInt(n)} ${noun}${n === 1 ? '' : 's'}`
}

/**
 * Subject line. No em-dashes (brand punctuation floor applies to anything a
 * human reads), tabular facts up front so the inbox row carries the number.
 */
export function buildWestsideDigestSubject(d: WestsideCohortActivity): string {
  const r = d.rollup
  if (r.activePeople === 0) {
    return `West Side cohort, last ${d.sinceDays} days: quiet week, ${fmtInt(r.identifiedPeople)} identified owners`
  }
  return `West Side cohort, last ${d.sinceDays} days: ${fmtInt(r.activePeople)} active, ${plural(r.siteVisits, 'visit')}, ${plural(r.opens, 'open')}, ${plural(r.clicks, 'click')}`
}

function kpiCell(label: string, value: number): string {
  return `<td style="padding:12px;background:#faf8f4;border-radius:8px;">
  <div style="font-size:11px;color:#52606D;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(label)}</div>
  <div style="font-size:22px;font-weight:600;margin-top:4px;font-variant-numeric:tabular-nums;">${fmtInt(value)}</div>
</td>`
}

/** Full HTML body. Table-based layout for email-client compatibility. */
export function renderWestsideDigestHtml(d: WestsideCohortActivity): string {
  const r = d.rollup
  const top = d.people.slice(0, DIGEST_MAX_PEOPLE)

  const peopleRows = top
    .map((p) => {
      const name = p.name ?? `Person #${p.personId}`
      const firstParcel = p.parcels[0]
      const address = firstParcel?.siteStreet ?? firstParcel?.apn ?? ''
      const more = p.parcels.length > 1 ? ` +${p.parcels.length - 1}` : ''
      const signals: string[] = []
      if (p.visits > 0) signals.push(`${fmtInt(p.visits)} visit${p.visits === 1 ? '' : 's'}`)
      if (p.opens > 0) signals.push(`${fmtInt(p.opens)} open${p.opens === 1 ? '' : 's'}`)
      if (p.clicks > 0) signals.push(`${fmtInt(p.clicks)} click${p.clicks === 1 ? '' : 's'}`)
      if (p.inbound > 0) signals.push(`${fmtInt(p.inbound)} inbound`)
      return `<tr>
<td style="padding:6px 10px;"><a href="${SITE}/admin/people/${p.personId}" style="color:#102742;font-weight:600;">${escapeHtml(name)}</a></td>
<td style="padding:6px 10px;color:#52606D;">${escapeHtml(address)}${escapeHtml(more)}</td>
<td style="padding:6px 10px;color:#52606D;">${escapeHtml(signals.join(', ') || '—')}</td>
<td style="padding:6px 10px;text-align:right;font-variant-numeric:tabular-nums;">${fmtInt(p.score)}</td>
<td style="padding:6px 10px;text-align:right;font-variant-numeric:tabular-nums;color:#52606D;">${escapeHtml(fmtDay(p.lastSeenIso))}</td>
</tr>`
    })
    .join('')

  const quietBlock = `<p style="margin:0 0 24px;color:#52606D;font-size:14px;">No parcel-linked owner visited, opened, clicked, or messaged in this window. The cohort has ${fmtInt(r.identifiedPeople)} identified owners across ${fmtInt(r.linkedParcels)} linked parcels.</p>`

  const tableBlock = `<h2 style="font-size:15px;margin:24px 0 8px;color:#102742;">Active people</h2>
<table style="border-collapse:collapse;width:100%;font-size:13px;border:1px solid #E5E2D9;border-radius:6px;overflow:hidden;">
<thead><tr style="background:#faf8f4;"><th style="padding:8px 10px;text-align:left;font-weight:600;">Name</th><th style="padding:8px 10px;text-align:left;font-weight:600;">Parcel</th><th style="padding:8px 10px;text-align:left;font-weight:600;">Signals</th><th style="padding:8px 10px;text-align:right;font-weight:600;">Score</th><th style="padding:8px 10px;text-align:right;font-weight:600;">Last seen</th></tr></thead>
<tbody>${peopleRows}</tbody>
</table>
${d.people.length > DIGEST_MAX_PEOPLE ? `<p style="margin:8px 0 0;font-size:12px;color:#52606D;">Showing ${DIGEST_MAX_PEOPLE} of ${fmtInt(d.people.length)} active people.</p>` : ''}`

  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;color:#102742;max-width:720px;margin:0 auto;padding:24px;background:#FAF8F4;">
<div style="background:#FFFFFF;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(16,39,66,0.08);">
<h1 style="margin:0 0 4px;color:#102742;font-size:22px;">West Side cohort, weekly</h1>
<p style="margin:0 0 24px;color:#52606D;font-size:14px;">Parcel-linked owner activity since ${escapeHtml(fmtDay(d.windowStartIso))} (last ${d.sinceDays} days)</p>

<table style="border-collapse:collapse;width:100%;margin-bottom:12px;"><tr>
${kpiCell('Identified owners', r.identifiedPeople)}
${kpiCell('Active this window', r.activePeople)}
${kpiCell('Site visits', r.siteVisits)}
</tr></table>
<table style="border-collapse:collapse;width:100%;margin-bottom:12px;"><tr>
${kpiCell('Email opens', r.opens)}
${kpiCell('Email clicks', r.clicks)}
${kpiCell('Inbound messages', r.inboundMessages)}
</tr></table>

${top.length === 0 ? quietBlock : tableBlock}

<p style="margin:24px 0 0;font-size:12px;color:#9AA0A6;border-top:1px solid #E5E2D9;padding-top:12px;">
Full report: <a href="${SITE}/admin/crm/reporting/westside" style="color:#102742;">West Side cohort report</a>
</p>
</div>
</body></html>`
}

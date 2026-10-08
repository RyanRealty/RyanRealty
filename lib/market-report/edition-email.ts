/**
 * The monthly market report as an email: subject, preheader, body and the §0
 * trace, built from one published edition and nothing else.
 *
 * Matt 2026-09-30 ("Draft it for my OK"): each month the report publishes, its
 * headline numbers, a link to the edition and its PDF become a newsletter
 * DRAFT for his per-send approval. This module only builds; the draft writer
 * is ./edition-email-draft.ts, and nothing here sends.
 *
 * Every figure comes from the edition's frozen payload, the object its web
 * page and PDF render from, formatted by the same helpers (./format), so the
 * email says exactly what the report says. Each printed figure carries a
 * citation in the newsletter's own units (the R-2 pre-send check,
 * lib/newsletter/pre-send-gates.ts, matches printed tokens to them): whole
 * dollars, whole percents as printed, rounded days, months of supply as
 * printed. A withheld figure (v null, under its floor) is left out, never
 * filled.
 *
 * The body is section rows only; the newsletter shell (masthead, hero, broker
 * close, unsubscribe) wraps it at preview and send time.
 */
import { editionPath, editionPdfHref, hasPdf, MONTHLY_REPORT_PATH } from '@/app/housing-market/reports/monthly/_v3/edition-keys'
import { buildTrackedUrl, marketReportCampaign } from '@/lib/analytics/utm'
import type { EditionRow } from '@/lib/data/market-report/editions'
import type { NewsletterCitationEntry } from '@/lib/data/newsletter'
import { EMAIL_BODY_MUTED, EMAIL_CREAM, EMAIL_INK, EMAIL_NAVY, EMAIL_SERIF } from '@/lib/email/brand'
import { FIRST_EDITION_LABEL } from './edition-path-guard'
import { editionBuildStamp } from './edition-email-marker'
import { count, days, money, monthLabel, monthName, mosText } from './format'
import { citySentence } from './headline'
import { NOUN_SFR } from './narrative'
import type { Kpis, Verdict } from './types'

/** Absolute links: an inbox cannot resolve a relative path, and R-3 checks this host. */
export const EDITION_EMAIL_SITE = 'https://ryan-realty.com'

export type EditionEmail = {
  subject: string
  previewText: string
  bodyHtml: string
  bodyText: string
  citations: NewsletterCitationEntry[]
}

type EditionInput = Pick<EditionRow, 'edition_month' | 'payload' | 'pdf_path' | 'generated_at'>

const VERDICT_WORDS: Record<Verdict, string> = {
  seller: "a seller's market",
  balanced: 'a balanced market',
  buyer: "a buyer's market",
}

/** The R-2 verdict vocabulary. */
const VERDICT_CITED: Record<Verdict, 'sellers' | 'balanced' | 'buyers'> = {
  seller: 'sellers',
  balanced: 'balanced',
  buyer: 'buyers',
}

const RULE = 'rgba(16,39,66,.14)'

const CLOSING =
  "Want these numbers for your own neighborhood, or a read on what your home would sell for today? Reply to this email and we'll put it together for you."

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** A change as the report words it: whole percent, direction in words. */
function changeWords(yoy: number, ago: string): { text: string; pct: number } {
  const r = Math.round(yoy * 100)
  if (r === 0) return { text: `the same as ${ago}`, pct: 0 }
  return { text: `${r > 0 ? 'up' : 'down'} ${Math.abs(r)}% from ${ago}`, pct: Math.abs(r) }
}

/**
 * The direction a printed whole-percent change reads, for its citation's
 * figure: the value is unsigned (R-2 matches the printed digits), so the
 * figure carries the sign, and a draft's figures are compared by figure and
 * value (./edition-email-draft.ts).
 */
function direction(yoy: number): 'up' | 'down' | 'unchanged' {
  const r = Math.round(yoy * 100)
  return r > 0 ? 'up' : r < 0 ? 'down' : 'unchanged'
}

type Cell = { figure: string; caption: string }

export function buildEditionEmail(edition: EditionInput, opts: { site?: string } = {}): EditionEmail {
  const site = (opts.site ?? EDITION_EMAIL_SITE).replace(/\/$/, '')
  const payload = edition.payload
  const key = edition.edition_month.slice(0, 7)
  const label = monthLabel(key)
  const month = monthName(key)
  const ago = monthLabel(`${Number(key.slice(0, 4)) - 1}-${key.slice(5, 7)}`)
  const k: Kpis = payload.region.kpis
  const place = payload.region.geo.label
  // The build the figures came from (a republish is a new build): the draft
  // writer keys the email to it (./edition-email-draft.ts).
  const fetchedAt = editionBuildStamp(edition)
  const source = `Supabase public.market_report_editions, edition ${key} (payload frozen at publish, after the Spark reconciliation gate)`
  const defn = `definition ${payload.definitionId}`

  const citations: NewsletterCitationEntry[] = []
  const cite = (figure: string, value: string | number, filter: string) =>
    citations.push({ figure, source, filter: `${filter} · ${defn}`, value, fetched_at: fetchedAt })

  // ── Central Oregon: the four lead figures ────────────────────────────────
  const cells: Cell[] = []
  if (k.median.v != null) {
    let caption = 'median sale price'
    // As printed: money() shows whole dollars, and a median of an even count can end in .5.
    cite(`${place} median sale price, ${label}`, Math.round(k.median.v), `payload.region.kpis.median.v = ${k.median.v} (${k.median.n} sales)`)
    if (k.medianYoY != null) {
      const change = changeWords(k.medianYoY, ago)
      caption += `, ${change.text}`
      cite(`${place} median change from ${ago}: ${direction(k.medianYoY)} (percent, as printed)`, change.pct, `payload.region.kpis.medianYoY = ${k.medianYoY}`)
    }
    cells.push({ figure: money(k.median.v), caption })
  }
  if (k.sales > 0) {
    let caption = k.sales === 1 ? 'home sold' : 'homes sold'
    cite(`${place} homes sold, ${label}`, k.sales, 'payload.region.kpis.sales')
    if (k.salesYoY != null) {
      const diff = k.sales - k.salesPrior
      caption += diff === 0 ? `, the same number as ${ago}` : `, ${count(Math.abs(diff))} ${diff > 0 ? 'more' : 'fewer'} than ${ago}`
      cite(`${place} homes sold, ${ago}`, k.salesPrior, 'payload.region.kpis.salesPrior')
      if (diff !== 0) cite(`${place} change in homes sold from ${ago}: ${diff > 0 ? 'more' : 'fewer'}`, Math.abs(diff), 'payload.region.kpis.sales - salesPrior')
    }
    cells.push({ figure: count(k.sales), caption })
  }
  if (k.dtc.v != null) {
    cells.push({ figure: days(k.dtc.v), caption: 'median time to go under contract' })
    cite(`${place} median days to pending, ${label}`, Math.round(k.dtc.v), `payload.region.kpis.dtc.v = ${k.dtc.v} (${k.dtc.n} sales)`)
  }
  const supplyShown = k.mos != null && k.verdict != null
  if (supplyShown) {
    const printed = mosText(k.mos)
    cells.push({ figure: printed, caption: `months of supply, ${VERDICT_WORDS[k.verdict!]}` })
    cite(`${place} months of supply, end of ${label} (as printed)`, Number(printed), `payload.region.kpis.mos = ${k.mos}`)
    cite(`${place} market verdict, end of ${label}`, VERDICT_CITED[k.verdict!], 'payload.region.kpis.verdict')
    cite(`${place} homes for sale, end of ${label}`, k.active, 'payload.region.kpis.active')
    cite(`${place} sales in the six months ending ${label}`, k.closed6, 'payload.region.kpis.closed6')
  }

  const supplyLine = supplyShown
    ? `${count(k.active)} ${k.active === 1 ? 'home' : 'homes'} for sale at the end of ${month}, against ${count(k.closed6)} sales over the past six months.`
    : null

  // ── The cities the report reads monthly (Bend, Redmond) ──────────────────
  const cities: string[] = []
  for (const section of payload.monthly) {
    const line = citySentence(section)
    if (!line) continue
    const c = section.kpis
    const at = `payload.monthly[${section.geo.slug}].kpis`
    cite(`${section.geo.label} homes sold, ${label}`, c.sales, `${at}.sales`)
    cite(`${section.geo.label} median sale price, ${label}`, Math.round(c.median.v!), `${at}.median.v = ${c.median.v} (${c.median.n} sales)`)
    if (c.medianYoY != null) {
      cite(`${section.geo.label} median change from a year earlier: ${direction(c.medianYoY)} (percent, as printed)`, Math.abs(Math.round(c.medianYoY * 100)), `${at}.medianYoY = ${c.medianYoY}`)
    }
    if (c.dtc.v != null) {
      cite(`${section.geo.label} median days to pending, ${label}`, Math.round(c.dtc.v), `${at}.dtc.v = ${c.dtc.v} (${c.dtc.n} sales)`)
    }
    cities.push(line)
  }
  const cityNames = payload.monthly.filter((s) => s.kpis.median.v != null).map((s) => s.geo.label)

  // ── Links ─────────────────────────────────────────────────────────────────
  const editionUtm = {
    source: 'newsletter' as const,
    medium: 'email' as const,
    campaign: marketReportCampaign(key),
  }
  // Tracking rides only in the HTML hrefs. The plain-text part prints these
  // URLs as visible text, so it keeps the clean addresses (no visible change).
  const reportTextUrl = `${site}${editionPath(key)}`
  const pdfTextUrl = hasPdf(edition) ? `${site}${editionPdfHref(key)}` : null
  const archiveTextUrl = `${site}${MONTHLY_REPORT_PATH}`
  const reportUrl = buildTrackedUrl(reportTextUrl, editionUtm)
  const pdfUrl = pdfTextUrl ? buildTrackedUrl(pdfTextUrl, editionUtm) : null
  const archiveUrl = buildTrackedUrl(archiveTextUrl, editionUtm)
  const segment = `${NOUN_SFR.many.charAt(0).toUpperCase()}${NOUN_SFR.many.slice(1)}, the report's main measure.`

  // ── Subject and preheader ─────────────────────────────────────────────────
  const subject = `${place} market report: ${label}`
  const lead =
    k.median.v != null
      ? `The median ${NOUN_SFR.one} in ${place} sold for ${money(k.median.v)} in ${month}.`
      : `The ${place} market in ${month}, from our monthly report.`
  const previewText = supplyShown ? `${lead} ${mosText(k.mos)} months of supply: ${VERDICT_WORDS[k.verdict!]}.` : lead

  // ── HTML (section rows) ───────────────────────────────────────────────────
  const eyebrow = (text: string, top = 0) =>
    `<div style="font-size:12px;letter-spacing:.18em;color:${EMAIL_BODY_MUTED};font-weight:700;margin:${top}px 0 8px;">${escapeHtml(text)}</div>`
  const para = (text: string, bottom = 0) =>
    `<p style="margin:0 0 ${bottom}px;color:${EMAIL_INK};font-size:16px;line-height:1.6;">${escapeHtml(text)}</p>`
  const cellHtml = (cell: Cell, side: 'left' | 'right') =>
    `<td width="50%" valign="top" style="padding:14px ${side === 'left' ? '12px' : '0'} 14px ${side === 'right' ? '12px' : '0'};border-top:1px solid ${RULE};">
          <div style="font-family:${EMAIL_SERIF};font-size:30px;line-height:1.1;color:${EMAIL_NAVY};font-weight:700;">${escapeHtml(cell.figure)}</div>
          <div style="margin-top:4px;color:${EMAIL_INK};font-size:14px;line-height:1.45;">${escapeHtml(cell.caption)}</div>
        </td>`
  const gridRows: string[] = []
  for (let i = 0; i < cells.length; i += 2) {
    const right = cells[i + 1]
    gridRows.push(`<tr>
        ${cellHtml(cells[i]!, 'left')}
        ${right ? cellHtml(right, 'right') : '<td width="50%"></td>'}
      </tr>`)
  }

  const rows: string[] = []
  rows.push(`<!-- ============ MONTHLY MARKET REPORT ============ -->
  <tr><td style="padding:34px 34px 0;">
    ${eyebrow(`${place.toUpperCase()} MARKET REPORT`)}
    <div style="border-bottom:1px solid rgba(16,39,66,.22);"></div>
    <div style="font-family:${EMAIL_SERIF};font-size:34px;line-height:1.15;color:${EMAIL_NAVY};font-weight:700;margin:22px 0 10px;">${escapeHtml(label)}</div>
    ${para(`Our monthly report on the ${place} market is out. ${segment}`)}
  </td></tr>`)
  if (gridRows.length > 0) {
    rows.push(`<tr><td style="padding:22px 34px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      ${gridRows.join('\n      ')}
    </table>
  </td></tr>`)
  }
  if (supplyLine || cities.length > 0) {
    rows.push(`<tr><td style="padding:18px 34px 0;">
    ${supplyLine ? para(supplyLine) : ''}
    ${cities.length > 0 ? eyebrow(cityNames.join(' and ').toUpperCase(), supplyLine ? 24 : 0) : ''}
    ${cities.map((line) => para(line, 10)).join('\n    ')}
  </td></tr>`)
  }
  const secondary = [
    pdfUrl ? `<a href="${pdfUrl}" style="color:${EMAIL_NAVY};font-weight:600;">Download the PDF</a>` : null,
    `<a href="${archiveUrl}" style="color:${EMAIL_NAVY};font-weight:600;">Every monthly report since ${escapeHtml(FIRST_EDITION_LABEL)}</a>`,
  ].filter(Boolean)
  rows.push(`<tr><td style="padding:22px 34px 0;">
    <a href="${reportUrl}" style="display:inline-block;background:${EMAIL_NAVY};color:${EMAIL_CREAM};font-size:13px;font-weight:700;letter-spacing:.08em;text-decoration:none;padding:13px 22px;">READ THE ${escapeHtml(month.toUpperCase())} REPORT &rarr;</a>
    <p style="margin:14px 0 0;color:${EMAIL_INK};font-size:14px;line-height:1.6;">${secondary.join(' &middot; ')}</p>
  </td></tr>`)
  rows.push(`<tr><td style="padding:22px 34px 0;">
    ${para(CLOSING)}
  </td></tr>`)

  // ── Plain text ────────────────────────────────────────────────────────────
  const text: string[] = [`${place.toUpperCase()} MARKET REPORT`, label, '', `Our monthly report on the ${place} market is out. ${segment}`, '']
  for (const cell of cells) text.push(`${cell.figure} ${cell.caption}`)
  if (cells.length > 0) text.push('')
  if (supplyLine) text.push(supplyLine, '')
  if (cities.length > 0) text.push(...cities, '')
  text.push(`Read the ${month} report: ${reportTextUrl}`)
  if (pdfTextUrl) text.push(`Download the PDF: ${pdfTextUrl}`)
  text.push(`Every monthly report since ${FIRST_EDITION_LABEL}: ${archiveTextUrl}`, '')
  text.push(CLOSING)

  return {
    subject,
    previewText,
    bodyHtml: rows.join('\n\n'),
    bodyText: text.join('\n'),
    citations,
  }
}

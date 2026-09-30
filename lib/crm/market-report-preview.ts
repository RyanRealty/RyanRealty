/**
 * market-report-preview — render a market report for an admin to LOOK at
 * (the Subscriptions hub's row preview and the settings page's area preview),
 * built exactly as a send builds it, minus the send.
 *
 * Before 2026-09-29 both previews rendered the email with Matt's card whatever
 * the contact's broker, skipped prepareDeliverableEmail (so the footer and
 * the plain-text part differed from what went out) and never said when a real
 * send would be held. Now a preview:
 *   - uses the contact's assigned broker for the close card and the links
 *     (the acting admin's broker when there is no contact);
 *   - carries the report's own links, signed as a PREVIEW (they open the
 *     contact's preferences page read-only), or placeholders with no contact;
 *   - runs through prepareDeliverableEmail with the body's own footer, the
 *     same call the send makes, and NOT through attributeOutbound: no person
 *     token, no open pixel, no click wraps, so nothing an admin clicks in a
 *     preview reads as the contact;
 *   - says, in plain words, when a real send would be held for stale data.
 *
 * Render-only: it sends nothing and writes nothing.
 */
import 'server-only'

import { getMarketReportData } from '@/lib/data/crm/getMarketReportData'
import { renderMarketReportEmail, type EmailFigureTrace, type ReportFigure } from '@/lib/crm/market-report-email'
import { describeStaleSources, findStaleSources } from '@/lib/crm/market-report-freshness'
import { prepareDeliverableEmail } from '@/lib/email/prepare'
import { shellBrokerFor } from '@/lib/email/broker-identity'
import { REPORT_LINK_ORIGIN, REPORT_PREFERENCES_PATH, reportEmailLinks } from '@/lib/email/report-link-token'

const SITE_URL = REPORT_LINK_ORIGIN

export type MarketReportPreview = {
  subject: string
  html: string
  text: string
  traces: EmailFigureTrace[]
  figures: ReportFigure[]
  /** The requested slugs that resolved verified data (others are omitted, as a send omits them). */
  renderedAreas: string[]
  omittedAreas: string[]
  /** A real send right now would be held: which source is stale and by how much. Null when fresh. */
  heldNote: string | null
}

export async function renderMarketReportPreview(input: {
  areaSlugs: readonly string[]
  contactName: string | null
  /** The broker the email is from: the contact's assigned broker, else the acting admin's. */
  brokerSlug: string
  /** The contact the preview is for, when there is one (signs preview links for her page). */
  personId: number | null
  subscriptionId: number | null
  now?: Date
}): Promise<{ ok: true; preview: MarketReportPreview } | { ok: false; error: string }> {
  const requested = [...new Set(input.areaSlugs.map((s) => (s ?? '').trim()).filter(Boolean))]
  if (requested.length === 0) return { ok: false, error: 'Pick at least one area' }
  const now = input.now ?? new Date()

  const blocks = await getMarketReportData(requested)
  if (blocks.length === 0) {
    return { ok: false, error: 'No verified market data for these areas right now, so a real send would be held too.' }
  }
  const stale = findStaleSources(blocks, now)
  const heldNote = stale.length > 0 ? `A real send right now would be held: ${describeStaleSources(stale)}.` : null

  const personId = input.personId && input.personId > 0 ? input.personId : null
  const links = personId
    ? reportEmailLinks({
        personId,
        subscriptionId: input.subscriptionId,
        emailKey: `market-report:preview-render:${personId}`,
        preview: true,
      })
    : {
        viewUrl: `${SITE_URL}${REPORT_PREFERENCES_PATH}?preview=1`,
        manageUrl: `${SITE_URL}${REPORT_PREFERENCES_PATH}?preview=1`,
        unsubscribeUrl: `${SITE_URL}${REPORT_PREFERENCES_PATH}?preview=1&stop=1`,
        oneClickUrl: `${SITE_URL}${REPORT_PREFERENCES_PATH}?preview=1`,
      }

  const rendered = renderMarketReportEmail({
    contactName: input.contactName,
    brokerSlug: input.brokerSlug,
    areas: blocks,
    unsubscribeUrl: links.unsubscribeUrl,
    viewUrl: links.viewUrl,
    manageUrl: links.manageUrl,
    senderBroker: shellBrokerFor(input.brokerSlug),
    asOf: now,
  })
  const prepared = prepareDeliverableEmail({
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    personId,
    unsubscribeUrl: links.unsubscribeUrl,
    oneClickUnsubscribeUrl: links.oneClickUrl,
    footer: 'from-body',
  })

  const renderedAreas = blocks.map((b) => b.slug)
  return {
    ok: true,
    preview: {
      subject: rendered.subject,
      html: prepared.html,
      text: prepared.text,
      traces: rendered.traces,
      figures: rendered.figures,
      renderedAreas,
      omittedAreas: requested.filter((s) => !renderedAreas.includes(s)),
      heldNote,
    },
  }
}

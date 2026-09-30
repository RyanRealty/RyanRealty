'use server'

/**
 * previewMarketReportEmail — the admin one-click preview for the market-report
 * email on the settings page (Wave 8; rebuilt 2026-09-29).
 *
 * Renders the email a recipient gets for these areas: same data path
 * (getMarketReportData, §0 figures), same renderer, same shell, and the same
 * prepareDeliverableEmail footer pass the send makes (lib/crm/market-report-
 * preview.ts). There is no contact here, so the close card is the ACTING
 * broker's (not always Matt's) and the report's links are placeholders. It
 * says when a real send would be held for stale data.
 *
 * Returns { data, error } — never throws. Gated on CRM access (broker or
 * superuser); the returned `traces` are the §0 audit trail the preview surface
 * shows BELOW the iframe. Traces never ship in a recipient email.
 */

import { getCrmAccess } from '@/app/actions/crm'
import type { EmailFigureTrace } from '@/lib/crm/market-report-email'
import { renderMarketReportPreview } from '@/lib/crm/market-report-preview'
import { reportAreaLabel } from '@/lib/crm/market-report-areas'

export type MarketReportEmailPreview = {
  subject: string
  html: string
  text: string
  traces: EmailFigureTrace[]
  /** The subscribed slugs that actually resolved cache data (others omitted). */
  renderedAreas: string[]
  /** Subscribed slugs that had NO cache data and were honestly omitted. */
  omittedAreas: string[]
  /** Display label per slug ("bend-larkspur" -> "Larkspur"). */
  areaLabels: Record<string, string>
  /** A real send right now would be held (stale data), in plain words. Null when fresh. */
  heldNote: string | null
}

export async function previewMarketReportEmail(input: {
  areas: string[]
  contactName?: string | null
}): Promise<{ data: MarketReportEmailPreview | null; error: string | null }> {
  try {
    const access = await getCrmAccess()
    if (!access) return { data: null, error: 'Not authorized' }

    const requested = Array.isArray(input.areas)
      ? input.areas.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
      : []
    if (requested.length === 0) return { data: null, error: 'Pick at least one area' }

    const res = await renderMarketReportPreview({
      areaSlugs: requested,
      contactName: input.contactName ?? null,
      brokerSlug: access.brokerSlug ?? 'matt',
      personId: null,
      subscriptionId: null,
    })
    if (!res.ok) return { data: null, error: res.error }
    const p = res.preview
    const areaLabels: Record<string, string> = {}
    for (const slug of [...p.renderedAreas, ...p.omittedAreas]) areaLabels[slug] = reportAreaLabel(slug)

    return {
      data: {
        subject: p.subject,
        html: p.html,
        text: p.text,
        traces: p.traces,
        renderedAreas: p.renderedAreas,
        omittedAreas: p.omittedAreas,
        areaLabels,
        heldNote: p.heldNote,
      },
      error: null,
    }
  } catch (err) {
    console.error('[previewMarketReportEmail]', err)
    return { data: null, error: 'Failed to build the preview' }
  }
}

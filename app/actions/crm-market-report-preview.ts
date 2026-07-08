'use server'

/**
 * previewMarketReportEmail — the admin one-click preview for the market-report
 * subscription email (Wave 8).
 *
 * Renders the EXACT html a recipient gets: same data path (getMarketReportData,
 * §0 cache-only figures), same renderer (renderMarketReportEmail), same shell.
 * The only differences from a real send: the unsubscribe link is a preview
 * placeholder (no real token minted) and no suppression/send machinery runs.
 *
 * Returns { data, error } — never throws. Gated on CRM access (broker or
 * superuser); the returned `traces` are the §0 audit trail the preview surface
 * shows BELOW the iframe. Traces never ship in a recipient email.
 */

import { getCrmAccess } from '@/app/actions/crm'
import { getMarketReportData } from '@/lib/data/crm/getMarketReportData'
import {
  renderMarketReportEmail,
  type EmailFigureTrace,
} from '@/lib/crm/market-report-email'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export type MarketReportEmailPreview = {
  subject: string
  html: string
  text: string
  traces: EmailFigureTrace[]
  /** The subscribed slugs that actually resolved cache data (others omitted). */
  renderedAreas: string[]
  /** Subscribed slugs that had NO cache data and were honestly omitted. */
  omittedAreas: string[]
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

    const blocks = await getMarketReportData(requested)
    if (blocks.length === 0) {
      return { data: null, error: 'No cache data for the selected areas, nothing to preview' }
    }

    const rendered = renderMarketReportEmail({
      contactName: input.contactName ?? null,
      areas: blocks,
      // Preview placeholder — a real send mints a per-person token instead.
      unsubscribeUrl: `${SITE_URL}/api/email/unsubscribe?preview=1`,
    })

    const renderedAreas = blocks.map((b) => b.slug)
    const omittedAreas = requested.filter((s) => !renderedAreas.includes(s.trim()))

    return {
      data: {
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        traces: rendered.traces,
        renderedAreas,
        omittedAreas,
      },
      error: null,
    }
  } catch (err) {
    console.error('[previewMarketReportEmail]', err)
    return { data: null, error: 'Failed to build the preview' }
  }
}

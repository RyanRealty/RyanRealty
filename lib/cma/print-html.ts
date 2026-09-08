/**
 * Print HTML for CMA PDF. Uses current render CSS + stored render_args so a
 * layout fix ships without waiting on a full rebuild of html_content.
 */

import { getCmaAccessIdentity, getCmaRenderSourceBySlug, getCmaStoredHtmlBySlug } from '@/lib/data'
import { getCmaBrokerBySlugOrEmail } from '@/lib/data/cma/builderReads'
import { applyCompVerdicts, verdictsFromBuildSummary } from '@/lib/cma/client-facing'
import { renderCmaHtml, type RenderCmaArgs } from '@/lib/cma/render'
import { buildCmaMapDataUri } from '@/lib/cma/map'
import type { CompPinMapOverlay } from '@/lib/cma/comp-pin-map'
import type { CmaBroker } from '@/lib/cma/types'
import type { TrackedDocLinkCtx } from '@/lib/cma/doc-links'

export async function resolveCmaPrintHtml(slug: string): Promise<{ html: string; status: string } | null> {
  const source = await getCmaRenderSourceBySlug(slug)
  if (!source) return null

  if (source.render_args && typeof source.render_args === 'object') {
    const brokerRow = await getCmaBrokerBySlugOrEmail({ slug: source.broker_slug ?? 'matthew-ryan' })
    const broker: CmaBroker = {
      id: (brokerRow?.id as string) ?? null,
      slug: (brokerRow?.slug as string) ?? (source.broker_slug ?? 'matthew-ryan'),
      displayName: (brokerRow?.display_name as string) || 'Matt Ryan',
      title: (brokerRow?.title as string) || 'Owner & Principal Broker',
      licenseNumber: (brokerRow?.license_number as string | null) ?? null,
      email: (brokerRow?.email as string | null) ?? null,
      phone: (brokerRow?.twilio_number as string | null) ?? null,
      photoUrl: (brokerRow?.photo_url as string | null) ?? null,
    }
    const stored = source.render_args as unknown as RenderCmaArgs
    const comps = applyCompVerdicts(stored.comps ?? [], verdictsFromBuildSummary(source.build_summary))
    let mapDataUri: string | null = stored.mapDataUri ?? null
    // The overlay travels with the tile: it is the centre, zoom and pin
    // coordinates the tile was actually drawn at, and without it chapter 3's
    // map is a bitmap that cannot answer a tap (tasteReview item 2).
    let mapOverlay: CompPinMapOverlay | null = null
    if (!mapDataUri) {
      try {
        const map = await buildCmaMapDataUri(stored.subject, comps)
        mapDataUri = map?.dataUri ?? null
        mapOverlay = map ? { view: map.view, pins: map.pins, boundaryShown: map.boundaryShown } : null
      } catch {
        mapDataUri = null
        mapOverlay = null
      }
    }
    // C9: never rebuild/pass subject-only map — comps map is the single letter map.
    const { html } = renderCmaHtml({
      ...stored,
      comps,
      broker,
      mapDataUri,
      mapOverlay,
      subjectMapDataUri: null,
      docLinks: await resolveDocLinkCtx(slug, broker.slug),
    })
    return { html, status: source.status }
  }

  const storedHtml = await getCmaStoredHtmlBySlug(slug)
  if (!storedHtml) return null
  return { html: storedHtml, status: source.status }
}

/**
 * Who this document went to.
 *
 * Resolved at SERVE, not at build: identity belongs to the delivery, not to
 * the stored figures. Every address and CTA in the document carries it, so a
 * tap shows on the person's timeline and in this document's outcomes
 * (CMA_REIMAGINED_2026-09-07.md, Links and tracking).
 *
 * Fail-open — a link without `_pid` still works, it just cannot be stitched.
 */
export async function resolveDocLinkCtx(
  slug: string,
  brokerSlug: string | null,
): Promise<TrackedDocLinkCtx> {
  let personId: number | null = null
  try {
    personId = (await getCmaAccessIdentity(slug))?.personId ?? null
  } catch {
    personId = null
  }
  return { brokerSlug, personId, cmaSlug: slug }
}

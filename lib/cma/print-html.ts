/**
 * Print HTML for CMA PDF. Uses current render CSS + stored render_args so a
 * layout fix ships without waiting on a full rebuild of html_content.
 */

import { getCmaRenderSourceBySlug, getCmaStoredHtmlBySlug } from '@/lib/data'
import { getCmaBrokerBySlugOrEmail } from '@/lib/data/cma/builderReads'
import { applyCompVerdicts, verdictsFromBuildSummary } from '@/lib/cma/client-facing'
import { renderCmaHtml, type RenderCmaArgs } from '@/lib/cma/render'
import { buildCmaMapDataUri, buildSubjectLocationMapDataUri } from '@/lib/cma/map'
import type { CmaBroker } from '@/lib/cma/types'

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
    let subjectMapDataUri: string | null = stored.subjectMapDataUri ?? null
    if (!mapDataUri) {
      try {
        const map = await buildCmaMapDataUri(stored.subject, comps)
        mapDataUri = map?.dataUri ?? null
      } catch {
        mapDataUri = null
      }
    }
    if (!subjectMapDataUri) {
      try {
        const subjectMap = await buildSubjectLocationMapDataUri(stored.subject)
        subjectMapDataUri = subjectMap?.dataUri ?? null
      } catch {
        subjectMapDataUri = null
      }
    }
    const { html } = renderCmaHtml({ ...stored, comps, broker, mapDataUri, subjectMapDataUri })
    return { html, status: source.status }
  }

  const storedHtml = await getCmaStoredHtmlBySlug(slug)
  if (!storedHtml) return null
  return { html: storedHtml, status: source.status }
}

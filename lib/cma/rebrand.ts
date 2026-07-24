/**
 * rebrand — re-render a finished CMA under a different signing broker WITHOUT
 * recomputing a single number (W10.3).
 *
 * THE DEFECT THIS REPLACES
 * The "Signing broker" select in components/admin/cma/CmaReviewActions.tsx was
 * wired to rebuildCmaAction, which calls buildCma without forwarding comp keys.
 * buildCma re-selects comparables from scratch and re-runs two Anthropic passes
 * (judgeComps, auditCma). So changing WHO SIGNS a client-facing pricing document
 * could change the recommended list price — the same property, valued twice,
 * producing two numbers for a reason that has nothing to do with the property.
 * That is a CLAUDE.md section 0 violation on a document a seller prices against.
 *
 * A re-brand is a RENDER, not a REBUILD. renderCmaHtml is a pure function of
 * RenderCmaArgs, so swapping only `broker` and re-rendering is guaranteed to
 * preserve every figure. This module never imports buildCma, and
 * ci:cma-rebrand-integrity holds that.
 *
 * REFUSALS (all typed, none silent):
 *   - a finalized or delivered document is not re-branded in place; it is a
 *     record of what was sent;
 *   - a document built before render_args existed cannot be re-rendered
 *     faithfully, so it reports that rather than quietly rebuilding;
 *   - an unknown broker slug is refused rather than defaulting to Matt, because
 *     silently signing as the wrong broker is worse than an error.
 */

import { getCmaAdminRowBySlug, updateCmaRowFieldsBySlug, getCmaBrokerBySlugOrEmail } from '@/lib/data'
import { renderCmaHtml, type RenderCmaArgs } from '@/lib/cma/render'
import { buildCmaMapDataUri } from '@/lib/cma/map'
import type { CmaBroker } from '@/lib/cma/types'

export type RebrandResult =
  | { ok: true; slug: string; brokerSlug: string; recommendedUnchanged: true }
  | { ok: false; reason: 'not_found' | 'locked' | 'no_render_args' | 'unknown_broker' | 'render_failed'; message: string }

/** The stored args, which deliberately exclude `broker` and `mapDataUri`. */
type StoredRenderArgs = Omit<RenderCmaArgs, 'broker' | 'mapDataUri'>

/**
 * Pull the map out of already-rendered HTML. Used when the Maps fetch fails at
 * re-brand time — the previous render's map is still correct for this subject
 * and these comps, and shipping the document without its map would be a visible
 * regression caused by an unrelated outage.
 */
function mapFromRenderedHtml(html: string | null): string | null {
  if (!html) return null
  // renderCmaHtml emits `<img class="map-img" src="data:..." alt="Comparable sales map" />`
  // (lib/cma/render.ts). An earlier version of this regex searched for a
  // `cma-map` class that the renderer never emits, so the fallback silently
  // never fired and a Maps outage dropped the map page. Match the real markup:
  // the img with class map-img OR the "Comparable sales map" alt text.
  const byClass = /<img\b[^>]*\bclass="[^"]*\bmap-img\b[^"]*"[^>]*\bsrc="(data:image\/[a-z]+;base64,[^"]+)"/i.exec(html)
    ?? /<img\b[^>]*\bsrc="(data:image\/[a-z]+;base64,[^"]+)"[^>]*\bclass="[^"]*\bmap-img\b/i.exec(html)
  if (byClass) return byClass[1]
  const byAlt = /<img\b[^>]*\bsrc="(data:image\/[a-z]+;base64,[^"]+)"[^>]*\balt="Comparable sales map"/i.exec(html)
    ?? /<img\b[^>]*\balt="Comparable sales map"[^>]*\bsrc="(data:image\/[a-z]+;base64,[^"]+)"/i.exec(html)
  return byAlt?.[1] ?? null
}

export async function rebrandCma(input: { slug: string; brokerSlug: string }): Promise<RebrandResult> {
  const slug = input.slug?.trim()
  const brokerSlug = input.brokerSlug?.trim()
  if (!slug || !brokerSlug) {
    return { ok: false, reason: 'not_found', message: 'slug and brokerSlug are required' }
  }

  const row = await getCmaAdminRowBySlug(slug)
  if (!row) return { ok: false, reason: 'not_found', message: `No CMA found for ${slug}.` }

  const r = row as unknown as Record<string, unknown>
  const status = String(r.status ?? 'draft')
  if (r.delivered_at || r.finalized_at || status === 'delivered' || status === 'finalized') {
    return {
      ok: false,
      reason: 'locked',
      message:
        'This CMA is finalized or already delivered. It is the record of what the client received, so it is not re-branded in place. Build a new one for the other broker.',
    }
  }

  const storedArgs = r.render_args as StoredRenderArgs | null
  if (!storedArgs || typeof storedArgs !== 'object' || !storedArgs.pricing) {
    return {
      ok: false,
      reason: 'no_render_args',
      message:
        'This CMA predates the re-brand pass, so its render inputs were never stored and it cannot be re-rendered with identical numbers. Rebuild it once; every build from now on stores them.',
    }
  }

  const brokerRow = await getCmaBrokerBySlugOrEmail({ slug: brokerSlug })
  if (!brokerRow) {
    return { ok: false, reason: 'unknown_broker', message: `No active broker with slug ${brokerSlug}.` }
  }
  const broker: CmaBroker = {
    id: (brokerRow.id as string) ?? null,
    slug: (brokerRow.slug as string) ?? brokerSlug,
    displayName: (brokerRow.display_name as string) || '',
    title: (brokerRow.title as string) || 'Broker',
    licenseNumber: (brokerRow.license_number as string | null) ?? null,
    email: (brokerRow.email as string | null) ?? null,
    // twilio_number, never `phone` — ci:broker-published-phone.
    phone: (brokerRow.twilio_number as string | null) ?? null,
    photoUrl: (brokerRow.photo_url as string | null) ?? null,
  }

  // The map is excluded from render_args (~300KB). Re-derive it; if that fails,
  // reuse the one already embedded in the previous render rather than dropping
  // the map because an unrelated API had a bad minute.
  let mapDataUri: string | null = null
  try {
    const map = await buildCmaMapDataUri(storedArgs.subject, storedArgs.comps)
    mapDataUri = map?.dataUri ?? null
  } catch {
    mapDataUri = null
  }
  if (!mapDataUri) mapDataUri = mapFromRenderedHtml(r.html_content as string | null)

  let html: string
  try {
    const rendered = renderCmaHtml({ ...storedArgs, broker, mapDataUri })
    html = rendered.html
  } catch (err) {
    return {
      ok: false,
      reason: 'render_failed',
      message: err instanceof Error ? err.message : 'render failed',
    }
  }

  // ONLY the presentation changes. recommended_list, value_low, value_high,
  // comps_count and citations are deliberately untouched — that is the whole
  // point of this module, and the gate asserts they are not in this update.
  const upd = await updateCmaRowFieldsBySlug(slug, {
    html_content: html,
    broker_id: broker.id,
    broker_slug: broker.slug,
    pdf_path: null, // any previously rendered PDF still carries the old signature
  })
  if (upd && typeof upd === 'object' && 'error' in upd && upd.error) {
    return { ok: false, reason: 'render_failed', message: String(upd.error) }
  }

  return { ok: true, slug, brokerSlug: broker.slug, recommendedUnchanged: true }
}

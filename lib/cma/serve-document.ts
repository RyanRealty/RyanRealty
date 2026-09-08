/**
 * Shared CMA HTML serve for public /cma/[slug] and admin review.
 * Drafts stay 404 for the public. Brokers review through admin context.
 */

import { cookies } from 'next/headers'
import {
  getCmaAccessIdentity,
  getCmaRenderSourceBySlug,
  getCmaServeHead,
  getCmaStoredHtmlBySlug,
} from '@/lib/data'
import { getCmaBrokerBySlugOrEmail } from '@/lib/data/cma/builderReads'
import { renderImmersiveCmaHtml } from '@/lib/cma/immersive'
import { resolveCmaPrintHtml, resolveDocLinkCtx } from '@/lib/cma/print-html'
import { buildCmaMapDataUri } from '@/lib/cma/map'
import type { CompPinMapOverlay } from '@/lib/cma/comp-pin-map'
import { applyCompVerdicts, verdictsFromBuildSummary } from '@/lib/cma/client-facing'
import { canBrokerReviewCma, isCmaClientReady } from '@/lib/cma/draft-access'
import { hydrateCmaMarketArea } from '@/lib/cma/market-area-hydrate'
import type { RenderCmaArgs } from '@/lib/cma/render'
import type { CmaBroker } from '@/lib/cma/types'
import { GOOGLE_COMMS_COOKIE, hasGoogleCommsConsentRecorded } from '@/lib/auth/google-comms-consent'
import {
  decideCmaAccess,
  renderRegisterShell,
  renderConsentShell,
  renderWrongPersonShell,
} from '@/lib/cma/register-gate'
import { SMS_CONSENT_TEXT } from '@/lib/crm/sms-consent-text'
import type { CmaRenderSource } from '@/lib/data/cma/documents'
import { adminReviewBannerHtml, injectAdminReviewBanner } from '@/lib/cma/review-banner'

export const CMA_DOC_HEADERS = {
  'Content-Type': 'text/html',
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'private, no-store',
  'X-Frame-Options': 'SAMEORIGIN',
} as const

export type CmaServeResult =
  | { kind: 'html'; status: number; html: string; headers?: Record<string, string> }
  | { kind: 'json'; status: number; body: Record<string, unknown> }
  | { kind: 'redirect'; url: string; status: number }

/**
 * A DELIVERED CMA IS FROZEN (D27). Both call sites pass hydrateArea: false, so a
 * document already in a client's hands renders the figures that were true when
 * the broker signed it. Leftover governs NEW builds; it never reaches back into a
 * delivered one.
 *
 * The flag is kept rather than deleted because an admin preview may one day want
 * a live board, but flipping it to true on the client path would silently restate
 * a signed document's market figures with no visible reason — the client sees
 * different numbers than they were sent. If you are about to pass true here,
 * that is the decision you are making.
 */
/**
 * Exported so `scripts/cma-lookpass.ts` (read-only visual review tool) can
 * render the exact same immersive HTML this route serves, instead of forking
 * the render_args -> render-input glue. Production behavior is unchanged —
 * this is still only called from `serveCmaDocument` on the request path.
 */
export async function immersiveFromRow(
  row: CmaRenderSource,
  origin: string,
  hydrateArea: boolean,
  slug?: string,
): Promise<string | null> {
  if (!row.render_args || typeof row.render_args !== 'object') return null
  try {
    const brokerRow = await getCmaBrokerBySlugOrEmail({ slug: row.broker_slug ?? 'matthew-ryan' })
    const broker: CmaBroker = {
      id: (brokerRow?.id as string) ?? null,
      slug: (brokerRow?.slug as string) ?? (row.broker_slug ?? 'matthew-ryan'),
      displayName: (brokerRow?.display_name as string) || 'Matt Ryan',
      title: (brokerRow?.title as string) || 'Owner & Principal Broker',
      licenseNumber: (brokerRow?.license_number as string | null) ?? null,
      email: (brokerRow?.email as string | null) ?? null,
      phone: (brokerRow?.twilio_number as string | null) ?? null,
      photoUrl: (brokerRow?.photo_url as string | null) ?? null,
    }
    const stored = row.render_args as unknown as RenderCmaArgs
    const comps = applyCompVerdicts(stored.comps ?? [], verdictsFromBuildSummary(row.build_summary))
    // C9: render_args omits mapDataUri (~300KB). Rebuild the Google comps pin map
    // here so Open report / immersive shows subject + numbered sales once.
    let mapDataUri: string | null = stored.mapDataUri ?? null
    // The overlay travels with the tile: it is the centre, zoom and pin
    // coordinates the tile was actually drawn at, and without it chapter 3's
    // map is a bitmap that cannot answer a tap (tasteReview item 2).
    let mapOverlay: CompPinMapOverlay | null = null
    if (!mapDataUri) {
      try {
        const map = await buildCmaMapDataUri(stored.subject, comps)
        mapDataUri = map?.dataUri ?? null
        mapOverlay = map ? { view: map.view, pins: map.pins } : null
      } catch {
        mapDataUri = null
        mapOverlay = null
      }
    }
    const base = {
      ...stored,
      comps,
      broker,
      mapDataUri,
      mapOverlay,
      subjectMapDataUri: null,
      // Identity for every tracked link in the document. Resolved here rather
      // than at build: it belongs to the delivery, not to the stored figures.
      docLinks: slug ? await resolveDocLinkCtx(slug, broker.slug) : null,
    }
    const hydrated = hydrateArea ? await hydrateCmaMarketArea(base) : base
    return renderImmersiveCmaHtml(hydrated, origin)
  } catch (err) {
    console.error('[cma/serve] immersive render failed:', err)
    return null
  }
}

function withTracker(html: string, extra = ''): string {
  const tracker = `<script src="/rr-doc-tracker.js" defer></script>${extra}`
  return html.includes('</body>') ? html.replace('</body>', `${tracker}</body>`) : html + tracker
}

function storedHtmlResult(html: string, origin: string): CmaServeResult {
  let out = html.replace(/https?:\/\/[^'")\s]+(\/fonts\/[^'")\s]+)/g, `${origin}$1`)
  out = withTracker(out, '<script src="/rr-cma-doc.js" defer></script>')
  return { kind: 'html', status: 200, html: out, headers: CMA_DOC_HEADERS }
}

export type CmaServeOpts = {
  slug: string
  requestUrl: string
  isAdmin: boolean
  viewerEmail: string | null
  skipRegisterGate?: boolean
  /**
   * THE BROKER'S OWN VIEW, `/admin/cmas/[slug]/view`, and only that.
   *
   * A row whose audit says it needs review renders a navy gate at the top of
   * the document here (tasteReview round three, §2). It is deliberately NOT
   * keyed on `isAdmin`: /cma/[slug] passes isAdmin true whenever the person
   * opening the client's own link holds an admin session, and the audit's
   * words — "indefensible" — are not written for the seller.
   */
  adminReview?: boolean
}

export async function serveCmaDocument(opts: CmaServeOpts): Promise<CmaServeResult> {
  const result = await serveCmaDocumentResult(opts)
  if (!opts.adminReview || result.kind !== 'html') return result
  const source = await getCmaRenderSourceBySlug(opts.slug.trim().toLowerCase())
  const pricing = (source?.render_args as { pricing?: unknown } | null)?.pricing ?? null
  const banner = adminReviewBannerHtml(pricing)
  return banner ? { ...result, html: injectAdminReviewBanner(result.html, banner) } : result
}

async function serveCmaDocumentResult(opts: CmaServeOpts): Promise<CmaServeResult> {
  const safeSlug = opts.slug.trim().toLowerCase()
  if (!/^[a-z0-9-]{3,80}$/.test(safeSlug)) {
    return { kind: 'json', status: 400, body: { error: 'Invalid slug' } }
  }

  const head = await getCmaServeHead(safeSlug)
  if (!head) return { kind: 'json', status: 404, body: { error: 'CMA not found' } }

  if (!canBrokerReviewCma({ isAdmin: opts.isAdmin, status: head.status })) {
    return { kind: 'json', status: 404, body: { error: 'CMA not found' } }
  }

  const origin = new URL(opts.requestUrl).origin
  const wantsPrint = new URL(opts.requestUrl).searchParams.has('print')
  const publicReady = isCmaClientReady(head.status)

  if (publicReady && !opts.isAdmin && !opts.skipRegisterGate) {
    const identity = await getCmaAccessIdentity(safeSlug)
    const commsCookie = (await cookies()).get(GOOGLE_COMMS_COOKIE)?.value
    const decision = decideCmaAccess({
      isAdmin: false,
      viewerEmail: opts.viewerEmail,
      clientEmail: identity?.clientEmail ?? null,
      personEmails: identity?.personEmails ?? [],
      claimedBy: identity?.claimedBy ?? null,
      consentRecorded: identity?.consentRecorded ?? false,
      commsConsentRecorded: hasGoogleCommsConsentRecorded(commsCookie),
    })
    if (decision.kind === 'register') {
      return {
        kind: 'html',
        status: 200,
        html: renderRegisterShell({
          slug: safeSlug,
          address: identity?.subjectAddress ?? null,
          clientName: identity?.clientName ?? null,
        }),
      }
    }
    if (decision.kind === 'consent' || decision.kind === 'claim-and-consent') {
      return {
        kind: 'html',
        status: 200,
        html: renderConsentShell({
          slug: safeSlug,
          address: identity?.subjectAddress ?? null,
          viewerEmail: opts.viewerEmail ?? '',
          smsConsentText: SMS_CONSENT_TEXT,
          claiming: decision.kind === 'claim-and-consent',
        }),
      }
    }
    if (decision.kind === 'wrong-person') {
      return {
        kind: 'html',
        status: 403,
        html: renderWrongPersonShell({ viewerEmail: opts.viewerEmail ?? '' }),
      }
    }
  }

  // P9, Matt 2026-09-07: ?print=1 used to serve the frozen build-time blob
  // while the PDF re-rendered from render_args, so a reviewer opening the
  // print link saw a document the client would never receive, and every
  // renderer fix looked like it had not shipped. Both now render from
  // render_args through the same function lib/cma-pdf.ts calls.
  if (wantsPrint) {
    const letter = await resolveCmaPrintHtml(safeSlug)
    if (letter?.html) {
      return {
        kind: 'html',
        status: 200,
        html: withTracker(letter.html, '<script src="/rr-cma-doc.js" defer></script>'),
        headers: CMA_DOC_HEADERS,
      }
    }
  }

  // Live immersive from render_args first (admin Open report + public /cma).
  // Tip Ready letter fixes (C1/C4/C9) land without a Falcon html_content rebuild.
  // Market hydrate stays false (D27 freeze). Map rebuild is fail-open + local.
  if (!wantsPrint) {
    const source = await getCmaRenderSourceBySlug(safeSlug)
    if (source) {
      const immersive = await immersiveFromRow(source, origin, false, safeSlug)
      if (immersive) {
        return { kind: 'html', status: 200, html: withTracker(immersive), headers: CMA_DOC_HEADERS }
      }
    }
  }

  // Fallback: frozen stored HTML (print path, legacy rows, immersive render miss).
  const stored = await getCmaStoredHtmlBySlug(safeSlug)
  if (stored) return storedHtmlResult(stored, origin)

  if (head.html_path?.startsWith('public/cmas/')) {
    return { kind: 'redirect', url: head.html_path.replace(/^public/, ''), status: 302 }
  }

  return {
    kind: 'json',
    status: 404,
    body: { error: 'This CMA has no stored document yet. Build it from /admin/cmas.' },
  }
}

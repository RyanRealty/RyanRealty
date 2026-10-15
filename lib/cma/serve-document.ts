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
import { applyPreparedLinesToStoredHtml } from '@/lib/cma/letter-privacy'
import { loadCmaMapTile } from '@/lib/cma/map-tile-cache'
import { applyCompVerdicts, verdictsFromBuildSummary } from '@/lib/cma/client-facing'
import { canBrokerReviewCma, isCmaClientReady } from '@/lib/cma/draft-access'
import { hydrateCmaMarketArea } from '@/lib/cma/market-area-hydrate'
import { likeHomeCreditsForDocument } from '@/lib/cma/like-home-credits-load'
import { listingMarketForDocument } from '@/lib/cma/listing-window-load'
import type { RenderCmaArgs } from '@/lib/cma/render'
import type { CmaBroker } from '@/lib/cma/types'
import { GOOGLE_COMMS_COOKIE, hasGoogleCommsConsentRecorded } from '@/lib/auth/google-comms-consent'
import { renderConsentBarHtml } from '@/lib/cma/register-gate'
import { SMS_CONSENT_TEXT } from '@/lib/crm/sms-consent-text'
import type { CmaRenderSource } from '@/lib/data/cma/documents'
import { adminReviewBannerHtml, injectAdminReviewBanner } from '@/lib/cma/review-banner'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { IDENTITY_LINK_PARAM, verifyPersonLinkToken } from '@/lib/identity/link-token'
import { PERSON_COOKIE, verifiedPersonIdFromCookie } from '@/lib/identity/person-cookie'

/**
 * The recipient a request PROVES it is: the signed `?_pid=` token on the link we
 * sent, or the VERIFIED rr_pid cookie that link set (P7 identity loop,
 * 2026-09-23; provenance 2026-10-14). A bare id identifies nobody: CMA slugs are
 * street addresses and person ids are sequential, so an unsigned id let anyone
 * open a client's private valuation. A claimed cookie (a browser known only from
 * an email someone typed into a form) proves nothing either: anyone can type
 * anyone's email, and the bar this decides records SMS and email consent.
 */
function recipientFromParam(v: string | null | undefined): number | null {
  return verifyPersonLinkToken(v)?.personId ?? null
}

/** Optional live reads (market, credits, broker, links). Past this, render what is already stored. */
const CMA_READ_MS = 4_000
/**
 * The comps map is not one of those optional reads (rule 31, 2745 Aldrich).
 * A cold boundary walk plus the tile can take longer than 4 seconds. The
 * clock starts with the broker read, not after it.
 */
export const CMA_MAP_MS = 12_000
/**
 * Backstop around the whole immersive render. The map budget overlaps the
 * broker read, so this only has to outlast the slower of the two, plus the
 * render. It must not fire while the map is still drawing.
 */
export const CMA_IMMERSIVE_MS = 20_000

const CMA_RENDER_UNAVAILABLE_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><title>Report</title></head><body><p>This report exists, but it did not finish rendering. Refresh to try again.</p></body></html>'

export const CMA_DOC_HEADERS = {
  'Content-Type': 'text/html',
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'private, no-store',
  'X-Frame-Options': 'SAMEORIGIN',
  // The slug is the subject's street address: a link out sends only the origin
  // as the referrer (next.config.ts sets the same; Matt 2026-10-14).
  'Referrer-Policy': 'strict-origin',
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
    const stored = row.render_args as unknown as RenderCmaArgs
    const comps = applyCompVerdicts(stored.comps ?? [], verdictsFromBuildSummary(row.build_summary))
    const brokerLookupSlug = row.broker_slug ?? 'matthew-ryan'
    // Broker feeds the signature block and docLinks.slug only. Map / market /
    // credits do not wait on it. docLinks uses the same slug the broker object
    // would: brokerRow.slug, else the row slug. Chain that lookup after the
    // broker read inside its own promise so a different brokers.slug still
    // matches, without serializing map/market/credits behind the broker.
    const brokerPromise = withTimeoutFallback(
      getCmaBrokerBySlugOrEmail({ slug: brokerLookupSlug }),
      null,
      CMA_READ_MS,
      'cma.broker',
    )
    // C9: render_args omits mapDataUri (~300KB). Rebuild the comps pin map
    // here so Open report / immersive shows subject + numbered sales once.
    // The overlay travels with the tile: it is the centre, zoom and pin
    // coordinates the tile was actually drawn at, and without it chapter 3's
    // map is a bitmap that cannot answer a tap (tasteReview item 2).
    // Rule 31: this clock starts now, beside the broker read, on its own budget.
    const mapPromise = stored.mapDataUri
      ? Promise.resolve({ dataUri: stored.mapDataUri as string, overlay: null })
      : withTimeoutFallback(
          loadCmaMapTile({
            slug: slug ?? 'cma',
            subject: stored.subject,
            comps,
            // The signed letter's competition and unsold pins need the status
            // here or a delivered row is re-filtered and the pins disagree
            // with the tables (Matt 2026-10-09, rule 32).
            args: { ...stored, documentStatus: row.status },
          }),
          { dataUri: null, overlay: null },
          CMA_MAP_MS,
          'cma.map',
        )
    const docLinksPromise = slug
      ? brokerPromise.then((brokerRow) =>
          withTimeoutFallback(
            resolveDocLinkCtx(slug, (brokerRow?.slug as string) ?? brokerLookupSlug),
            null,
            CMA_READ_MS,
            'cma.docLinks',
          ),
        )
      : Promise.resolve(null)
    // Budget is this serve path only. Print / PDF call the same loaders with
    // no budget, so a slow read still lands in the letter instead of being dropped.
    const [brokerRow, mapBits, listingMarket, likeHomeCredits, docLinks] = await Promise.all([
      brokerPromise,
      mapPromise,
      listingMarketForDocument(stored, row.status, CMA_READ_MS),
      likeHomeCreditsForDocument({ ...stored, comps }, row.status, CMA_READ_MS),
      docLinksPromise,
    ])
    const broker: CmaBroker = {
      id: (brokerRow?.id as string) ?? null,
      slug: (brokerRow?.slug as string) ?? brokerLookupSlug,
      displayName: (brokerRow?.display_name as string) || 'Matt Ryan',
      title: (brokerRow?.title as string) || 'Owner & Principal Broker',
      licenseNumber: (brokerRow?.license_number as string | null) ?? null,
      email: (brokerRow?.email as string | null) ?? null,
      phone: (brokerRow?.twilio_number as string | null) ?? null,
      photoUrl: (brokerRow?.photo_url as string | null) ?? null,
    }
    const base = {
      ...stored,
      comps,
      broker,
      mapDataUri: mapBits.dataUri,
      mapOverlay: mapBits.overlay,
      subjectMapDataUri: null,
      // Identity for every tracked link in the document. Resolved here rather
      // than at build: it belongs to the delivery, not to the stored figures.
      docLinks,
      // Finalized/delivered owner docs never print the draft review band.
      documentStatus: row.status,
    }
    const hydrated = hydrateArea
      ? await hydrateCmaMarketArea({ ...base, listingMarket, likeHomeCredits })
      : { ...base, listingMarket, likeHomeCredits }
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

function storedHtmlResult(html: string, origin: string, extra = '', street?: string | null): CmaServeResult {
  let out = applyPreparedLinesToStoredHtml(html, {
    streetAddress: street,
    brokerName: 'Matt Ryan',
  })
  out = out.replace(/https?:\/\/[^'")\s]+(\/fonts\/[^'")\s]+)/g, `${origin}$1`)
  out = withTracker(out, `<script src="/rr-cma-doc.js" defer></script>${extra}`)
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

type ServeCmaInner = {
  result: CmaServeResult
  /** True when this path already loaded (or attempted) the render-args row. */
  renderSourceHeld: boolean
  renderSource: CmaRenderSource | null
}

function served(result: CmaServeResult): ServeCmaInner {
  return { result, renderSourceHeld: false, renderSource: null }
}

function servedWithSource(result: CmaServeResult, renderSource: CmaRenderSource | null): ServeCmaInner {
  return { result, renderSourceHeld: true, renderSource }
}

export async function serveCmaDocument(opts: CmaServeOpts): Promise<CmaServeResult> {
  const inner = await serveCmaDocumentResult(opts)
  if (!opts.adminReview || inner.result.kind !== 'html') return inner.result
  // Review gate reads pricing off render_args. Reuse the row the immersive
  // path already loaded. Print (and stored when that read never ran) fall
  // back to a capped extra read. A timeout must not blank the tab.
  const source = inner.renderSourceHeld
    ? inner.renderSource
    : await withTimeoutFallback(
        getCmaRenderSourceBySlug(opts.slug.trim().toLowerCase()),
        null,
        CMA_READ_MS,
        'cma.reviewBanner',
      )
  const pricing = (source?.render_args as { pricing?: unknown } | null)?.pricing ?? null
  const banner = adminReviewBannerHtml(pricing)
  return banner ? { ...inner.result, html: injectAdminReviewBanner(inner.result.html, banner) } : inner.result
}

/** Stored letter, else a legacy file, else a visible error. Never "CMA not found" — the head row exists. */
async function storedOrUnavailable(
  safeSlug: string,
  origin: string,
  consentBar: string,
  htmlPath: string | null,
): Promise<CmaServeResult> {
  const stored = await withTimeoutFallback(getCmaStoredHtmlBySlug(safeSlug), null, CMA_READ_MS, 'cma.storedHtml')
  if (stored) return storedHtmlResult(stored, origin, consentBar)
  if (htmlPath?.startsWith('public/cmas/')) {
    return { kind: 'redirect', url: htmlPath.replace(/^public/, ''), status: 302 }
  }
  return { kind: 'html', status: 200, html: CMA_RENDER_UNAVAILABLE_HTML, headers: CMA_DOC_HEADERS }
}

async function serveCmaDocumentResult(opts: CmaServeOpts): Promise<ServeCmaInner> {
  const safeSlug = opts.slug.trim().toLowerCase()
  if (!/^[a-z0-9-]{3,80}$/.test(safeSlug)) {
    return served({ kind: 'json', status: 400, body: { error: 'Invalid slug' } })
  }

  const headRead = await withTimeoutFallbackResult(
    getCmaServeHead(safeSlug),
    null,
    CMA_READ_MS,
    'cma.serveHead',
  )
  // Timeout or throw is not "missing": the slug may be real. Never 404 "CMA
  // not found" and never hang. A real null head is still 404.
  if (!headRead.ok) {
    return servedWithSource(
      { kind: 'html', status: 200, html: CMA_RENDER_UNAVAILABLE_HTML, headers: CMA_DOC_HEADERS },
      null,
    )
  }
  const head = headRead.value
  if (!head) return served({ kind: 'json', status: 404, body: { error: 'CMA not found' } })

  if (!canBrokerReviewCma({ isAdmin: opts.isAdmin, status: head.status })) {
    return served({ kind: 'json', status: 404, body: { error: 'CMA not found' } })
  }

  const origin = new URL(opts.requestUrl).origin
  const wantsPrint = new URL(opts.requestUrl).searchParams.has('print')
  const publicReady = isCmaClientReady(head.status)

  // NO SIGN-IN TO VIEW (Matt 2026-10-07): a client-ready report opens for
  // anyone with the link. The only thing identity still decides is the
  // consent bar: the recipient who came in on the tracked link (`?_pid=`
  // token, or the verified rr_pid cookie it set) and has not answered the ask
  // gets an optional bar inside the report. Everyone else gets no bar,
  // including a browser whose cookie is only claimed (consent integrity,
  // 2026-10-14): /api/cma/register would refuse its answer anyway. A bar shown
  // for the link carries the link's token, so its answer is accepted whether or
  // not a cookie was set.
  let consentBar = ''
  if (publicReady && !opts.isAdmin && !opts.skipRegisterGate) {
    const identity = await getCmaAccessIdentity(safeSlug)
    const jar = await cookies()
    const commsCookie = jar.get(GOOGLE_COMMS_COOKIE)?.value
    const linkToken = new URL(opts.requestUrl).searchParams.get(IDENTITY_LINK_PARAM)
    const linkPersonId = recipientFromParam(linkToken)
    const recipientPersonId = linkPersonId ?? verifiedPersonIdFromCookie(jar.get(PERSON_COOKIE)?.value)
    if (
      identity?.personId &&
      recipientPersonId === identity.personId &&
      !identity.consentRecorded &&
      !hasGoogleCommsConsentRecorded(commsCookie)
    ) {
      consentBar = renderConsentBarHtml({
        slug: safeSlug,
        personId: identity.personId,
        address: identity.subjectAddress ?? null,
        smsConsentText: SMS_CONSENT_TEXT,
        // The link the recipient proved themselves with rides in the form, so
        // the POST can accept the answer without a cookie.
        proof: linkPersonId === identity.personId ? linkToken : null,
      })
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
      return served({
        kind: 'html',
        status: 200,
        html: withTracker(letter.html, '<script src="/rr-cma-doc.js" defer></script>'),
        headers: CMA_DOC_HEADERS,
      })
    }
  }

  // Live immersive from render_args first (admin Open report + public /cma).
  // Tip Ready letter fixes (C1/C4/C9) land without a Falcon html_content rebuild.
  // Market hydrate stays false (D27 freeze). Map rebuild is fail-open + local.
  let heldSource: CmaRenderSource | null | undefined
  if (!wantsPrint) {
    const sourceRead = await withTimeoutFallbackResult(
      getCmaRenderSourceBySlug(safeSlug),
      null,
      CMA_READ_MS,
      'cma.renderSource',
    )
    if (!sourceRead.ok) {
      return servedWithSource(await storedOrUnavailable(safeSlug, origin, consentBar, head.html_path), null)
    }
    heldSource = sourceRead.value
    if (sourceRead.value) {
      const rendered = await withTimeoutFallbackResult(
        immersiveFromRow(sourceRead.value, origin, false, safeSlug),
        null,
        CMA_IMMERSIVE_MS,
        'cma.immersive',
      )
      if (rendered.ok && rendered.value) {
        return servedWithSource(
          { kind: 'html', status: 200, html: withTracker(rendered.value, consentBar), headers: CMA_DOC_HEADERS },
          sourceRead.value,
        )
      }
      // A hang is not "no document" and not "CMA not found" — the row was found above.
      if (!rendered.ok) {
        return servedWithSource(
          await storedOrUnavailable(safeSlug, origin, consentBar, head.html_path),
          sourceRead.value,
        )
      }
    }
  }

  // Fallback: frozen stored HTML (print path, legacy rows, immersive render miss).
  const storedRead = await withTimeoutFallbackResult(
    getCmaStoredHtmlBySlug(safeSlug),
    null,
    CMA_READ_MS,
    'cma.storedHtml',
  )
  const wrapStored = (result: CmaServeResult): ServeCmaInner =>
    heldSource !== undefined ? servedWithSource(result, heldSource) : served(result)
  if (!storedRead.ok) {
    if (head.html_path?.startsWith('public/cmas/')) {
      return wrapStored({ kind: 'redirect', url: head.html_path.replace(/^public/, ''), status: 302 })
    }
    return wrapStored({ kind: 'html', status: 200, html: CMA_RENDER_UNAVAILABLE_HTML, headers: CMA_DOC_HEADERS })
  }
  const stored = storedRead.value
  if (stored) return wrapStored(storedHtmlResult(stored, origin, consentBar))

  if (head.html_path?.startsWith('public/cmas/')) {
    return wrapStored({ kind: 'redirect', url: head.html_path.replace(/^public/, ''), status: 302 })
  }

  return wrapStored({
    kind: 'json',
    status: 404,
    body: { error: 'This CMA has no stored document yet. Build it from /admin/cmas.' },
  })
}

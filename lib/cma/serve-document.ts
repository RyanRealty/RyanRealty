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
import { applyCompVerdicts, verdictsFromBuildSummary } from '@/lib/cma/client-facing'
import { canBrokerReviewCma, isCmaClientReady, cmaHasStoredHtml } from '@/lib/cma/draft-access'
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

async function immersiveFromRow(
  row: CmaRenderSource,
  origin: string,
  hydrateArea: boolean,
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
    const hydrated = hydrateArea
      ? await hydrateCmaMarketArea({ ...stored, comps, broker })
      : { ...stored, comps, broker }
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

export async function serveCmaDocument(opts: {
  slug: string
  requestUrl: string
  isAdmin: boolean
  viewerEmail: string | null
  skipRegisterGate?: boolean
}): Promise<CmaServeResult> {
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

  // Broker review: stored HTML, not a live immersive rebuild (that path is 45–60s).
  if (opts.isAdmin && !wantsPrint && cmaHasStoredHtml(head.html_path)) {
    const stored = await getCmaStoredHtmlBySlug(safeSlug)
    if (stored) return storedHtmlResult(stored, origin)
  }

  if (!wantsPrint && !opts.isAdmin) {
    const source = await getCmaRenderSourceBySlug(safeSlug)
    if (source) {
      const immersive = await immersiveFromRow(source, origin, false)
      if (immersive) {
        return { kind: 'html', status: 200, html: withTracker(immersive), headers: CMA_DOC_HEADERS }
      }
    }
  }

  if (opts.isAdmin && !wantsPrint) {
    const source = await getCmaRenderSourceBySlug(safeSlug)
    if (source) {
      const immersive = await immersiveFromRow(source, origin, false)
      if (immersive) {
        return { kind: 'html', status: 200, html: withTracker(immersive), headers: CMA_DOC_HEADERS }
      }
    }
  }

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

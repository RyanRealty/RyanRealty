/**
 * POST /api/cma/[slug]/finalize-deliver
 *
 * Admin / cron trigger that fires the CMA delivery pipeline for a finalized CMA:
 *   1. Renders the CMA HTML to PDF via renderCmaPdfBuffer.
 *   2. Creates a Gmail DRAFT in the signing broker's mailbox (lead addressed,
 *      PDF attached, FUB BCC'd) so the broker reviews + sends personally.
 *   3. Sends Matt a Resend notification that the CMA is ready, with a link to
 *      the PDF and the recommended list price.
 *
 * Falls back gracefully to Resend → broker if the Gmail DWD scope is
 * unavailable, and reports `fellBackToResend: true` in the response so the
 * caller knows the lead hasn't been auto-emailed.
 *
 * The CMA HTML must exist at `public/cmas/<slug>/cma.html` before calling
 * this route — move the draft from `public/drafts/` first (Step 14 of the
 * CMA producer skill). The PDF renderer also accepts `public/drafts/` but
 * logs a warning.
 *
 * Auth:
 *   - Admin Supabase session cookie (same as /api/admin/run-producer), OR
 *   - Authorization: Bearer <CRON_SECRET> header (same as cron routes)
 *
 * Body (all optional — defaults pulled from public.cmas):
 *   { leadEmail?: string, leadName?: string, brokerSlug?: string }
 *
 * Returns:
 *   { ok, slug, gmailDraftId|null, fellBackToResend, mattNotified, pdfBytes, warnings? }
 *
 * Locked 2026-06-04.
 */

import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { finalizeAndDeliverCma } from '@/lib/cma-deliver'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Puppeteer render + Gmail API + Resend: generous headroom within Vercel's 300s ceiling. */
export const maxDuration = 120

interface RouteBody {
  leadEmail?: string
  leadName?: string
  brokerSlug?: string
}

function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) {
    // In production, require a secret; in dev, allow unauthenticated.
    return !isProd
  }
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

async function isAdminAuthorized(): Promise<boolean> {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) return false
    const role = await getAdminRoleForEmail(user.email)
    return !!role
  } catch {
    return false
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  // Accept either a cron-secret Bearer token OR an admin session cookie.
  const cronOk = isCronAuthorized(request)
  const adminOk = cronOk ? false : await isAdminAuthorized()
  if (!cronOk && !adminOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await context.params
  const safeSlug = String(slug ?? '').trim().toLowerCase()
  if (!/^[a-z0-9-]+$/.test(safeSlug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  let body: RouteBody = {}
  try {
    body = (await request.json()) as RouteBody
  } catch {
    // empty body is fine — all fields are optional
  }

  const result = await finalizeAndDeliverCma({
    slug: safeSlug,
    leadEmail: body.leadEmail?.trim() || undefined,
    leadName: body.leadName?.trim() || undefined,
    brokerSlug: body.brokerSlug?.trim() || undefined,
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        slug: safeSlug,
        error: result.error,
        warnings: result.warnings ?? [],
      },
      {
        // 422 for missing lead email / HTML not found; 500 for PDF render failure.
        status:
          result.error?.includes('not found') || result.error?.includes('No lead email')
            ? 422
            : 500,
      },
    )
  }

  return NextResponse.json({
    ok: true,
    slug: safeSlug,
    gmail_draft_id: result.gmailDraftId ?? null,
    fell_back_to_resend: result.fellBackToResend ?? false,
    matt_notified: result.mattNotified ?? false,
    pdf_bytes: result.pdfBytes ?? null,
    warnings: result.warnings ?? [],
  })
}

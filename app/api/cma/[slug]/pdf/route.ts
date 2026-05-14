import { NextResponse } from 'next/server'
import { renderCmaPdfBuffer, CmaNotFoundError } from '@/lib/cma-pdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/** Hard cap on the rendered PDF so it can be used as an email attachment
 *  (Gmail allows 25 MB inline; Resend allows 40 MB; we target the strictest
 *  limit so the deliverable works in every channel). If the render exceeds
 *  this, the route returns an error — see the CMA skill for image-size
 *  guidance to stay under it. */
const MAX_PDF_BYTES = 25 * 1024 * 1024

/**
 * GET /api/cma/[slug]/pdf
 *
 * Renders the CMA HTML to a print-ready PDF and streams it back.
 *
 * Query params:
 *   - download=1  → force-download instead of inline preview
 *   - info=1      → return JSON metadata only (size, slug, finalized) without
 *                   the binary body. Useful for size-checks from clients that
 *                   can't handle big responses.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params
  const safeSlug = String(slug ?? '').trim().toLowerCase()
  if (!/^[a-z0-9-]+$/.test(safeSlug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const download = searchParams.get('download') === '1'
  const info = searchParams.get('info') === '1'

  try {
    const { buffer, finalized } = await renderCmaPdfBuffer(safeSlug)

    if (buffer.byteLength > MAX_PDF_BYTES) {
      return NextResponse.json(
        {
          error: 'PDF exceeds 25 MB email-attachment cap',
          bytes: buffer.byteLength,
          megabytes: +(buffer.byteLength / 1024 / 1024).toFixed(2),
          max_bytes: MAX_PDF_BYTES,
          remedy:
            'Reduce hero image size (currently 1280×960) or thumbnail size (currently 800×600) in the CMA HTML. ' +
            'Spark CDN serves 320×240 / 640×480 / 800×600 / 1024×768 / 1280×960 / 1600×1200 variants — drop one tier.',
        },
        { status: 413 }
      )
    }

    if (info) {
      return NextResponse.json({
        slug: safeSlug,
        finalized,
        bytes: buffer.byteLength,
        megabytes: +(buffer.byteLength / 1024 / 1024).toFixed(2),
        under_attachment_cap: buffer.byteLength <= MAX_PDF_BYTES,
        cap_bytes: MAX_PDF_BYTES,
      })
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${safeSlug}.pdf"`,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'public, max-age=600, s-maxage=600',
      },
    })
  } catch (err) {
    if (err instanceof CmaNotFoundError) {
      return NextResponse.json({ error: err.message, looked_at: err.looked_at }, { status: 404 })
    }
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'PDF render failed', detail: msg.slice(0, 500) }, { status: 500 })
  }
}

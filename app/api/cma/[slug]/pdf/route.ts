import { NextResponse } from 'next/server'
import { renderCmaPdfBuffer, CmaNotFoundError } from '@/lib/cma-pdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * GET /api/cma/[slug]/pdf
 *
 * Renders the CMA HTML for a slug to a print-ready PDF and streams it back.
 * Append `?download=1` to force-download instead of inline preview.
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

  try {
    const { buffer } = await renderCmaPdfBuffer(safeSlug)
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${safeSlug}.pdf"`,
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

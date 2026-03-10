import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

/**
 * On-demand revalidation. Used by Inngest (e.g. seo/regenerate-sitemap) to refresh sitemap after sync.
 * GET /api/revalidate?secret=...&path=/sitemap.xml
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const path = searchParams.get('path') ?? '/sitemap.xml'

  const expected = process.env.REVALIDATE_SECRET ?? process.env.INNGEST_SIGNING_KEY
  if (!expected?.trim() || secret !== expected) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  if (path !== '/sitemap.xml' && path !== '/sitemap') {
    return NextResponse.json({ error: 'path must be /sitemap.xml or /sitemap' }, { status: 400 })
  }

  revalidatePath('/sitemap.xml')
  return NextResponse.json({ revalidated: true, path: '/sitemap.xml' })
}

import { NextResponse } from 'next/server'
import { getIndexableSubdivisions } from '@/lib/data/subdivisions/getIndexableSubdivisions'
import { subdivisionLlmsLines } from '@/lib/data/subdivisions/subdivision-index'
import { BRAND } from '@/lib/brand/contact'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const revalidate = 3600

/**
 * /llms-subdivisions.txt — the secondary AI-crawler map: one line per recorded
 * subdivision page (AEO-4, visibility audit 2026-09-22).
 *
 * These 2,642 lines (live count 2026-09-23) used to sit in the middle of
 * /llms.txt and made up 91% of its links, ahead of the guides, blog, tools and
 * brokerage sections. /llms.txt now links here under "## Optional", the
 * section the llms.txt convention reserves for secondary links. The list is
 * the SAME set app/sitemap.ts submits (getIndexableSubdivisions), built by the
 * same line builder, so the Google map and the AI map still cannot disagree
 * (lib/data/subdivisions/subdivision-index.test.ts pins that parity).
 */
export async function GET() {
  const subdivisions = await getIndexableSubdivisions()
  const lines = subdivisionLlmsLines(subdivisions, SITE_URL)
  const body = `# ${BRAND.name}: Central Oregon subdivisions

> Every recorded Central Oregon subdivision with its own page on ${BRAND.domain}: the homes for sale inside its recorded boundary, its sales history, and where it sits. The main index is ${SITE_URL}/llms.txt.

## Subdivisions${lines.length ? `\n${lines.join('\n')}` : ''}
`
  return new NextResponse(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600',
    },
  })
}

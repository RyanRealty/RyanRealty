import { NextResponse } from 'next/server'
import { getCachedCMA, computeCMA } from '@/lib/cma'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rl = await checkRateLimit(request, 'strict')
  if (rl.limited) return rl.response

  const { slug } = await params
  const identifier = slug?.trim()
  if (!identifier) {
    return NextResponse.json({ error: 'Missing identifier' }, { status: 400 })
  }
  let result = await getCachedCMA(identifier)
  if (!result) {
    result = await computeCMA(identifier)
  }
  if (!result) {
    return NextResponse.json({ error: 'No valuation available' }, { status: 404 })
  }
  return NextResponse.json(result)
}

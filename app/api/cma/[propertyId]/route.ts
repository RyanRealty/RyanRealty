import { NextResponse } from 'next/server'
import { getCachedCMA, computeCMA } from '@/lib/cma'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const rl = await checkRateLimit(request, 'strict')
  if (rl.limited) return rl.response

  const { propertyId } = await params
  if (!propertyId?.trim()) {
    return NextResponse.json({ error: 'Missing propertyId' }, { status: 400 })
  }
  let result = await getCachedCMA(propertyId)
  if (!result) {
    result = await computeCMA(propertyId)
  }
  if (!result) {
    return NextResponse.json({ error: 'No valuation available' }, { status: 404 })
  }
  return NextResponse.json(result)
}

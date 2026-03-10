import { NextResponse } from 'next/server'
import { getCachedCMA, computeCMA } from '@/lib/cma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ propertyId: string }> }
) {
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

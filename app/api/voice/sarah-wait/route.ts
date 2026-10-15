import { NextResponse } from 'next/server'
import { silentWaitTwiml } from '@/lib/voice/sarah-conference'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  return new NextResponse(silentWaitTwiml(), { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

export async function GET() {
  return POST()
}

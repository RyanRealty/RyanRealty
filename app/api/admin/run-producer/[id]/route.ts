/**
 * POST /api/admin/run-producer/[id]
 *
 * Producer runtime retired 2026-08-18. Cloud no longer loads SKILL.md.
 */
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Producer runtime retired. File the job; do not execute SKILL.md from the cloud.' },
    { status: 410 },
  )
}

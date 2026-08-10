/**
 * GET /api/cron/snapshot-active-inventory
 * H8: write durable active inventory counts by CO city for as_of = today (UTC).
 */
import { NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { requireCronAuth } from '@/lib/auth/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

function runSnapshot(): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const script = join(process.cwd(), 'scripts/analytics/snapshot-active-inventory.mjs')
    const child = spawn(process.execPath, [script, '--json'], {
      env: process.env,
      cwd: process.cwd(),
    })
    let out = ''
    child.stdout?.on('data', (d) => {
      out += String(d)
    })
    child.stderr?.on('data', (d) => {
      out += String(d)
    })
    child.on('close', (code) => resolve({ code: code ?? 1, out: out.slice(-4000) }))
  })
}

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const start = Date.now()
  try {
    const result = await runSnapshot()
    return NextResponse.json({
      ok: result.code === 0,
      duration_ms: Date.now() - start,
      log_tail: result.out,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

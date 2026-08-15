/**
 * GET /api/cron/rebuild-analytics-marts-full
 * Weekly full rebuild of CO closed-sales annual marts from 1998.
 * Nightly last-2-years stays on /api/cron/rebuild-analytics-marts.
 */
import { NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { assertMartFloorYear, MART_FLOOR_YEAR } from '@/lib/data/analytics/getCoMarketAnnual'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 800

function runRebuild(from: number, to: number): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const script = join(process.cwd(), 'scripts/analytics/rebuild-analytics-marts.mjs')
    const child = spawn(process.execPath, [script, '--from', String(from), '--to', String(to)], {
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

  const y = new Date().getUTCFullYear()
  const start = Date.now()
  try {
    const result = await runRebuild(MART_FLOOR_YEAR, y)
    const floor = await assertMartFloorYear()
    const ok = result.code === 0 && floor.ok
    return NextResponse.json(
      {
        ok,
        years: [MART_FLOOR_YEAR, y],
        duration_ms: Date.now() - start,
        floor,
        log_tail: result.out,
      },
      { status: ok ? 200 : 500 },
    )
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

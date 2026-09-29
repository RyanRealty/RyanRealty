/**
 * The drip route's time limit is part of the drip's correctness, not tuning.
 *
 * 2026-09-29 22:54 UTC: at maxDuration 60 the first real drip send (a whole
 * CMA send: MLS check, CRM lead, claim, Chromium PDF, ~7 MB Gmail message)
 * timed out mid-send and left its owner stuck in 'sending'. The busy window and
 * the stuck-send threshold are both derived from DRIP_ROUTE_MAX_DURATION_S, so
 * the literal Next reads, the constant, and every other function that can take
 * an email claim must agree. These pins fail the build if any of them drifts.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const drain = vi.hoisted(() => vi.fn())
vi.mock('@/lib/data/prospecting/drip-drain', () => ({
  drainProspectingFirstTouchDrip: (...a: unknown[]) => drain(...a),
}))

import { GET, maxDuration } from './route'
import { DRIP_ROUTE_MAX_DURATION_S } from '@/lib/data/prospecting/drip-schedule'

const ROUTE_SRC = readFileSync(join(process.cwd(), 'app/api/cron/prospecting-first-touch-drip/route.ts'), 'utf8')

/** The literal `export const maxDuration = N` of a route or page, or null. */
function declaredMaxDuration(relPath: string): number | null {
  const src = readFileSync(join(process.cwd(), relPath), 'utf8')
  const m = /^export const maxDuration = (\d+)\s*$/m.exec(src)
  return m ? Number(m[1]) : null
}

describe('prospecting-first-touch-drip maxDuration', () => {
  it('is 300 seconds, the limit every CMA send path runs under, and never back to 60', () => {
    expect(maxDuration).toBe(300)
    expect(maxDuration).not.toBe(60)
    expect(maxDuration).toBe(DRIP_ROUTE_MAX_DURATION_S)
  })

  it('is a plain numeric literal, so Next can read it statically', () => {
    expect(ROUTE_SRC).toMatch(/^export const maxDuration = 300$/m)
    expect(declaredMaxDuration('app/api/cron/prospecting-first-touch-drip/route.ts')).toBe(DRIP_ROUTE_MAX_DURATION_S)
  })

  it('is at least as long as every other function that can hold an owner email claim', () => {
    // A claim is taken by sendProspectingEmailIntro (the drip, the prospect
    // page's dialog) and by sendCmaToLead itself (lib/cma/prospect-send-claim.ts)
    // from every page or route that reaches it. If any of them ran longer than
    // the drip route, a live send there could look stuck to the drip's recovery
    // and be released under it. next.config.ts lists every send-reaching entry
    // in PDF_SEND_TRACE_ROUTES (ci:pdf-trace-guard fails if one is missing),
    // plus the BPO page, the guard's one known exception.
    const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')
    const block = /const PDF_SEND_TRACE_ROUTES = \[([\s\S]*?)\] as const/.exec(config)?.[1] ?? ''
    const keys = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]!.replace(/\\\\([[\]])/g, '$1'))
    keys.push('app/admin/(protected)/bpo/page')
    expect(keys).toContain('app/api/cron/prospecting-first-touch-drip/route')
    expect(keys).toContain('app/admin/(protected)/prospecting/[kind]/[id]/page')
    expect(keys.length).toBeGreaterThanOrEqual(10)

    const limits: Record<string, number | null> = {}
    for (const key of keys) {
      const file = existsSync(join(process.cwd(), `${key}.tsx`)) ? `${key}.tsx` : `${key}.ts`
      expect(existsSync(join(process.cwd(), file)), `${file} exists`).toBe(true)
      limits[file] = declaredMaxDuration(file)
    }
    // An entry without its own export runs at the project default, which is
    // Fluid compute's 300 s (resourceConfig.fluid is pinned by ci:vercel-config).
    for (const [file, limit] of Object.entries(limits)) {
      expect(limit ?? 300, file).toBeLessThanOrEqual(DRIP_ROUTE_MAX_DURATION_S)
    }
    // The manual email intro runs inside this page's function.
    expect(limits['app/admin/(protected)/prospecting/[kind]/[id]/page.tsx']).toBe(300)
  })
})

describe('GET /api/cron/prospecting-first-touch-drip', () => {
  beforeEach(() => {
    drain.mockReset()
    vi.stubEnv('CRON_SECRET', 'drip-route-test-secret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('refuses without the cron secret and never drains', async () => {
    const res = await GET(new Request('https://ryan-realty.com/api/cron/prospecting-first-touch-drip'))
    expect(res.status).toBe(401)
    expect(drain).not.toHaveBeenCalled()
  })

  it('returns the drain result, including a busy stand-down', async () => {
    drain.mockResolvedValue({ ok: true, action: 'busy', reason: 'in-flight', kind: 'expired', id: 'LK1', claimAt: 'c' })
    const res = await GET(
      new Request('https://ryan-realty.com/api/cron/prospecting-first-touch-drip', {
        headers: { authorization: 'Bearer drip-route-test-secret' },
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, action: 'busy', reason: 'in-flight', kind: 'expired', id: 'LK1' })
    expect(drain).toHaveBeenCalledTimes(1)
  })
})

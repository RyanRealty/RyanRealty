/**
 * Kick the CMA build worker for one slug the moment a request lands.
 *
 * The worker cron runs at :14 and :44 (vercel.json), so a seller-LP request
 * could wait 29 minutes for its draft; Matt 2026-09-09: "kick on intake".
 * One authenticated GET to the worker route for exactly this slug, scheduled
 * with `after()` so the request that created the draft returns first; the
 * cron stays as the sweep, so a kick that never lands costs nothing but time.
 * Fail-open: nothing here can fail the intake.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export function cmaBuildKickRequest(slug: string): { url: string; headers: Record<string, string> } | null {
  const secret = process.env.CRON_SECRET
  const safe = slug.trim().toLowerCase()
  if (!secret || !/^[a-z0-9-]{3,80}$/.test(safe)) return null
  return {
    url: `${SITE_URL}/api/cron/cma-build-worker?slug=${encodeURIComponent(safe)}&limit=1`,
    headers: { Authorization: `Bearer ${secret}` },
  }
}

async function fire(slug: string): Promise<void> {
  const req = cmaBuildKickRequest(slug)
  if (!req) return
  try {
    const res = await fetch(req.url, { headers: req.headers, cache: 'no-store' })
    if (!res.ok) console.warn('[cma-kick]', slug, 'worker answered', res.status)
  } catch (e) {
    console.warn('[cma-kick]', slug, e instanceof Error ? e.message : String(e))
  }
}

export async function kickCmaBuild(slug: string): Promise<void> {
  // The int suites create real intake rows against production; a kick there
  // would start production builds of zztest addresses mid-test.
  if (process.env.VITEST) return
  try {
    const { after } = await import('next/server')
    after(() => fire(slug))
  } catch {
    // Outside a request scope (a cron, a script): fire without waiting.
    void fire(slug)
  }
}

/**
 * Buyers-guide regeneration status cron — weekly Sunday 3am PT (10am UTC).
 *
 * Reports freshness of every per-community guide PDF under
 * `public/guides/<slug>/`. Returns the set of guides with a stale or
 * missing manifest so an operator (or a separate worker) can regenerate
 * them.
 *
 * Why this isn't a full Puppeteer regenerator in this route:
 * Vercel serverless functions don't ship with a Chromium binary, and
 * spawning `node scripts/buyers-guide/generate-pdf.mjs` from inside a
 * serverless function makes Turbopack try to statically resolve the
 * script path as a module (it can't), which fails the build. Real
 * regeneration runs out-of-band via `npm run buyers-guide:regen <slug>`
 * locally or in a dedicated worker. This cron's job is to surface what
 * needs attention, not to do the work.
 *
 * Auth: Authorization: Bearer $CRON_SECRET.
 *
 * Spec: marketing_brain_skills/producers/buyers-guide/SKILL.md §4.3
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

type ManifestLite = { generatedAt?: string; slug?: string }

async function listGuideCommunities(): Promise<
  Array<{ slug: string; manifest: ManifestLite | null }>
> {
  const guidesDir = path.join(process.cwd(), 'public', 'guides')
  let entries: string[]
  try {
    const dirents = await readdir(guidesDir, { withFileTypes: true })
    entries = dirents.filter((d) => d.isDirectory()).map((d) => d.name)
  } catch {
    return []
  }

  const out: Array<{ slug: string; manifest: ManifestLite | null }> = []
  for (const slug of entries) {
    const manifestPath = path.join(guidesDir, slug, 'manifest.json')
    let manifest: ManifestLite | null = null
    try {
      const raw = await readFile(manifestPath, 'utf8')
      manifest = JSON.parse(raw) as ManifestLite
    } catch {
      manifest = null
    }
    out.push({ slug, manifest })
  }
  return out
}

function isStale(manifest: ManifestLite | null): boolean {
  if (!manifest?.generatedAt) return true
  const generatedMs = Date.parse(manifest.generatedAt)
  if (!Number.isFinite(generatedMs)) return true
  return Date.now() - generatedMs > STALE_THRESHOLD_MS
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const communities = await listGuideCommunities()
  const results: Array<{
    slug: string
    stale: boolean
    generatedAt: string | null
  }> = []

  let staleCount = 0
  let freshCount = 0
  let missingCount = 0

  for (const c of communities) {
    const stale = isStale(c.manifest)
    results.push({
      slug: c.slug,
      stale,
      generatedAt: c.manifest?.generatedAt ?? null,
    })
    if (!c.manifest) missingCount++
    else if (stale) staleCount++
    else freshCount++
  }

  return NextResponse.json({
    ok: true,
    scanned: communities.length,
    fresh: freshCount,
    stale: staleCount,
    missing: missingCount,
    durationMs: Date.now() - startedAt,
    note: 'Regeneration runs out-of-band. Trigger via `node scripts/buyers-guide/generate-pdf.mjs --community <slug>` locally or from a dedicated worker.',
    results,
  })
}

/**
 * Buyers-guide regeneration cron — weekly, Sunday 3am PT (10am UTC).
 *
 * Walks every community with a registered guide directory under
 * `public/guides/<slug>/` and regenerates the PDF if its manifest reports
 * a `generatedAt` timestamp older than 7 days. Calls the Puppeteer script
 * at `scripts/buyers-guide/generate-pdf.mjs`.
 *
 * Runs against the deployed Vercel app (BUYERS_GUIDE_BASE_URL env var) so
 * the PDF reflects current production data, not the dev server's view.
 *
 * Auth: Authorization: Bearer $CRON_SECRET.
 *
 * Spec: marketing_brain_skills/producers/buyers-guide/SKILL.md §4.3 Step 5.
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

type ManifestLite = { generatedAt?: string; slug?: string }

async function listGuideCommunities(): Promise<Array<{ slug: string; manifest: ManifestLite | null }>> {
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

async function regenerate(communitySlug: string, baseUrl: string): Promise<{ ok: boolean; durationMs: number; error?: string }> {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const scriptPath = path.join(process.cwd(), 'scripts', 'buyers-guide', 'generate-pdf.mjs')
    const args = [
      scriptPath,
      '--community',
      communitySlug,
      '--out',
      path.join('public', 'guides', communitySlug, `${communitySlug}-buyers-guide.pdf`),
      '--base-url',
      baseUrl,
    ]
    const child = spawn('node', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('exit', (code) => {
      const durationMs = Date.now() - startedAt
      if (code === 0) {
        resolve({ ok: true, durationMs })
      } else {
        resolve({ ok: false, durationMs, error: `exit ${code}: ${stderr.slice(0, 500)}` })
      }
    })
    child.on('error', (err) => {
      resolve({ ok: false, durationMs: Date.now() - startedAt, error: err.message })
    })
  })
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl = (
    process.env.BUYERS_GUIDE_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://ryan-realty.com'
  ).replace(/\/$/, '')

  const startedAt = Date.now()
  const communities = await listGuideCommunities()
  const results: Array<{
    slug: string
    stale: boolean
    regenerated: boolean
    durationMs?: number
    error?: string
  }> = []

  let regenerated = 0
  let skipped = 0
  let errors = 0

  for (const c of communities) {
    const stale = isStale(c.manifest)
    if (!stale) {
      results.push({ slug: c.slug, stale: false, regenerated: false })
      skipped++
      continue
    }
    const r = await regenerate(c.slug, baseUrl)
    results.push({
      slug: c.slug,
      stale: true,
      regenerated: r.ok,
      durationMs: r.durationMs,
      error: r.error,
    })
    if (r.ok) regenerated++
    else errors++
  }

  return NextResponse.json({
    ok: true,
    scanned: communities.length,
    regenerated,
    skipped,
    errors,
    durationMs: Date.now() - startedAt,
    results,
  })
}

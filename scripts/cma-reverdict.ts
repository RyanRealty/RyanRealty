/**
 * Re-derive the STORED adversarial-audit verdict with the CURRENT
 * `computeAuditVerdict`, and (only with `--write`) persist the corrected one.
 *
 * WHY THIS EXISTS. The verdict is not computed when the queue is read: it is
 * frozen into `cmas.build_summary.audit.verdict` at build time, and
 * `readAudit()` in lib/data/cma/unified-queue.ts reads that stored string
 * verbatim. So a calibration change to `computeAuditVerdict` moves NEW builds
 * only — every already-built row keeps the verdict the old calibration wrote.
 *
 * Calibration v4 (2026-09-07) makes a `critical` finding in ANY category force
 * `review`. v2's price-opinion exemption had been swallowing criticals, so
 * rows carrying "every priced sale was excluded and none were kept, yet a
 * Supportable $961k opinion is still issued" sat in the sendable `ready` lane.
 * This script finds them and moves them to `flagged` (§0: a broker reads it
 * before it goes out).
 *
 *   npx tsx scripts/cma-reverdict.ts
 *   npx tsx scripts/cma-reverdict.ts --write
 *   … --json out.json     # write the full tally to a file as well
 *
 * DRY RUN IS THE DEFAULT and reads only. `--write` touches exactly one field,
 * `build_summary.audit.verdict`, and ONLY on rows whose stored findings
 * contain a `critical` and whose re-derived verdict differs from the stored
 * one. It never rewrites findings, never re-runs the LLM (so it costs
 * nothing), never sends, approves or finalizes, and never downgrades a row:
 * a `pass` may become `review`, never the reverse.
 *
 * `needs_review` is deliberately left alone. The queue's `resolveState()`
 * already maps `auditVerdict === 'review'` to `flagged` on its own, and
 * `needs_review` is the separate build-time flag Matt's review queue owns.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import fs from 'node:fs'
import path from 'node:path'
import Module from 'node:module'

const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (
  this: unknown,
  request: string,
  ...args: unknown[]
) {
  const req =
    request === 'server-only' || request === 'client-only'
      ? STUB
      : request === 'next/cache'
        ? CACHE_STUB
        : request
  return resolveFilename.call(this, req, ...args)
}

type StoredFinding = { severity?: string | null; category?: string | null; claim?: string | null }
type StoredAudit = { used_llm?: boolean; verdict?: string | null; findings?: StoredFinding[] | null }

/** Read the stored block the same way lib/data/cma/unified-queue.ts does. */
function storedVerdict(raw: string | null | undefined): 'pass' | 'review' | 'fail' {
  const s = String(raw ?? '').toLowerCase()
  return s.includes('fail') ? 'fail' : s.includes('review') ? 'review' : s.includes('pass') ? 'pass' : 'review'
}

/** Run N promises at a time — 400 sequential single-row reads is a 3-minute script. */
async function mapPool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx])
      }
    }),
  )
  return out
}

async function main() {
  const argv = process.argv.slice(2)
  const write = argv.includes('--write')
  const jsonArg = argv.indexOf('--json')
  const jsonOut = jsonArg >= 0 ? argv[jsonArg + 1] : null

  const { listCmaQueue, getCmaAdminReviewRowBySlug, updateCmaRowFieldsBySlug } = await import('@/lib/data')
  const { computeAuditVerdict } = await import('@/lib/cma/audit')
  type AuditFinding = Parameters<typeof computeAuditVerdict>[0][number]

  const { rows, total } = await listCmaQueue({ limit: 1000 })
  const stateCount = (rs: { state: string }[]) =>
    rs.reduce<Record<string, number>>((acc, r) => ((acc[r.state] = (acc[r.state] ?? 0) + 1), acc), {})
  const before = stateCount(rows)
  console.log(`${rows.length} queue rows (of ${total}) · ${write ? 'WRITE' : 'DRY RUN'}`)
  console.log(`BEFORE  ${Object.entries(before).map(([k, v]) => `${k} ${v}`).join(' · ')}`)

  // Only rows the audit actually ran on can have a stored verdict to re-derive.
  const audited = rows.filter((r) => r.auditVerdict !== 'did-not-run')
  console.log(`Reading build_summary for ${audited.length} audited row(s)…`)

  const moved: Array<{
    slug: string
    state: string
    stored: string
    rederived: string
    criticals: number
    categories: string[]
    claim: string
  }> = []
  let unchanged = 0
  let unreadable = 0

  await mapPool(audited, 8, async (row) => {
    const full = await getCmaAdminReviewRowBySlug(row.slug)
    const summary = (full?.build_summary ?? null) as { audit?: StoredAudit | null } | null
    const audit = summary?.audit ?? null
    if (!audit || audit.used_llm !== true) {
      unreadable += 1
      return
    }
    const findings = (Array.isArray(audit.findings) ? audit.findings : []).map((f) => ({
      severity: String(f?.severity ?? 'major'),
      category: String(f?.category ?? 'other'),
      claim: String(f?.claim ?? ''),
      evidence: '',
      compListingKey: null,
    })) as unknown as AuditFinding[]

    const stored = storedVerdict(audit.verdict)
    const rederived = computeAuditVerdict(findings)
    if (stored === rederived) {
      unchanged += 1
      return
    }
    const criticals = findings.filter((f) => f.severity === 'critical')
    moved.push({
      slug: row.slug,
      state: row.state,
      stored,
      rederived,
      criticals: criticals.length,
      categories: [...new Set(criticals.map((f) => f.category))],
      claim: criticals[0]?.claim ?? '',
    })
  })

  moved.sort((a, b) => a.slug.localeCompare(b.slug))
  console.log('')
  console.log(`${moved.length} row(s) whose stored verdict disagrees with the current calibration:`)
  for (const m of moved) {
    console.log(
      `  ${m.slug}  ${m.state} · ${m.stored} → ${m.rederived} · ${m.criticals} critical [${m.categories.join(', ')}]`,
    )
    if (m.claim) console.log(`      ${m.claim.slice(0, 180)}`)
  }
  console.log(`(${unchanged} agree, ${unreadable} had no readable audit block)`)

  // Project the queue states forward without re-reading: only pass → review
  // moves, and resolveState maps `review` to `flagged`.
  const movedSlugs = new Set(moved.map((m) => m.slug))
  const after = stateCount(
    rows.map((r) => {
      const m = moved.find((x) => x.slug === r.slug)
      if (!m || !movedSlugs.has(r.slug)) return r
      if (r.state !== 'ready') return r
      return { ...r, state: m.rederived === 'fail' ? 'audit-failed' : 'flagged' }
    }),
  )
  console.log('')
  console.log(`AFTER   ${Object.entries(after).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  console.log(
    `ready ${before.ready ?? 0} → ${after.ready ?? 0} · flagged ${before.flagged ?? 0} → ${after.flagged ?? 0}`,
  )

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify({ before, after, moved }, null, 2))
    console.log(`Wrote ${jsonOut}`)
  }

  if (!write) {
    console.log('')
    console.log('DRY RUN — nothing was written. Re-run with --write to persist the re-derived verdicts.')
    return
  }

  // The write guard: a critical must be present, and the verdict may only get
  // stricter. Anything else is a bug in this script, not a row to correct.
  let written = 0
  for (const m of moved) {
    if (m.criticals < 1 || m.stored !== 'pass') {
      console.log(`  ${m.slug}: SKIPPED — ${m.criticals} critical, stored ${m.stored} (guard: pass + ≥1 critical only)`)
      continue
    }
    const full = await getCmaAdminReviewRowBySlug(m.slug)
    const summary = { ...((full?.build_summary ?? {}) as Record<string, unknown>) }
    const audit = { ...((summary.audit ?? {}) as Record<string, unknown>) }
    audit.verdict = m.rederived
    audit.verdict_recalibrated = { at: new Date().toISOString(), from: m.stored, calibration: 'v4-2026-09-07' }
    summary.audit = audit
    const res = await updateCmaRowFieldsBySlug(m.slug, { build_summary: summary })
    if (res.ok) written += 1
    console.log(`  ${m.slug}: ${m.stored} → ${m.rederived}${res.ok ? '' : ` · WRITE FAILED: ${res.error}`}`)
  }
  console.log(`Wrote ${written} of ${moved.length} row(s).`)
}

main().catch((e) => {
  console.error('✖ re-verdict threw:', e)
  process.exit(1)
})

/**
 * Re-run ONLY the adversarial audit on CMAs whose audit never ran.
 *
 * WHY THIS EXISTS. `verdict !== 'pass'` — or an audit that could not run at all
 * — forces the document to `needs_review`, and Matt's rule is that auto-send
 * can only ever reach a ready, audit-PASSED document. So every row sitting at
 * `did-not-run` is a lead nobody contacts. Rebuilding those rows to get an
 * audit is the wrong tool: `buildCma` re-selects comps and re-prices, so the
 * document the broker already read changes underneath the verdict.
 *
 * This audits the document AS BUILT. It reads `render_args` (the exact input
 * the renderer received — subject, priced comps, pricing, market, site) plus
 * the stored comparability judgment, hands them to the same `auditCma` the
 * build calls, and writes the result through `auditSummaryBlock`, the one
 * definition of that block. The comps under attack are therefore the comps
 * printed on the page (CLAUDE.md section 0).
 *
 *   npx tsx scripts/cma-reaudit.ts                    # dry run, every candidate
 *   npx tsx scripts/cma-reaudit.ts --limit 5          # dry run, first 5
 *   npx tsx scripts/cma-reaudit.ts --limit 5 --write  # audit and persist 5
 *   npx tsx scripts/cma-reaudit.ts --slug cma-x --write
 *   npx tsx scripts/cma-reaudit.ts --preview cma-x    # audit ANY slug, print, write nothing
 *
 * DRY RUN IS THE DEFAULT. `--write` is the only mode that touches a row, and
 * it refuses any row whose audit is not `did-not-run` — it can never overwrite
 * a verdict that already exists. It never sends, approves, or finalizes
 * anything; a row that audits `fail` or `review` lands in the queue's
 * audit-failed / flagged lanes for a broker, exactly as a fresh build would.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
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

type StoredVerdict = { listingKey: string; tier: string; reason: string }

async function main() {
  const argv = process.argv.slice(2)
  const write = argv.includes('--write')
  const limitArg = argv.indexOf('--limit')
  const limit = limitArg >= 0 ? Math.max(1, Number(argv[limitArg + 1]) || 1) : Infinity
  const slugArg = argv.indexOf('--slug')
  const previewArg = argv.indexOf('--preview')
  // --preview audits a named document AS BUILT and prints the verdict without
  // touching the row or the candidate filter. It is how the audit path is
  // exercised when nothing is sitting at did-not-run, and it doubles as
  // "what would the auditor say about this one" before a broker approves it.
  const preview = previewArg >= 0 ? (argv[previewArg + 1] ?? '').trim().toLowerCase() : null
  const onlySlug = slugArg >= 0 ? (argv[slugArg + 1] ?? '').trim().toLowerCase() : null

  const { listCmaQueue, getCmaRenderSourceBySlug, updateCmaRowFieldsBySlug } = await import('@/lib/data')
  const { auditCma } = await import('@/lib/cma/audit')
  const { auditSummaryBlock } = await import('@/lib/cma/build-summary')
  const { auditUnavailableReason } = await import('@/lib/cma/llm-unavailable')
  const { grokConfigured } = await import('@/lib/grok')

  if (!grokConfigured()) {
    console.error('✖ XAI_API_KEY is not set. The audit cannot run; nothing was read or written.')
    process.exit(1)
  }

  const { rows } = await listCmaQueue({ limit: 1000 })
  // `unvetted` is the queue's own name for "has a real document, and the audit
  // did not run". A build FAILURE also reads did-not-run, but it has no
  // document to audit — it resolves to `failed` and is not a candidate here.
  const candidates = preview
    ? rows.filter((r) => r.slug === preview)
    : rows
        .filter((r) => r.state === 'unvetted' && (!onlySlug || r.slug === onlySlug))
        .slice(0, limit === Infinity ? undefined : limit)

  console.log(
    `${rows.length} queue rows · ${rows.filter((r) => r.state === 'unvetted').length} unvetted (document built, audit did not run)` +
      `${onlySlug ? ` · filtered to ${onlySlug}` : ''}${preview ? ` · PREVIEW ${preview}` : ''} · ${candidates.length} selected · ${
        preview ? 'PREVIEW (no write)' : write ? 'WRITE' : 'DRY RUN'
      }`,
  )
  if (!candidates.length) {
    console.log('Nothing to re-audit.')
    return
  }

  let audited = 0
  let spendUsd = 0
  const tally: Record<string, number> = {}

  for (const row of candidates) {
    const src = await getCmaRenderSourceBySlug(row.slug)
    const args = (src?.render_args ?? null) as Record<string, unknown> | null
    if (!args?.subject || !Array.isArray(args.comps) || !args.pricing) {
      console.log(`  ${row.slug}: SKIP — no stored render_args to audit (rebuild required, not a re-audit).`)
      tally['skipped: no render_args'] = (tally['skipped: no render_args'] ?? 0) + 1
      continue
    }

    // Rebuild the judgment context from the row so the auditor reads the same
    // narrative and the same exclusion list the build showed it.
    const summary = (src?.build_summary ?? {}) as Record<string, unknown>
    const stored = (summary.judgment ?? null) as
      | { used_llm?: boolean; model?: string; narrative?: string; verdicts?: StoredVerdict[] }
      | null
    const verdicts = Array.isArray(stored?.verdicts) ? stored!.verdicts! : []
    const judgment = stored?.used_llm
      ? ({
          model: stored.model ?? 'unknown',
          costUsd: 0,
          confidence: 'stored',
          keptKeys: verdicts.filter((v) => v.tier !== 'exclude').map((v) => v.listingKey),
          verdicts,
          narrative: stored.narrative ?? '',
        } as never)
      : null
    const excluded = verdicts
      .filter((v) => v.tier === 'exclude')
      .map((v) => ({ listingKey: v.listingKey, reason: v.reason }))

    if (!write && !preview) {
      console.log(
        `  ${row.slug}: would audit ${(args.comps as unknown[]).length} priced comp(s) as built` +
          `${judgment ? ' with the stored comparability narrative' : ' with no stored judgment'}.`,
      )
      tally['would audit'] = (tally['would audit'] ?? 0) + 1
      continue
    }

    const audit = await auditCma({
      subject: args.subject as never,
      comps: args.comps as never,
      excluded,
      pricing: args.pricing as never,
      judgment,
      market: (args.market ?? null) as never,
      site: (args.site ?? null) as never,
    })

    if (!audit) {
      const why = auditUnavailableReason() ?? 'no reason recorded'
      console.log(`  ${row.slug}: audit UNAVAILABLE — ${why}`)
      tally['unavailable'] = (tally['unavailable'] ?? 0) + 1
      // Persist the reason so the row stops saying "no key or call failed".
      if (!preview) {
        await updateCmaRowFieldsBySlug(row.slug, {
          build_summary: { ...summary, audit: auditSummaryBlock(null) },
        })
      }
      continue
    }

    audited += 1
    spendUsd += audit.costUsd
    tally[audit.verdict] = (tally[audit.verdict] ?? 0) + 1
    const criticals = audit.findings.filter((f) => f.severity === 'critical').length

    // A non-pass verdict must keep the document out of the sendable lane. The
    // queue derives `audit-failed` / `flagged` from these two fields together,
    // so both are written or neither is.
    const nextSummary: Record<string, unknown> = {
      ...summary,
      audit: auditSummaryBlock(audit),
      ...(audit.verdict === 'pass'
        ? {}
        : {
            needs_review: true,
            review_reason:
              (summary.review_reason as string | null) ??
              `Audit verdict: ${audit.verdict}. ${audit.summary}`.trim(),
          }),
    }
    const res = preview ? { ok: true, error: undefined } : await updateCmaRowFieldsBySlug(row.slug, { build_summary: nextSummary })
    console.log(
      `  ${row.slug}: ${audit.verdict.toUpperCase()} (model said ${audit.llmVerdict}) · ${audit.findings.length} finding(s), ${criticals} critical · $${audit.costUsd}` +
        `${preview ? ' · not written' : res.ok ? '' : ` · WRITE FAILED: ${res.error}`}`,
    )
    if (audit.summary) console.log(`      ${audit.summary}`)
  }

  console.log('')
  console.log(`Result: ${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing'}`)
  if (write || preview) console.log(`Audited ${audited} document(s) for $${spendUsd.toFixed(4)}.${preview ? ' Nothing was written.' : ''}`)
}

main().catch((e) => {
  console.error('✖ re-audit threw:', e)
  process.exit(1)
})

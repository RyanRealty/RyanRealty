/**
 * /api/cron/tc-document-read — the Vault document reader (docs/TC_DOCUMENT_READER.md).
 *
 * Every 15 minutes:
 *  0. Check new documents against the printed form (lib/tc/form-match): no
 *     model, a few seconds each. The reader's "fully executed" is held to it.
 *  1. Read documents the current reader version has not read (new mail
 *     attachments, uploads, sealed envelopes), oldest first, three at a time:
 *     which form, which instance, who must sign, who did.
 *  2. For each deal cycle touched, plan the file (one copy per form instance,
 *     only fully executed copies on the checklist) and apply it. A removal
 *     whose only ground is "not fully executed" waits for a second model to
 *     agree; anything the reader cannot settle is flagged for a person.
 *
 * ?doc=<uuid> reads one document and plans its cycle. ?cycle=<uuid> plans one
 * cycle. ?dry=1 plans without applying.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { grokConfigured } from '@/lib/grok/client'
import { applyCyclePlan, planCycleDocuments, readStoredDocument, unreadDocumentIds } from '@/lib/tc/doc-read/run'
import { checkStoredDocument, uncheckedDocumentIds } from '@/lib/tc/form-match/run'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BUDGET_MS = 230_000
const CONCURRENCY = 3
const BATCH = 24
const CHECK_BATCH = 20
const CHECK_BUDGET_MS = 70_000

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied
  if (!grokConfigured()) return NextResponse.json({ ok: false, error: 'XAI_API_KEY not configured' }, { status: 503 })
  const start = Date.now()
  const sb = createServiceClient()
  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dry') === '1'
  const onlyDoc = url.searchParams.get('doc')
  const onlyCycle = url.searchParams.get('cycle')

  const { data: gotLease } = await sb.rpc('crm_try_cron_lease', { p_name: 'tc-document-read', p_lease_seconds: 300 })
  if (gotLease === false) return NextResponse.json({ ok: true, skipped: 'previous run still in progress' })

  const reads: Array<{ id: string; ok: boolean; verdict?: string; error?: string; costUsd?: number }> = []
  const cycles = new Set<string>()
  if (onlyCycle) cycles.add(onlyCycle)

  // 0. The check against the printed form first, so the read below is held to it.
  const checked: Array<{ id: string; ok: boolean; forms?: number; error?: string }> = []
  const toCheck = onlyDoc ? [onlyDoc] : onlyCycle ? [] : await uncheckedDocumentIds(sb, CHECK_BATCH)
  for (const id of toCheck) {
    if (Date.now() - start > CHECK_BUDGET_MS) break
    const r = await checkStoredDocument(sb, id)
    checked.push(r.ok ? { id, ok: true, forms: r.check.forms.length } : { id, ok: false, error: r.error.slice(0, 200) })
    if (r.ok) {
      const { data } = await sb.from('tc_documents').select('cycle_id').eq('id', id).maybeSingle()
      if (data?.cycle_id) cycles.add(String(data.cycle_id))
    }
  }

  const queue = onlyDoc ? [onlyDoc] : onlyCycle ? [] : await unreadDocumentIds(sb, BATCH)
  async function worker() {
    while (queue.length && Date.now() - start < BUDGET_MS) {
      const id = queue.shift()!
      const r = await readStoredDocument(sb, id)
      if (r.ok) {
        reads.push({ id, ok: true, verdict: r.verdict.verdict, costUsd: r.costUsd })
        const { data } = await sb.from('tc_documents').select('cycle_id').eq('id', id).maybeSingle()
        if (data?.cycle_id) cycles.add(String(data.cycle_id))
      } else {
        reads.push({ id, ok: false, error: r.error.slice(0, 200) })
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const applied: Array<{ cycleId: string; archived: number; linked: number; unlinked: number; flagged: number }> = []
  for (const cycleId of cycles) {
    if (Date.now() - start > BUDGET_MS + 40_000) break
    const planned = await planCycleDocuments(sb, cycleId)
    if (!planned) continue
    const res = await applyCyclePlan(sb, planned, { dryRun })
    applied.push({ cycleId, archived: res.archived, linked: res.linked, unlinked: res.unlinked, flagged: res.flagged })
  }

  const costUsd = reads.reduce((s, r) => s + (r.costUsd ?? 0), 0)
  return NextResponse.json({
    ok: true,
    dryRun,
    checked: checked.filter((c) => c.ok).length,
    checkFailed: checked.filter((c) => !c.ok),
    read: reads.filter((r) => r.ok).length,
    failed: reads.filter((r) => !r.ok),
    cycles: applied,
    costUsd: Math.round(costUsd * 10000) / 10000,
    ms: Date.now() - start,
  })
}

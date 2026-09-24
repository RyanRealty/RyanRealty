/**
 * /api/cron/tc-deal-terms — deal terms from the contract (Matt 2026-09-24:
 * "When they read the actual deal file, any counteroffers, addendums, and all
 * that stuff will be automatically placed into the deal file").
 *
 * Every 20 minutes:
 *  1. Read the terms of contract documents the document reader has already
 *     identified (sale agreements, counteroffers, executed addenda, earnest
 *     money receipts, settlement statements), live files first. Each is read
 *     twice, by Claude on the PDF and by Grok on our page renders; a term
 *     counts only when both read it the same (lib/tc/terms).
 *  2. For each sale cycle touched, resolve the chain and fill every EMPTY term
 *     field (price, earnest money, acceptance and closing dates, inspection and
 *     financing periods, escrow company and number, buyers, sellers). A field
 *     holding a different value is left for a person on the file.
 *  3. Watch the document reader: when readable documents wait and nothing has
 *     been read for two hours, Matt gets one email (at most every 12 hours).
 *
 * Both readers are required: with either key missing the route does nothing.
 * ?doc=<uuid>&dry=1 reads one document and returns both readings, writing
 * nothing. ?cycle=<uuid> resolves and fills one cycle.
 */
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { grokConfigured } from '@/lib/grok/client'
import { applyCycleTerms, pendingTermsDocuments, readDocumentTerms } from '@/lib/data/tc/deal-terms'
import { checkReaderHealth } from '@/lib/data/tc/reader-health'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BUDGET_MS = 220_000
const CONCURRENCY = 2
const BATCH = 8

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied
  const url = new URL(request.url)
  const start = Date.now()
  const sb = createServiceClient()

  // The watch on the document reader runs whatever else happens here.
  const health = await checkReaderHealth(sb).catch((e) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }))

  if (!process.env.ANTHROPIC_API_KEY?.trim() || !grokConfigured()) {
    return NextResponse.json({ ok: false, error: 'Both readers are required: ANTHROPIC_API_KEY and XAI_API_KEY', health }, { status: 503 })
  }

  const onlyDoc = url.searchParams.get('doc')
  const onlyCycle = url.searchParams.get('cycle')
  const dry = url.searchParams.get('dry') === '1'
  if (onlyDoc && dry) {
    const r = await readDocumentTerms(onlyDoc, { dry: true, sb })
    return NextResponse.json({ ok: true, dry: true, result: r })
  }

  const { data: gotLease } = await sb.rpc('crm_try_cron_lease', { p_name: 'tc-deal-terms', p_lease_seconds: 300 })
  if (gotLease === false) return NextResponse.json({ ok: true, skipped: 'previous run still in progress', health })

  const reads: Array<{ id: string; status: string; forms: number; agreed: number; disagreements: number; error?: string }> = []
  const cycles = new Set<string>()
  if (onlyCycle) cycles.add(onlyCycle)
  try {
    const queue = onlyDoc ? [onlyDoc] : onlyCycle ? [] : await pendingTermsDocuments(BATCH, sb)
    async function worker() {
      while (queue.length && Date.now() - start < BUDGET_MS) {
        const id = queue.shift()!
        const r = await readDocumentTerms(id, { sb })
        reads.push({ id, status: r.status, forms: r.forms, agreed: r.agreedTerms, disagreements: r.disagreements, error: r.error })
        if (r.status === 'read') {
          const { data } = await sb.from('tc_documents').select('cycle_id').eq('id', id).maybeSingle()
          if (data?.cycle_id) cycles.add(String(data.cycle_id))
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))

    const applied = []
    for (const cycleId of cycles) {
      if (Date.now() - start > BUDGET_MS + 40_000) break
      applied.push(await applyCycleTerms(cycleId, sb).catch((e) => ({ cycleId, filled: [], replaced: [], conflicts: 0, skipped: e instanceof Error ? e.message : String(e) })))
    }
    return NextResponse.json({ ok: true, reads, applied, health, ms: Date.now() - start })
  } finally {
    await sb.rpc('crm_release_cron_lease', { p_name: 'tc-deal-terms' })
  }
}

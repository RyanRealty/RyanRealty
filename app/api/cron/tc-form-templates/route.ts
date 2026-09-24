/**
 * /api/cron/tc-form-templates — keep the Vault's printed-form templates
 * current (lib/tc/form-match, docs/TC_DOCUMENT_READER.md "Checked against the
 * printed form").
 *
 * Daily: learn a template for every form + release our own copies show that
 * the licensed library does not hold (older releases, and a new release
 * before the library has it), from pages the checker could not match that
 * print a readable footer, once copies from two different deals agree. Only
 * groups with new copies are relearned. Documents whose pages a new template
 * covers are queued to be checked again; the document reader cron checks them.
 *
 * The licensed blanks themselves come from the SkySlope Forms catalog
 * (tc_form_versions); `scripts/tc-form-templates.ts library` rebuilds their
 * templates after a catalog ingest.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { learnTemplates } from '@/lib/tc/form-match/learn'
import { recheckDocuments } from '@/lib/tc/form-match/run'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BUDGET_MS = 230_000

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied
  const start = Date.now()
  const sb = createServiceClient()
  const dryRun = new URL(request.url).searchParams.get('dry') === '1'
  const res = await learnTemplates(sb, { onlyNew: true, deadline: start + BUDGET_MS, dryRun })
  if (!dryRun && res.recheck.length) await recheckDocuments(sb, [...new Set(res.recheck)])
  return NextResponse.json({
    ok: true,
    dryRun,
    learned: res.learned,
    recheck: new Set(res.recheck).size,
    complete: res.complete,
    ms: Date.now() - start,
  })
}

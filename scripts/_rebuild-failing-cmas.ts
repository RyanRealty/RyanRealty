/**
 * Rebuild every live CMA that is not a clean audit pass.
 *
 * Uses the local XAI_API_KEY in .env.local (lib/grok). Does not call Anthropic.
 * Does not send. Same buildCma path as the admin rebuild button.
 *
 *   npx tsx scripts/_rebuild-failing-cmas.ts --dry-run
 *   npx tsx scripts/_rebuild-failing-cmas.ts --limit 5
 *   npx tsx scripts/_rebuild-failing-cmas.ts
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import path from 'node:path'
import Module from 'node:module'
import { createClient } from '@supabase/supabase-js'

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

function auditOf(summary: unknown): { used: boolean; verdict: string } {
  const a = (summary as { audit?: { used_llm?: boolean; verdict?: string } } | null)?.audit
  if (!a) return { used: false, verdict: 'none' }
  if (a.used_llm !== true) return { used: false, verdict: 'did-not-run' }
  return { used: true, verdict: String(a.verdict ?? '').toLowerCase() }
}

async function listSlugs(): Promise<string[]> {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await sb
    .from('cmas')
    .select('slug, recommended_list, build_summary, archived_at, status')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .range(0, 999)
  if (error) throw new Error(error.message)
  const out: string[] = []
  for (const r of data ?? []) {
    const a = auditOf(r.build_summary)
    const needs =
      !a.used ||
      a.verdict.includes('fail') ||
      a.verdict.includes('review') ||
      a.verdict === 'none' ||
      a.verdict === 'did-not-run'
    if (needs && r.slug) out.push(String(r.slug))
  }
  return out
}

async function main() {
  const argv = process.argv.slice(2)
  const dryRun = argv.includes('--dry-run')
  const limitArg = argv.find((a) => a.startsWith('--limit='))
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : Number.POSITIVE_INFINITY
  if (!process.env.XAI_API_KEY?.startsWith('xai-')) {
    console.error('✖ XAI_API_KEY missing from .env.local — rebuilds must use the local xAI key, not Anthropic.')
    process.exit(1)
  }
  // Subdivision-story and the Orwell reviewer still import Anthropic. That
  // account is out of credit. Unset the key so those passes fail open instantly
  // instead of spending 10s on a 400. Judge + audit use XAI_API_KEY.
  delete process.env.ANTHROPIC_API_KEY
  const slugs = (await listSlugs()).slice(0, Number.isFinite(limit) ? limit : undefined)
  console.log(`${dryRun ? 'DRY ' : ''}rebuild ${slugs.length} CMAs on local xAI key`)
  if (dryRun) {
    for (const s of slugs) console.log(s)
    return
  }
  const { getCmaAdminRowBySlug } = await import('@/lib/data')
  const { buildCma } = await import('@/lib/cma/build')
  let ok = 0
  let fail = 0
  for (const slug of slugs) {
    const row = await getCmaAdminRowBySlug(slug)
    if (!row) {
      console.error(`✖ ${slug} missing`)
      fail++
      continue
    }
    const started = Date.now()
    process.stdout.write(`→ ${slug} ${String(row.subject_address ?? '')} … `)
    try {
      const result = await buildCma({
        slug,
        mlsNumber: (row.subject_listing_key as string | null) ?? null,
        rawAddress: (row.subject_address as string | null) ?? null,
        city: (row.subject_city as string | null) ?? null,
        client: {
          name: (row.client_name as string | null)?.trim() || null,
          email: (row.client_email as string | null)?.trim().toLowerCase() || null,
          phone: (row.client_phone as string | null)?.trim() || null,
          notes: (row.client_notes as string | null) ?? null,
        },
        brokerSlug: (row.broker_slug as string | null) ?? null,
        priceOverride: null,
        requestSource: (row.request_source as string | null) ?? 'cli-rebuild',
        docType: (row.doc_type as string | null) === 'expired-audit' ? 'expired-audit' : 'cma',
      })
      const secs = ((Date.now() - started) / 1000).toFixed(1)
      if (!result.ok) {
        console.log(`FAIL ${secs}s ${result.error}`)
        fail++
      } else {
        console.log(`ok ${secs}s`)
        ok++
      }
    } catch (e) {
      console.log(`THREW ${e instanceof Error ? e.message : e}`)
      fail++
    }
    await new Promise((r) => setTimeout(r, 800))
  }
  console.log(`done ok=${ok} fail=${fail}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

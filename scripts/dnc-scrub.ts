/**
 * DNC scrub runner — works through the backlog of never-checked phone numbers.
 *
 *   npx tsx scripts/dnc-scrub.ts --limit 25            # scrub 25 numbers
 *   npx tsx scripts/dnc-scrub.ts --limit 25 --dry-run  # show the backlog, spend nothing
 *   npx tsx scripts/dnc-scrub.ts --limit 5000          # a real backfill chunk
 *
 * SPENDS MONEY. BatchData bills per number, so --limit is required and there is
 * no default that quietly scrubs the whole book. Start with --dry-run, then a
 * small --limit, and read the printed cost before scaling.
 *
 * What it does per batch of 100:
 *   1. pull unchecked/stale numbers (crm_unchecked_dnc_phones, SECURITY DEFINER)
 *   2. ask BatchData
 *   3. record every ANSWER in crm_phone_dnc_checks (an unmatched or errored
 *      number is recorded as nothing, never as clean)
 *   4. for a number on the registry, tag + suppress every live contact holding
 *      it, so the send chokepoint blocks them from that moment
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
  this: unknown, request: string, ...args: unknown[]
) {
  const req = request === 'server-only' || request === 'client-only' ? STUB
    : request === 'next/cache' ? CACHE_STUB : request
  return resolveFilename.call(this, req, ...args)
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? '') : null
}

async function main() {
  const limitRaw = arg('limit')
  const dryRun = process.argv.includes('--dry-run')
  const limit = Number(limitRaw)
  if (!limitRaw || !Number.isFinite(limit) || limit <= 0) {
    console.error('Refusing to run without an explicit --limit (this spends money per number).')
    process.exit(1)
  }

  const { listUncheckedPhones, recordDncChecks } = await import('@/lib/data/crm/dncChecks')
  const { scrubPhones, tagsForResult, MAX_PHONES_PER_REQUEST } = await import('@/lib/crm/dnc-scrub')
  const { createServiceClient } = await import('@/lib/supabase/service')
  const { addSuppression } = await import('@/lib/crm/suppressions')

  const backlog = await listUncheckedPhones(limit)
  console.log(`backlog pulled: ${backlog.length} number(s) (limit ${limit})`)
  if (dryRun) {
    console.log('DRY RUN — nothing sent, nothing spent. Sample:', backlog.slice(0, 5).join(', '))
    return
  }
  if (backlog.length === 0) return

  const sb = createServiceClient()
  let answered = 0, flagged = 0, contactsSuppressed = 0

  for (let i = 0; i < backlog.length; i += MAX_PHONES_PER_REQUEST) {
    const batch = backlog.slice(i, i + MAX_PHONES_PER_REQUEST)
    const results = await scrubPhones(batch)
    answered += results.length
    const wrote = await recordDncChecks(results)
    if (!wrote.ok) throw new Error(`record failed: ${wrote.error}`)

    for (const r of results) {
      const tags = tagsForResult(r)
      if (tags.length === 0) continue
      flagged++
      // Every LIVE contact holding this number inherits the flag — the registry
      // is a property of the number, and a spouse on the same line is equally
      // off limits. Matched on DIGITS via crm_people_by_phone_last10: a jsonb
      // containment filter was tried first and found 1 contact for 9 flagged
      // numbers, because it needs the stored element to be byte-identical.
      const { data: ids, error: idErr } = await sb.rpc('crm_people_by_phone_last10', { p_last10: r.phoneLast10 })
      if (idErr) throw new Error(`holder lookup failed for ${r.phoneLast10}: ${idErr.message}`)
      const holderIds = ((ids ?? []) as Array<{ person_id: number }>).map((x) => x.person_id)
      const { data: holders } = await sb.from('crm_people').select('id,tags').in('id', holderIds.length ? holderIds : [-1])
      for (const p of (holders ?? []) as Array<{ id: number; tags: string[] | null }>) {
        const next = [...new Set([...(p.tags ?? []), ...tags])]
        const { error: tagErr } = await sb
          .from('crm_people')
          .update({ tags: next, updated_at: new Date().toISOString() })
          .eq('id', p.id)
        if (tagErr) throw new Error(`tagging ${p.id} failed: ${tagErr.message}`)

        // addSuppression is the canonical writer: it also enqueues removal from
        // the Meta custom audience, which a DNC contact must leave. A raw upsert
        // was tried first and failed silently — crm_suppressions has no unique
        // constraint on (person_id, channel, reason), so onConflict had nothing
        // to target and every row errored while the script reported success.
        // It plain-inserts, so the existence check is ours to do.
        for (const channel of ['call', 'sms'] as const) {
          const { data: existing } = await sb
            .from('crm_suppressions')
            .select('id')
            .eq('person_id', p.id)
            .eq('channel', channel)
            .eq('reason', 'do-not-call')
            .maybeSingle()
          if (!existing) {
            await addSuppression({
              personId: p.id, channel, reason: 'do-not-call',
              source: 'batchdata-dnc-scrub', value: r.phoneLast10,
            })
          }
        }
        contactsSuppressed++
      }
    }
    console.log(`  batch ${i / MAX_PHONES_PER_REQUEST + 1}: asked ${batch.length}, answered ${results.length}`)
  }

  const unanswered = backlog.length - answered
  console.log(`\nasked      ${backlog.length}`)
  console.log(`answered   ${answered}  (recorded)`)
  console.log(`no answer  ${unanswered}  (left UNCHECKED on purpose — not recorded as clean)`)
  console.log(`on registry ${flagged}  -> ${contactsSuppressed} contact(s) tagged + suppressed`)
  console.log(`\nAt roughly $0.02-0.05/number this batch cost about $${(backlog.length * 0.03).toFixed(2)}.`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })

/**
 * One DNC/litigator scrub pass, shared by the CLI (scripts/dnc-scrub.ts) and
 * the weekly cron (app/api/cron/dnc-scrub).
 *
 * It exists as one function because the two callers must not drift: a scrub
 * that applies flags differently depending on who started it is a compliance
 * record you cannot reason about.
 *
 * SPENDS MONEY — BatchData bills per number answered. Both callers pass an
 * explicit cap; there is no default that quietly scrubs the book.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { addSuppression } from '@/lib/crm/suppressions'
import { listUncheckedPhones, recordDncChecks } from '@/lib/data/crm/dncChecks'
import { scrubPhones, tagsForResult, MAX_PHONES_PER_REQUEST } from '@/lib/crm/dnc-scrub'

export type ScrubRunResult = {
  asked: number
  answered: number
  onRegistry: number
  litigators: number
  litigatorChecked: number
  contactsFlagged: number
  batchesAbandoned: number
}

/**
 * Retry a transient failure. A run talks to two networks for minutes at a time;
 * a single Supabase 521 killed a run once. Work already recorded is never lost
 * (each batch commits before the next), so a retry only has to outlast the blip.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i === attempts) break
      await new Promise((r) => setTimeout(r, 2000 * 2 ** (i - 1)))
    }
  }
  throw lastErr
}

export async function runDncScrub(opts: {
  limit: number
  source?: string | null
  onProgress?: (msg: string) => void
}): Promise<ScrubRunResult> {
  const log = opts.onProgress ?? (() => {})
  const out: ScrubRunResult = {
    asked: 0, answered: 0, onRegistry: 0, litigators: 0,
    litigatorChecked: 0, contactsFlagged: 0, batchesAbandoned: 0,
  }
  if (opts.limit <= 0) return out

  const backlog = await withRetry(() => listUncheckedPhones(opts.limit, opts.source))
  out.asked = backlog.length
  if (backlog.length === 0) return out

  const sb = createServiceClient()

  for (let i = 0; i < backlog.length; i += MAX_PHONES_PER_REQUEST) {
    const batch = backlog.slice(i, i + MAX_PHONES_PER_REQUEST)
    let results
    try {
      results = await withRetry(() => scrubPhones(batch))
    } catch (e) {
      // A batch that will not settle is abandoned, not fatal: those numbers stay
      // UNCHECKED (never recorded clean) and the next run picks them up.
      out.batchesAbandoned++
      log(`batch ${i / MAX_PHONES_PER_REQUEST + 1} abandoned: ${e instanceof Error ? e.message.slice(0, 160) : e}`)
      continue
    }
    out.answered += results.length
    out.litigatorChecked += results.filter((r) => r.litigatorChecked).length
    out.litigators += results.filter((r) => r.isLitigator).length

    const wrote = await withRetry(() => recordDncChecks(results))
    if (!wrote.ok) throw new Error(`record failed: ${wrote.error}`)

    for (const r of results) {
      const tags = tagsForResult(r)
      if (tags.length === 0) continue
      out.onRegistry++

      // Every LIVE contact holding this number inherits the flag — the registry
      // is a property of the number, and a spouse on the same line is equally
      // off limits. Matched on DIGITS: a jsonb containment filter found 1
      // contact for 9 flagged numbers because it needs a byte-identical element.
      const { data: ids, error: idErr } = await sb.rpc('crm_people_by_phone_last10', { p_last10: r.phoneLast10 })
      if (idErr) throw new Error(`holder lookup failed for ${r.phoneLast10}: ${idErr.message}`)
      const holderIds = ((ids ?? []) as Array<{ person_id: number }>).map((x) => x.person_id)
      if (holderIds.length === 0) continue
      const { data: holders } = await sb.from('crm_people').select('id,tags').in('id', holderIds)

      for (const p of (holders ?? []) as Array<{ id: number; tags: string[] | null }>) {
        const next = [...new Set([...(p.tags ?? []), ...tags])]
        const { error: tagErr } = await sb
          .from('crm_people')
          .update({ tags: next, updated_at: new Date().toISOString() })
          .eq('id', p.id)
        if (tagErr) throw new Error(`tagging ${p.id} failed: ${tagErr.message}`)

        // addSuppression is the canonical writer — it also removes the contact
        // from the Meta custom audience, where a DNC contact must not sit. It
        // plain-inserts (crm_suppressions has no unique constraint to conflict
        // on, which is why a raw upsert failed silently), so we check first.
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
        out.contactsFlagged++
      }
    }
    log(`batch ${i / MAX_PHONES_PER_REQUEST + 1}: asked ${batch.length}, answered ${results.length}`)
  }

  return out
}

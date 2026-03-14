/**
 * Pre-compute CMA valuations for active listings. Step 14.
 * Triggered after sync (when closings) and on daily cron. Batches of 50.
 */

import { inngest } from '@/lib/inngest'
import { createClient } from '@supabase/supabase-js'
import { computeCMA } from '@/lib/cma'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

const BATCH_SIZE = 50
const MAX_AGE_MS = 24 * 60 * 60 * 1000

export const precomputeCMA = inngest.createFunction(
  {
    id: 'cma/precompute-all',
    name: 'Precompute CMA valuations',
    retries: 1,
    concurrency: { limit: 1 },
  },
  [
    { event: 'cma/precompute-all' },
    { cron: '0 3 * * *' },
  ],
  async ({ step }) => {
    const supabase = getServiceSupabase()
    const cutoff = new Date(Date.now() - MAX_AGE_MS).toISOString()

    const active: string[] = (await step.run('fetch-active-properties', async () => {
      const { data } = await supabase
        .from('listings')
        .select('property_id')
        .not('property_id', 'is', null)
        .or('standard_status.ilike.%Active%,standard_status.ilike.%Pending%,standard_status.ilike.%For Sale%')
      const ids = new Set<string>()
      for (const row of data ?? []) {
        const id = (row as { property_id: string }).property_id
        if (id) ids.add(id)
      }
      return Array.from(ids)
    })) ?? []

    const toCompute = await step.run('filter-stale', async () => {
      if (active.length === 0) return []
      const { data: existing } = await supabase
        .from('valuations')
        .select('property_id, computed_at')
        .in('property_id', active)
      const byProp = new Map<string, string>()
      for (const row of existing ?? []) {
        const r = row as { property_id: string; computed_at: string }
        const prev = byProp.get(r.property_id)
        if (!prev || r.computed_at > prev) byProp.set(r.property_id, r.computed_at)
      }
      return active.filter((id) => {
        const at = byProp.get(id)
        return !at || at < cutoff
      })
    })

    let computed = 0
    let skipped = 0
    let failed = 0
    const batch = toCompute.slice(0, BATCH_SIZE)

    for (const propertyId of batch) {
      const result = await step.run(`cma-${propertyId}`, async () => {
        try {
          const out = await computeCMA(propertyId)
          if (!out) return { status: 'failed' as const }
          return { status: 'computed' as const }
        } catch {
          return { status: 'failed' as const }
        }
      })
      if (result.status === 'computed') computed += 1
      else if (result.status === 'failed') failed += 1
    }
    skipped = toCompute.length - batch.length

    return {
      valuationsComputed: computed,
      skipped: skipped,
      failed,
      totalCandidates: toCompute.length,
    }
  }
)

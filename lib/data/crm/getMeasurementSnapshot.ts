/**
 * P12 measurement snapshot — first-broker-action stamps + reply latency for
 * admin surfaces (Matt lock: full including admin surfaces).
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { replyLatencySeconds } from '@/lib/crm/first-broker-action'

export type MeasurementPersonRow = {
  id: number
  name: string | null
  assigned_broker: string | null
  source: string | null
  created_at: string
  first_broker_action_at: string | null
  first_broker_action_kind: string | null
  reply_latency_seconds: number | null
}

export type MeasurementSnapshot = {
  stampedLast7d: number
  unstampedLeadsLast7d: number
  medianLatencySeconds: number | null
  recent: MeasurementPersonRow[]
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? Math.round((s[mid - 1]! + s[mid]!) / 2) : s[mid]!
}

export async function getMeasurementSnapshot(opts?: {
  limit?: number
}): Promise<MeasurementSnapshot> {
  const sb = createServiceClient()
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await sb
    .from('crm_people')
    .select('id,name,assigned_broker,source,created_at,custom,deleted,stage')
    .eq('deleted', false)
    .neq('stage', 'Trash')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[getMeasurementSnapshot]', error.message)
    throw new Error(`getMeasurementSnapshot failed: ${error.message}`)
  }

  const rows = (data ?? []) as Array<{
    id: number
    name: string | null
    assigned_broker: string | null
    source: string | null
    created_at: string
    custom: Record<string, unknown> | null
  }>

  let stampedLast7d = 0
  let unstampedLeadsLast7d = 0
  const latencies: number[] = []
  const recent: MeasurementPersonRow[] = []

  for (const r of rows) {
    const custom = r.custom ?? {}
    const stamped =
      typeof custom.first_broker_action_at === 'string' ? custom.first_broker_action_at : null
    const kind =
      typeof custom.first_broker_action_kind === 'string' ? custom.first_broker_action_kind : null
    const latency = replyLatencySeconds({
      created_at: r.created_at,
      custom,
    })
    if (stamped) {
      stampedLast7d += 1
      if (latency != null) latencies.push(latency)
    } else {
      unstampedLeadsLast7d += 1
    }
    if (recent.length < limit) {
      recent.push({
        id: r.id,
        name: r.name,
        assigned_broker: r.assigned_broker,
        source: r.source,
        created_at: r.created_at,
        first_broker_action_at: stamped,
        first_broker_action_kind: kind,
        reply_latency_seconds: latency,
      })
    }
  }

  return {
    stampedLast7d,
    unstampedLeadsLast7d,
    medianLatencySeconds: median(latencies),
    recent,
  }
}

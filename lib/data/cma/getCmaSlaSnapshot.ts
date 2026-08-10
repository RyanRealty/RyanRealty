/**
 * CMA delivery SLA reader (P12 measurement — Matt lock: full surfaces).
 *
 * For finalized/delivered CMAs created in the last 30 days, report how long
 * from create → delivered_at (send stamp). Surfaces the median and open backlog.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export type CmaSlaRow = {
  id: string
  slug: string
  address: string | null
  clientName: string | null
  status: string
  createdAt: string
  deliveredAt: string | null
  createToDeliverSeconds: number | null
}

export type CmaSlaSnapshot = {
  windowDays: number
  deliveredCount: number
  openFinalizedCount: number
  medianCreateToDeliverSeconds: number | null
  p90CreateToDeliverSeconds: number | null
  recent: CmaSlaRow[]
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? Math.round((s[mid - 1]! + s[mid]!) / 2) : s[mid]!
}

function p90(nums: number[]): number | null {
  if (nums.length === 0) return null
  const s = [...nums].sort((a, b) => a - b)
  const idx = Math.min(s.length - 1, Math.floor(s.length * 0.9))
  return s[idx]!
}

export async function getCmaSlaSnapshot(opts?: {
  windowDays?: number
  limit?: number
}): Promise<CmaSlaSnapshot> {
  const windowDays = Math.min(Math.max(opts?.windowDays ?? 30, 7), 90)
  const limit = Math.min(Math.max(opts?.limit ?? 15, 1), 50)
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()
  const sb = createServiceClient()

  const { data, error } = await sb
    .from('cmas')
    .select(
      'id, slug, subject_address, client_name, status, created_at, delivered_at',
    )
    .gte('created_at', since)
    .in('status', ['finalized', 'delivered', 'published'])
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) {
    console.error('[getCmaSlaSnapshot]', error.message)
    throw new Error(`getCmaSlaSnapshot failed: ${error.message}`)
  }

  const latencies: number[] = []
  let deliveredCount = 0
  let openFinalizedCount = 0
  const recent: CmaSlaRow[] = []

  for (const r of data ?? []) {
    const createdAt = String(r.created_at)
    const deliveredAt = (r.delivered_at as string | null) ?? null
    let secs: number | null = null
    if (deliveredAt) {
      deliveredCount += 1
      const a = Date.parse(createdAt)
      const b = Date.parse(deliveredAt)
      if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
        secs = Math.round((b - a) / 1000)
        latencies.push(secs)
      }
    } else if (String(r.status) === 'finalized') {
      openFinalizedCount += 1
    }
    if (recent.length < limit) {
      recent.push({
        id: String(r.id),
        slug: String(r.slug),
        address: (r.subject_address as string | null) ?? null,
        clientName: (r.client_name as string | null) ?? null,
        status: String(r.status),
        createdAt,
        deliveredAt,
        createToDeliverSeconds: secs,
      })
    }
  }

  return {
    windowDays,
    deliveredCount,
    openFinalizedCount,
    medianCreateToDeliverSeconds: median(latencies),
    p90CreateToDeliverSeconds: p90(latencies),
    recent,
  }
}

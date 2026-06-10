'use server'

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Deal dashboard data — SkySlope transaction snapshot.
 *
 * Production path: public.skyslope_transactions + skyslope_dashboard_meta,
 * populated by scripts/skyslope-sync-dashboard.mjs (service role).
 * Dev fallback: tmp/skyslope-master/master.json (the generator output) so the
 * dashboard renders before the migration is applied. The fallback never runs
 * in production builds.
 */

export type DealActivity = { name: string; status: string | null; docCount: number }

export type DealCycle = {
  kind: 'sales' | 'listings'
  guid: string
  guid8: string
  status: string
  broker: string | null
  mlsNumber: string | null
  salePrice: number | null
  listingPrice: number | null
  officeGross: number | null
  commissionPercent: number | null
  escrowNumber: string | null
  escrowCompany: string | null
  sellers: string[]
  buyers: string[]
  contractAcceptanceDate: string | null
  escrowClosingDate: string | null
  actualClosingDate: string | null
  expirationDate: string | null
  createdOn: string | null
  deadDate: string | null
  checklist: {
    activityCount: number
    filledCount: number
    emptyCount: number
    statusHist: Record<string, number>
    emptyActivities: string[]
    activities?: DealActivity[]
  }
  requiredOpen: string[]
  docs: {
    total: number
    live: number
    archived: number
    brokerNotes: string[]
    unassignedLive: number
  }
  brokerNotesState: 'ok' | 'needs_regeneration' | 'refresh_suggested' | 'MISSING' | 'none'
  bnIssues: string[]
  complianceFlags: Array<{ flag: string; severity: string }>
  docGaps: Array<{ gap: string; cls: string; fix: string }>
}

export type DealProperty = {
  key: string
  address: string
  broker: string | null
  stage: 'pending' | 'active_listing' | 'pre_contract' | 'closed' | 'dead'
  stageDetail: string
  zombie: string | null
  headline: DealCycle
  cycles: DealCycle[]
  rollup: {
    folderCount: number
    openFlagCount: number
    docGapCount: number
    bnActionCount: number
    complianceState: 'clean' | 'action_needed' | 'legal_flag'
  }
}

export type DealDashboardData = {
  properties: DealProperty[]
  totals: {
    properties: number
    saleFolders: number
    listingFolders: number
    closedDeals: number
    byYear: Record<string, { count: number; volume: number; gross: number }>
  }
  systemFindings: string[]
  bnReview: { total: number; clean: number; minor: number; needsCorrection: number } | null
  generatedAt: string | null
  syncedAt: string | null
  source: 'supabase' | 'local-file' | 'empty'
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

function loadLocalMaster(): DealDashboardData | null {
  if (process.env.NODE_ENV === 'production') return null
  const p = path.join(process.cwd(), 'tmp/skyslope-master/master.json')
  if (!existsSync(p)) return null
  try {
    const m = JSON.parse(readFileSync(p, 'utf8'))
    return {
      properties: m.properties,
      totals: m.totals,
      systemFindings: m.systemFindings ?? [],
      bnReview: m.brokerNotesReview ?? null,
      generatedAt: m.generatedAt ?? null,
      syncedAt: null,
      source: 'local-file',
    }
  } catch {
    return null
  }
}

export async function getDealDashboard(): Promise<DealDashboardData> {
  const empty: DealDashboardData = {
    properties: [],
    totals: { properties: 0, saleFolders: 0, listingFolders: 0, closedDeals: 0, byYear: {} },
    systemFindings: [],
    bnReview: null,
    generatedAt: null,
    syncedAt: null,
    source: 'empty',
  }

  const supabase = getServiceSupabase()
  if (supabase) {
    const [{ data: rows, error: rowsError }, { data: meta }] = await Promise.all([
      supabase.from('skyslope_transactions').select('*'),
      supabase.from('skyslope_dashboard_meta').select('*').eq('id', 1).maybeSingle(),
    ])
    if (!rowsError && rows && rows.length > 0) {
      const properties: DealProperty[] = rows.map((r) => ({
        key: r.property_key,
        address: r.address,
        broker: r.broker,
        stage: r.stage,
        stageDetail: r.stage_detail ?? '',
        zombie: r.zombie,
        headline: r.headline,
        cycles: r.cycles,
        rollup: r.rollup,
      }))
      const stageRank: Record<string, number> = { pending: 0, active_listing: 1, pre_contract: 2, closed: 3, dead: 4 }
      properties.sort(
        (a, b) =>
          (stageRank[a.stage] ?? 9) - (stageRank[b.stage] ?? 9) ||
          (b.headline?.actualClosingDate || b.headline?.createdOn || '').localeCompare(
            a.headline?.actualClosingDate || a.headline?.createdOn || ''
          )
      )
      return {
        properties,
        totals: meta?.totals ?? empty.totals,
        systemFindings: meta?.system_findings ?? [],
        bnReview: meta?.bn_review ?? null,
        generatedAt: meta?.generated_at ?? null,
        syncedAt: rows[0]?.synced_at ?? meta?.synced_at ?? null,
        source: 'supabase',
      }
    }
  }

  return loadLocalMaster() ?? empty
}


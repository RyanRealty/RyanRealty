'use server'

import { createClient } from '@supabase/supabase-js'

export type OptimizationRunRow = {
  id: string
  run_at: string
  findings: string[] | null
  suggested_changes: string[] | null
  summary: string | null
}

export async function getLastOptimizationRun(): Promise<OptimizationRunRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  const supabase = createClient(url, key)
  const { data } = await supabase
    .from('optimization_runs')
    .select('id, run_at, findings, suggested_changes, summary')
    .order('run_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data as OptimizationRunRow | null
}

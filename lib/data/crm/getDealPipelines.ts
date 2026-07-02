import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'
import { DEAL_PIPELINES } from '@/lib/crm/deal-pipelines'

/**
 * getDealPipelines — the DB-backed pipeline + stage config for the Deals Kanban
 * (spec §10 / §20.1–20.2, migration 20260701230000_crm_deal_pipelines).
 *
 * Replaces the static lib/crm/deal-pipelines module as the RUNTIME source of the
 * board's columns: §9 Manage Pipelines and §10 Add-a-stage make the config
 * mutable (owner-only), so the board must read live rows. The static module
 * remains as the seed mirror + type home + empty-table fallback.
 *
 * Cached under the 'crm-deal-pipelines' tag; every pipeline/stage mutation in
 * app/actions/crm-deals.ts revalidates it. DAL boundary (G1): the raw .from()
 * reads live here, inside lib/data/.
 */

export type BoardStage = {
  id: number
  name: string
  color: string
  orderWeight: number
  isClosedStage: boolean
}

export type BoardPipeline = {
  id: number
  name: string
  orderWeight: number
  stages: BoardStage[]
}

async function _getDealPipelines(): Promise<BoardPipeline[]> {
  const sb = createServiceClient()
  const [pipesRes, stagesRes] = await Promise.all([
    sb.from('crm_pipelines').select('id,name,order_weight').order('order_weight').order('id'),
    sb
      .from('crm_deal_stages')
      .select('id,pipeline_id,name,color,order_weight,is_closed_stage')
      .order('order_weight')
      .order('id'),
  ])

  const pipes = pipesRes.data ?? []
  const stages = stagesRes.data ?? []

  if (pipes.length === 0) {
    // Fallback: tables unseeded/unreachable — degrade to the static FUB mirror
    // so the board still renders its columns.
    return DEAL_PIPELINES.map((p, i) => ({
      id: p.id,
      name: p.name,
      orderWeight: (i + 1) * 1000,
      stages: p.stages.map((s, j) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        orderWeight: (j + 1) * 1000,
        isClosedStage: s.closedStage,
      })),
    }))
  }

  return pipes.map((p) => ({
    id: Number(p.id),
    name: String(p.name),
    orderWeight: Number(p.order_weight),
    stages: stages
      .filter((s) => Number(s.pipeline_id) === Number(p.id))
      .map((s) => ({
        id: Number(s.id),
        name: String(s.name),
        color: String(s.color),
        orderWeight: Number(s.order_weight),
        isClosedStage: Boolean(s.is_closed_stage),
      })),
  }))
}

export const getDealPipelines = unstable_cache(_getDealPipelines, ['crm-deal-pipelines'], {
  revalidate: 300,
  tags: ['crm-deal-pipelines'],
})

/** Pure helper: is `stageName` a real stage of `pipelineName` in this config? */
export function pipelineHasStage(
  pipelines: BoardPipeline[],
  pipelineName: string | null | undefined,
  stageName: string,
): boolean {
  if (!pipelineName) return false
  const p = pipelines.find((x) => x.name === pipelineName)
  return !!p && p.stages.some((s) => s.name === stageName)
}

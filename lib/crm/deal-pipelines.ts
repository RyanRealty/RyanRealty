/**
 * Deal pipeline + stage configuration — the canonical, ordered stage columns for
 * the Deals Kanban board (FUB parity, delivery #3, spec §10).
 *
 * SOURCE OF TRUTH: docs/fub-crm-spec/api-export/pipelines.json (the authoritative
 * FUB pipeline export). This module mirrors that file EXACTLY — the same stage
 * names, order (by orderWeight), accent colors, closedStage flags, and pipeline
 * ids. The crm_deals table stores `pipeline` + `stage` as free text whose values
 * match these names verbatim (verified live 2026-07-01: "Buyers"/"Sellers" +
 * "Closed"/"Lost"/"Pending"/"Listed"/"Lost / Terminated"), so the board matches a
 * deal to its column by exact stage-name string equality.
 *
 * The hex accent colors are the FUB stage palette (no 2-color brand-token
 * equivalent); they are applied via inline `style` and this file is listed on
 * .design-token-lint-ignore for that reason — same exception class as
 * components/admin/crm/mobile/avatar-utils.ts.
 *
 * A PLAIN module (NOT 'use server' / 'use client') so both the server page and
 * the client board can import it. No side effects, no runtime fs read.
 */

export type DealStage = {
  /** FUB stage id (from pipelines.json) — stable identity for the column. */
  id: number
  /** Exact stage label — matches crm_deals.stage verbatim. */
  name: string
  /** Accent color (FUB stage palette), applied to the column's top border. */
  color: string
  /** True on the terminal "won" stage — renders the "Closed" header badge and drives reporting. */
  closedStage: boolean
}

export type DealPipeline = {
  /** FUB pipeline id (Buyers=1, Sellers=2). */
  id: number
  /** Exact pipeline label — matches crm_deals.pipeline verbatim. */
  name: string
  /** Stages in left-to-right (orderWeight) order. */
  stages: DealStage[]
}

/**
 * Buyers + Sellers, in tab order (Buyers first), each with its stages in
 * orderWeight order. Mirrors pipelines.json byte-for-byte on the fields we use.
 */
export const DEAL_PIPELINES: readonly DealPipeline[] = [
  {
    id: 1,
    name: 'Buyers',
    stages: [
      { id: 47, name: 'Start (temp stage)', color: '#F3B942', closedStage: false },
      { id: 19, name: 'Buyer Contract', color: '#ffad81', closedStage: false },
      { id: 21, name: 'Offer', color: '#819cff', closedStage: false },
      { id: 23, name: 'Pending', color: '#ffcc44', closedStage: false },
      { id: 25, name: 'Closed', color: '#4ad09f', closedStage: true },
      { id: 39, name: 'Lost', color: '#ff8181', closedStage: false },
    ],
  },
  {
    id: 2,
    name: 'Sellers',
    stages: [
      { id: 48, name: 'Start (temp stage)', color: '#F3B942', closedStage: false },
      { id: 49, name: 'Pre-Listing', color: '#819cff', closedStage: false },
      { id: 20, name: 'Listed', color: '#ffad81', closedStage: false },
      { id: 22, name: 'Offer', color: '#819cff', closedStage: false },
      { id: 24, name: 'Pending', color: '#ffcc44', closedStage: false },
      { id: 26, name: 'Closed', color: '#4ad09f', closedStage: true },
      { id: 28, name: 'Lost / Terminated', color: '#ff8181', closedStage: false },
    ],
  },
] as const

/** Pipeline labels in tab order — ['Buyers', 'Sellers']. */
export const DEAL_PIPELINE_NAMES: readonly string[] = DEAL_PIPELINES.map((p) => p.name)

/** Resolve a pipeline config by its exact name (crm_deals.pipeline value). */
export function getDealPipeline(name: string | null | undefined): DealPipeline | undefined {
  if (!name) return undefined
  return DEAL_PIPELINES.find((p) => p.name === name)
}

/**
 * True when `stageName` is a real stage of `pipelineName`. Used by the restage
 * action to reject a drag target that isn't a column the pipeline renders.
 */
export function isKnownStage(pipelineName: string | null | undefined, stageName: string): boolean {
  const p = getDealPipeline(pipelineName)
  return !!p && p.stages.some((s) => s.name === stageName)
}

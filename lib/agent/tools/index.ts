/**
 * lib/agent/tools/index.ts — assembles the full broker SMS agent tool set.
 *
 * Core DAL tools (market/listings/comps/crm) are built here; produce/gmail
 * -asset/law tools are built by other workers in parallel per
 * docs/plans/BROKER_SMS_AGENT_2026-07-31.md R2.2/R2.5-R2.11/R4.2. Every
 * module exports the same factory shape — `export function xTools(ctx:
 * AgentContext): AgentTool[]` — so this file only ever assembles, never
 * implements. Once every sibling module exists, this file needs no changes.
 */
import type { AgentContext, AgentTool } from '@/lib/agent/types'
import { marketTools } from './market'
import { listingsTools } from './listings'
import { compsTools } from './comps'
import { crmTools } from './crm'
import { gmailAssetTools } from './gmail-assets'
// The produce (create_action/run_now/revise_action/approve_action/hold/
// job_status) and law (law_lookup) tool modules are owned by other workers
// building in parallel and may not exist yet — expected during the parallel
// build-out described in the mission brief. Once they land, no change is
// needed here.
import { produceTools } from './produce'
import { lawTools } from './law'

export function getAgentTools(ctx: AgentContext): AgentTool[] {
  return [
    ...marketTools,
    ...listingsTools,
    ...compsTools,
    ...crmTools,
    ...produceTools(ctx),
    ...gmailAssetTools(ctx),
    ...lawTools(ctx),
  ]
}

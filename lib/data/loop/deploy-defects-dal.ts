/**
 * Deploy-defect filing, bound to the work-graph DAL. Server only.
 * reachability: entry-point scripts/deploy-defects.ts (run under `npx tsx --conditions=react-server`)
 *
 * Every read and write goes through lib/data/loop/work-graph.ts: filing is
 * createWorkNode, a claim is claimWorkNode, a close is claimWorkNode then
 * completeWorkNode (done is only reachable from in_progress, and
 * completeWorkNode refuses done without evidence). Nothing here touches the
 * table directly, and nothing writes a claim by hand.
 */
import 'server-only'

import {
  claimWorkNode,
  completeWorkNode,
  createWorkNode,
  readWorkNodesByGap,
  releaseWorkNode,
} from './work-graph'
import { DEPLOY_GAP_PREFIX, type DeployDefectOps } from './deploy-defects'

export function deployDefectOps(): DeployDefectOps {
  return {
    async list() {
      const res = await readWorkNodesByGap(DEPLOY_GAP_PREFIX)
      if (res.error || !res.data) throw new Error(res.error ?? 'work graph read returned nothing')
      return res.data
    },
    async create(draft) {
      const res = await createWorkNode(draft)
      return { id: res.data?.id ?? null, error: res.error }
    },
    async claim(id, owner) {
      const res = await claimWorkNode(id, owner)
      return { ok: Boolean(res.data), error: res.error }
    },
    async complete(id, evidence) {
      const res = await completeWorkNode({ id, evidence })
      return { ok: Boolean(res.data), error: res.error }
    },
    async release(id) {
      const res = await releaseWorkNode(id)
      return { ok: Boolean(res.data), error: res.error }
    },
  }
}

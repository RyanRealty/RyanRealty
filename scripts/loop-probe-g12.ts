/**
 * Environment evidence for G12: the video docket is complete and pending M3.
 *
 *   npx tsx scripts/loop-probe-g12.ts
 */
import { readVideoDecisionDocket, videoDocketComplete } from '../lib/data/loop/video-docket'

const docket = readVideoDecisionDocket()
const complete = videoDocketComplete(docket)
const out = {
  complete,
  status: docket.status,
  decision: docket.decision.status,
  parkUsd: docket.park.incrementalVendorUsd,
  rebuildTurboPer1k: docket.rebuild.elevenLabsTurboUsdPer1kChars,
  rebuildCapPerRow: docket.rebuild.producerCapPerRowUsd,
  rebuildCapPerRun: docket.rebuild.producerCapPerRunUsd,
  deadSafeZoneImports: docket.inventory.deadSafeZoneImports,
  decommissionedProducers: docket.inventory.decommissionedProducers,
  remotionConfigs: docket.inventory.remotionConfigs,
  mp4OnDisk: docket.inventory.mp4OnDisk,
  source: docket.source,
}
console.log(JSON.stringify(out, null, 2))
if (!complete || docket.status !== 'ok') process.exit(1)

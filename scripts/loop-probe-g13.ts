/**
 * Environment evidence for G13: unknown-health count is 0.
 *
 *   npx tsx scripts/loop-probe-g13.ts
 */
import { integrationHealthComplete, readIntegrationHealth } from '../lib/data/loop/integration-health'

const probes = readIntegrationHealth()
const complete = integrationHealthComplete(probes)
const out = {
  complete,
  status: probes.status,
  unknownCount: probes.unknownCount,
  probedCount: probes.probedCount,
  greenCount: probes.greenCount,
  parkCount: probes.parkCount,
  rows: probes.rows.map((r) => ({
    id: r.id,
    health: r.health,
    disposition: r.disposition,
    httpStatus: r.httpStatus,
  })),
  source: probes.source,
}
console.log(JSON.stringify(out, null, 2))
if (!complete || probes.status !== 'ok' || probes.unknownCount !== 0) process.exit(1)

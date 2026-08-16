/**
 * Environment evidence for G15: FILTER_COMPLETENESS accept is complete.
 *
 *   npx tsx scripts/loop-probe-g15.ts
 */
import { readSearchCompletenessAccept, searchCompletenessComplete } from '../lib/data/loop/search-completeness'

const accept = readSearchCompletenessAccept()
const complete = searchCompletenessComplete(accept)
const out = {
  complete,
  status: accept.status,
  versionGap: accept.versionGap,
  acceptIds: accept.acceptItems.map((i) => `${i.id}:${i.disposition}`),
  longTailDisposed: accept.longTail.disposedCount,
  unexplained: accept.longTail.unexplainedCount,
  ttfbHomesForSaleMs: accept.perf.p75.ttfbHomesForSaleMs,
  ttfbBendMs: accept.perf.p75.ttfbBendMs,
  samples: accept.perf.samples,
  recordedAt: accept.recordedAt,
  source: accept.source,
}
console.log(JSON.stringify(out, null, 2))
if (!complete || accept.status !== 'ok') process.exit(1)

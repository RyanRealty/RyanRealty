import 'server-only'
import { after } from 'next/server'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS } from '@/lib/data/cache/unstable-cache'
import { readSubdivisionRing, type SubdivisionRing } from '@/lib/data/geo/subdivision-ring'

/**
 * getSubdivisionRing for the /subdivisions/[slug] page, cached (P3 — DATA-6,
 * SEO-2, EXP-7, 2026-09-23).
 *
 * WHY. `cma_subdivision_ring` measures every recorded plat polygon against the
 * home plat as geography, which no index serves. P3 harness, three uncached
 * calls per plat centroid, 2026-09-23: 3.7 to 16.1 s for the ten plats that
 * answered HTTP 500 on every live fetch (elkai-woods 8.4 to 11.2 s,
 * blakley-heights 10.1 to 16.1 s, saddleback 4.0 to 6.1 s, royal-oaks-estates-
 * phase-ii 3.7 to 3.8 s; three hours earlier the same plats took 3.9 to 6.6 s),
 * against 1.0 s for ponderosa-pines and 1.9 to 2.7 s for tetherow-phase-1,
 * which answered 200. The page read it uncached on every render, under a 3.5 s
 * budget, so those plats degraded on every render, and a degraded render was an
 * HTTP 500 until lib/site/degraded-isr.ts stopped calling noStore().
 *
 * The answer depends only on the point and the recorded plat polygons, which
 * change when the county plat refresh runs, so one read per point per day is
 * plenty. The point is the plat's listing centroid, rounded to 1e-6 degrees
 * (about 0.1 m) so float noise does not split the cache key.
 *
 * The CMA comp ladders keep calling getSubdivisionRing directly; their subject
 * points are one-off addresses a cache would not serve.
 */
const cachedRing = makeResilientCached(
  (lat: number, lng: number) => readSubdivisionRing(lat, lng),
  ['subdivision-ring-v1'],
  { revalidate: CACHE_WINDOWS.taxlots, tags: ['boundaries'] },
  null as SubdivisionRing | null,
)

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

export async function getSubdivisionRingCached(
  lat: number | null,
  lng: number | null,
): Promise<SubdivisionRing | null> {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const read = cachedRing(round6(lat), round6(lng))
  finishAfterResponse(read)
  return read
}

/**
 * A SLOW RING COSTS ONE DEGRADED RENDER, NOT A RUN OF THEM. The page races this
 * read against a budget, and the RPC can outlast any budget a page can afford
 * (16.1 s above). When the budget wins, the render ends without the ring, and a
 * serverless function is released once its response and its waitUntil work are
 * done, so the read would be cut off before unstable_cache stored it and every
 * later render would pay the same seconds and degrade the same way.
 *
 * after() with a function holds the invocation open until the read settles,
 * and Next awaits the cache write that settling registers
 * (next/dist/server/after/after-context.js runCallbacks, through
 * withExecuteRevalidates). The degraded copy stands for
 * DEGRADED_ISR_REVALIDATE_S (lib/site/degraded-isr.ts), and the render after it
 * reads the ring from cache. (One window stays open: a read that settles after
 * the render's own pending writes were collected but before the response
 * closes registers its write outside both; that costs one more degraded render
 * at most.) after() is not a dynamic API, so it leaves the
 * route on ISR. Outside a request scope (tests, scripts) after() throws; there
 * is nothing to hold open, so that is dropped.
 */
function finishAfterResponse(read: Promise<unknown>): void {
  try {
    after(async () => {
      await read.catch(() => null)
    })
  } catch {
    // no request scope
  }
}

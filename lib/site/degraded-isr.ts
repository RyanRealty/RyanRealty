/**
 * SITE-118 — a degraded place-page render must not stand as the ISR copy.
 *
 * Place pages race published-section reads through `withTimeoutFallback`. On a
 * cold or contended DB the fallback is empty/thin, and `revalidate = 300|3600`
 * used to persist that thin HTML for the whole window (PR #252 CI: /cities
 * atlas empty, featured-cities thinner, jsonLd short; under load /zip/97702
 * lost half its sections).
 *
 * Mechanism:
 *   1. `runPublishedPageRender` opens a request-scoped bag.
 *   2. `withTimeoutFallback` notes every timeout/error while the bag is open
 *      (chrome / sitemap / API callers stay untracked — they never open one).
 *   3. A degraded render SHORTENS its own ISR lifetime to
 *      DEGRADED_ISR_REVALIDATE_S (see refuseDegradedIsr). The thin copy is
 *      served, and the first request after that window regenerates it.
 *   4. `next build`: stretch the timeout 3×, then retry the whole page once. A
 *      prerender still thin after the retry is logged, ships with the same
 *      short lifetime, and `ci:route-content-floor` keeps failing it.
 *
 * WHY NOT unstable_noStore() (P3 — DATA-6, DATA-1, SEO-2, EXP-7, 2026-09-23).
 * This file called `noStore()` at runtime from 2026-09-16 to 2026-09-23, and in
 * Next 16 that is a 500, not an opt-out. Inside a runtime ISR render the work
 * unit is `prerender-legacy`: `noStore()` sets its revalidate to 0 and throws
 * (next/dist/server/app-render/dynamic-rendering.js markCurrentScopeAsDynamic)
 *   Error: Dynamic server usage: Route /subdivisions/[slug] couldn't be
 *   rendered statically because it used unstable_noStore(). See more info
 *   here: https://nextjs.org/docs/messages/dynamic-server-error
 * (E550, digest DYNAMIC_SERVER_USAGE; production logs it redacted as "An error
 * occurred in the Server Components render..." with that digest). It escaped
 * runPublishedPageRender, so the render failed and Next served its built-in
 * "500: Internal Server Error." document. An ISR route cannot become dynamic
 * per request; the only outcomes are a cached copy or a 500.
 *   - /subdivisions/[slug] prerendered nothing, so every cold render that
 *     degraded was an HTTP 500 to the visitor. Ten plats that 500'd on every
 *     live fetch on 2026-09-23 (elkai-woods, blakley-heights, saddleback,
 *     waywest-properties, cottonwood-condominium, ...) all degraded on
 *     sub:nearbyRing: cma_subdivision_ring took 3.9 to 6.6 s against its 3.5 s
 *     budget, while cold plats that answered 200 degraded on nothing (P3
 *     harness over the base page). Under crawler concurrency any read could
 *     tip over its budget, hence the transient 500s on other plats.
 *   - /cities, /communities and the neighborhood pages serve their last good
 *     copy STALE, so a degraded background regeneration failed silently into
 *     the render-error log instead.
 * Reproduced on a minimal Next 16.1.6 production build (`next start`): this
 * file's 2026-09-16 version with one degraded read answered 500 with the E550
 * error above; the current version answered 200 with `s-maxage=60`.
 * ci:degraded-isr refuses noStore in this file.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { unstable_cache } from '@/lib/data/cache/next-cache'

export type DegradedIsrBag = {
  pageLabel: string
  labels: string[]
}

/**
 * The most a degraded render may stand as the ISR copy, in seconds. One
 * minute: long enough that a contended database is not asked to re-render the
 * same thin page on every hit, short enough that the full page is back before
 * a crawler that saw the thin one is likely to return.
 */
export const DEGRADED_ISR_REVALIDATE_S = 60

const store = new AsyncLocalStorage<DegradedIsrBag>()

export function isProductionBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build'
}

export function publishedRenderActive(): boolean {
  return store.getStore() != null
}

export function publishedDegrades(): string[] {
  return store.getStore()?.labels.slice() ?? []
}

export function notePublishedDegrade(label: string): void {
  const bag = store.getStore()
  if (!bag) return
  if (!bag.labels.includes(label)) bag.labels.push(label)
}

/**
 * The lever. Next lowers the enclosing render's revalidate to the smallest
 * `revalidate` of any unstable_cache read inside it
 * (next/dist/server/web/spec-extension/unstable-cache.js, the
 * `prerender-legacy` branch), which is the public way to say "this copy is
 * short-lived" without making an ISR route dynamic. The cached value is the
 * label itself: nothing reads it, and the entry is a few bytes per page class.
 */
const markShortLived = unstable_cache(
  async (pageLabel: string) => pageLabel,
  ['degraded-isr-short-lived-v1'],
  { revalidate: DEGRADED_ISR_REVALIDATE_S, tags: ['degraded-isr'] },
)

/**
 * Keep a degraded render from standing as the ISR copy for the page's whole
 * window: its lifetime drops to DEGRADED_ISR_REVALIDATE_S. Never throws, and
 * never opts the render out of ISR (see the header: in Next 16 that is a 500).
 * Awaited, because Next records the shorter lifetime after an internal await.
 */
export async function refuseDegradedIsr(pageLabel: string, labels: readonly string[]): Promise<void> {
  if (labels.length === 0) return
  if (isProductionBuildPhase()) {
    console.warn(
      `[degraded-isr:${pageLabel}] prerender still degraded after retry; shipping it with a ${DEGRADED_ISR_REVALIDATE_S}s ISR lifetime (${labels.join(', ')})`,
    )
  } else {
    console.warn(
      `[degraded-isr:${pageLabel}] degraded render, ISR copy limited to ${DEGRADED_ISR_REVALIDATE_S}s (${labels.join(', ')})`,
    )
  }
  try {
    await markShortLived(pageLabel)
  } catch (err) {
    // Outside a Next render there is no incremental cache to shorten; the page
    // must still render, so this is logged and dropped.
    console.warn(`[degraded-isr:${pageLabel}] could not shorten the ISR lifetime`, err)
  }
}

export async function runPublishedPageRender<T>(pageLabel: string, render: () => Promise<T>): Promise<T> {
  const runOnce = async (): Promise<{ value: T; labels: string[] }> => {
    const bag: DegradedIsrBag = { pageLabel, labels: [] }
    return store.run(bag, async () => {
      const value = await render()
      return { value, labels: bag.labels.slice() }
    })
  }

  let { value, labels } = await runOnce()

  if (labels.length > 0 && isProductionBuildPhase()) {
    console.warn(
      `[degraded-isr:${pageLabel}] prerender degraded (${labels.join(', ')}); re-rendering before persist`,
    )
    const second = await runOnce()
    value = second.value
    labels = second.labels
    if (labels.length === 0) {
      console.warn(`[degraded-isr:${pageLabel}] prerender recovered on retry`)
      return value
    }
  }

  await refuseDegradedIsr(pageLabel, labels)
  return value
}

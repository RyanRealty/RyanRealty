/**
 * SITE-118 — a degraded place-page render must not become the ISR copy.
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
 *   3. Runtime: `unstable_noStore()` so this render is not written as ISR.
 *      The next request re-renders; a timed-out atlas is never the second copy.
 *   4. `next build`: stretch the timeout 3×, then retry the whole page once.
 *      Do not call `noStore()` during SSG (`dynamicParams = false` pages throw
 *      DYNAMIC_SERVER_USAGE). A prerender that is still thin after retry is
 *      logged; `ci:route-content-floor` keeps failing it.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { unstable_noStore as noStore } from 'next/cache'

export type DegradedIsrBag = {
  pageLabel: string
  labels: string[]
}

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
 * Opt this render out of the Full Route Cache. No-op during `next build`
 * static generation — calling `noStore()` there bails a hard-prerendered
 * page out as DYNAMIC_SERVER_USAGE.
 */
export function refuseDegradedIsr(pageLabel: string, labels: readonly string[]): void {
  if (labels.length === 0) return
  if (isProductionBuildPhase()) {
    console.warn(
      `[degraded-isr:${pageLabel}] prerender still degraded after retry; not persisting thin copy as ISR at runtime (${labels.join(', ')})`,
    )
    return
  }
  console.warn(`[degraded-isr:${pageLabel}] refusing to persist ISR copy (${labels.join(', ')})`)
  noStore()
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

  refuseDegradedIsr(pageLabel, labels)
  return value
}

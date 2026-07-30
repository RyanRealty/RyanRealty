'use client'

import { useEffect } from 'react'

/**
 * StreamedBoundaryReclaimer — reclaims React's streamed Suspense content
 * containers on a tab that never paints.
 *
 * WHY THIS EXISTS
 *
 * Every route on this site renders inside a Suspense boundary (app/loading.tsx
 * plus the per-segment loading.tsx files), so every page takes React's
 * out-of-order streaming path. React streams the shell with the skeleton
 * fallback, then appends the real body in a detached container and asks the
 * browser to swap it in:
 *
 *   <div hidden id="S:0">…the whole page body…</div>
 *   <script>$RC("B:0","S:0")</script>
 *
 * In React 19 `$RC` no longer performs that swap inline. It marks the boundary
 * comment `$~`, pushes the (boundary, content) pair onto the global `$RB`
 * queue, and defers the actual reveal to `$RV`:
 *
 *   2===$RB.length && ("number"!==typeof $RT
 *      ? requestAnimationFrame($RV.bind(null,$RB))
 *      : setTimeout($RV.bind(null,$RB), …))
 *
 * `$RT` is only ever set by `$RV` itself, so the FIRST reveal on any page load
 * is always scheduled on `requestAnimationFrame`. A tab that never paints —
 * a background tab, a restored session tab, a headless renderer, a crawler
 * that runs script without a compositor — never gets that frame. `$RV` never
 * runs, the `<div hidden id="S:n">` containers are never removed, and the page
 * ends up holding two complete copies of its body (measured: 45% of all DOM
 * nodes on /cities/bend, 37% on /faq).
 *
 * Hydration independently resolves the boundary from the flight payload, so
 * the VISIBLE page is correct either way — the stranded containers are pure
 * dead weight, not a rendering bug. On a visible tab the frame arrives in
 * ~16ms and React cleans up on its own; this component never fires there.
 *
 * WHAT THIS DOES
 *
 * Race a `requestAnimationFrame` against a short poll. If a frame arrives,
 * React's own scheduling is healthy and we stand down permanently. If no frame
 * has arrived and `$RB` is holding work, drain it by calling React's own `$RV`
 * with React's own queue — the identical call the rAF callback would make.
 *
 * Draining is safe and idempotent: `$RV` detaches each content node, splices
 * its children into place when the boundary marker is still present, and ends
 * with `a.length = 0`. A late rAF therefore sees an empty queue and no-ops.
 * The first `$RV` run also sets `$RT`, after which React schedules every
 * subsequent reveal on `setTimeout` (which does fire in hidden tabs), so one
 * successful drain makes the rest of the page self-healing.
 *
 * Regression gate: scripts/check-streamed-boundary-reclaimer.mjs.
 */

/** How often to check for a stranded queue, in ms. */
const POLL_MS = 400
/** Give up after this long — a page that has not streamed by now never will. */
const MAX_WAIT_MS = 15_000

type ReactStreamGlobals = {
  /** React's pending-reveal queue: flat [boundaryTemplate, contentNode, …]. */
  $RB?: unknown[]
  /** React's batched reveal function. Drains and empties the queue. */
  $RV?: (queue: unknown[]) => void
}

export default function StreamedBoundaryReclaimer() {
  useEffect(() => {
    // SSR-safe: useEffect never runs on the server, but keep the guard so the
    // module stays importable from any context.
    if (typeof window === 'undefined') return

    let painted = false
    let stopped = false
    let elapsed = 0
    let timer: ReturnType<typeof setInterval> | undefined

    const stop = () => {
      stopped = true
      if (timer !== undefined) {
        clearInterval(timer)
        timer = undefined
      }
    }

    // If the compositor ever gives us a frame, React's own rAF callback runs
    // too (it was queued first) and does the reveal. Nothing left for us.
    const rafId = requestAnimationFrame(() => {
      painted = true
      stop()
    })

    const tick = () => {
      if (stopped || painted) return stop()

      elapsed += POLL_MS
      if (elapsed >= MAX_WAIT_MS) return stop()

      const w = window as unknown as ReactStreamGlobals
      const queue = w.$RB
      if (!Array.isArray(queue) || queue.length === 0) return
      if (typeof w.$RV !== 'function') return

      try {
        w.$RV(queue)
      } catch {
        // React's internals are versioned and undocumented. If the shape ever
        // changes, fall back to leaving the containers alone rather than
        // throwing inside a layout-level effect.
        return stop()
      }

      // $RV set $RT, so every later boundary schedules on setTimeout, which
      // fires in hidden tabs. We are done for the life of this document.
      stop()
    }

    timer = setInterval(tick, POLL_MS)

    return () => {
      cancelAnimationFrame(rafId)
      stop()
    }
  }, [])

  return null
}

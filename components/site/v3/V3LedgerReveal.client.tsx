'use client'

/**
 * The client half of the Ledger's reveal (site queue SITE-52, scrub SITE-92 r5).
 *
 * A row with `reveal` shows one line the row's text does not carry — the
 * months-of-supply verdict, a twelve-month run of closes — on hover and on
 * keyboard focus, which CSS handles alone in V3Ledger.css. A phone has neither,
 * so this island gives it TAP-AND-HOLD: press a row for HOLD_MS and its reveal
 * opens in place; the tap that would have followed the row is swallowed once,
 * so a hold never also navigates. A tap anywhere else closes it. Everything
 * else about the row — that it is one link, that it works before hydration —
 * is untouched: this island renders a plain wrapper and attaches listeners
 * after mount.
 *
 * THE SCRUB (SITE-92 round 5). When the run carries the months (V3Ledger.tsx
 * writes them on the run as `data-points`, one [label, value] per series
 * entry, and draws one hidden mark per PUBLISHED point with its index), the
 * chart answers a question instead of only showing a shape:
 *
 *  - a pointer over the run names the published mark nearest to it;
 *  - ArrowLeft / ArrowRight / Home / End on the focused row step through the
 *    marks (the row is the focusable link, so the keys land here);
 *  - the moment a reveal opens — hover, focus, or the hold — the endpoint is
 *    seated, so the readout is never an empty slot.
 *
 * Naming a mark moves the cursor line to its x, shows that one mark, and
 * writes "<label> · <value>" into the readout — two strings the caller
 * formatted, joined; the island computes no figure. Nothing here is state
 * React owns: attributes on the run and the marks, read back by V3Ledger.css.
 *
 * WHY POINTER EVENTS AND A TIMER, not a button. A control inside a link is
 * invalid HTML, and a second tap target on every row would make each row two
 * doors. The hold is the phone's hover, no more.
 *
 * Only mounted when at least one row carries a reveal, so a ledger without one
 * ships no client code for this.
 */

import { useEffect, useRef, type ReactNode } from 'react'

/** Long enough to be a hold, short enough that the OS context menu (~500ms) has not fired. */
export const V3_LEDGER_HOLD_MS = 350

const ITEM = '.v3-ledger__item'
const OPEN = 'data-revealed'
const RUN = '.v3-ledger__run'
const SPARK = '.v3-ledger__spark'
const POINT = '.v3-ledger__spark-pt'
const CURSOR = '.v3-ledger__spark-cursor'
const READOUT = '.v3-ledger__readout'
const SCRUB = 'data-scrub'
const ACTIVE = 'data-active'

type ScrubPoint = [label: string, value: string | null]

/**
 * The scrub's readout text for one point: the caller's label and value,
 * joined. Exported for the unit test; the island computes nothing else.
 */
export function readoutText(point: ScrubPoint | undefined): string {
  if (!point) return ''
  const [label, value] = point
  return value == null ? label : `${label} · ${value}`
}

/**
 * The published mark nearest a viewBox x. Marks are the SVG circles the server
 * drew, so the reader is shown a point the line passes through.
 */
export function nearestMark<T extends { cx: number }>(marks: readonly T[], x: number): T | null {
  let best: T | null = null
  let bestDist = Infinity
  for (const m of marks) {
    const d = Math.abs(m.cx - x)
    if (d < bestDist) {
      bestDist = d
      best = m
    }
  }
  return best
}

function parsePoints(run: HTMLElement): ScrubPoint[] | null {
  const raw = run.dataset.points
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed as ScrubPoint[]
  } catch {
    return null
  }
}

/** The published marks the server drew on a run, oldest first. */
function marksOf(run: HTMLElement): { el: SVGCircleElement; i: number; cx: number }[] {
  return Array.from(run.querySelectorAll<SVGCircleElement>(POINT)).flatMap((el) => {
    const i = Number(el.getAttribute('data-i'))
    const cx = Number(el.getAttribute('cx'))
    return Number.isFinite(i) && Number.isFinite(cx) ? [{ el, i, cx }] : []
  })
}

/** Name one mark on a run: cursor to it, show it, write the readout. */
function nameMark(run: HTMLElement, i: number) {
  const points = parsePoints(run)
  const marks = marksOf(run)
  const mark = marks.find((m) => m.i === i)
  if (!points || !mark) return
  for (const m of marks) {
    if (m.el === mark.el) m.el.setAttribute(ACTIVE, 'true')
    else m.el.removeAttribute(ACTIVE)
  }
  const cursor = run.querySelector<SVGLineElement>(CURSOR)
  if (cursor) {
    cursor.setAttribute('x1', String(mark.cx))
    cursor.setAttribute('x2', String(mark.cx))
  }
  const readout = run.querySelector<HTMLElement>(READOUT)
  if (readout) readout.textContent = readoutText(points[i])
  run.setAttribute(SCRUB, 'true')
  run.dataset.active = String(i)
}

/** The run of an item, when it is scrubbable. */
function scrubRunOf(item: HTMLElement | null): HTMLElement | null {
  const run = item?.querySelector<HTMLElement>(RUN) ?? null
  return run && run.dataset.points ? run : null
}

/** Seat the endpoint the first time a reveal opens, so the readout is never empty. */
function seatEndpoint(run: HTMLElement) {
  if (run.dataset.active != null) return
  const marks = marksOf(run)
  const last = marks[marks.length - 1]
  if (last) nameMark(run, last.i)
}

export function V3LedgerRevealIsland({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return

    let timer: number | null = null
    let startX = 0
    let startY = 0
    let swallowClick = false

    const clearTimer = () => {
      if (timer != null) {
        window.clearTimeout(timer)
        timer = null
      }
    }
    const closeAll = (except?: Element | null) => {
      for (const open of root.querySelectorAll(`[${OPEN}="true"]`)) {
        if (open !== except) open.removeAttribute(OPEN)
      }
    }
    const itemOf = (target: EventTarget | null): HTMLElement | null =>
      target instanceof Element ? target.closest<HTMLElement>(ITEM) : null

    const onPointerDown = (event: PointerEvent) => {
      // Mouse and pen already have hover; the hold is for touch alone.
      if (event.pointerType !== 'touch') return
      const item = itemOf(event.target)
      clearTimer()
      if (!item || !item.querySelector('.v3-ledger__reveal')) return
      startX = event.clientX
      startY = event.clientY
      timer = window.setTimeout(() => {
        timer = null
        closeAll(item)
        item.setAttribute(OPEN, 'true')
        swallowClick = true
        const run = scrubRunOf(item)
        if (run) seatEndpoint(run)
      }, V3_LEDGER_HOLD_MS)
    }
    // A scroll is not a hold.
    const onPointerMove = (event: PointerEvent) => {
      if (timer != null) {
        if (Math.abs(event.clientX - startX) > 8 || Math.abs(event.clientY - startY) > 8) clearTimer()
      }
      // THE SCRUB: a pointer over a scrubbable run names the nearest mark.
      const target = event.target instanceof Element ? event.target : null
      const run = target?.closest<HTMLElement>(RUN) ?? null
      if (!run || !run.dataset.points) return
      const svg = run.querySelector<SVGSVGElement>(SPARK)
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      if (!(rect.width > 0)) return
      const vb = (svg.getAttribute('viewBox') ?? '').split(/\s+/).map(Number)
      const vbW = vb.length === 4 && Number.isFinite(vb[2]) ? vb[2]! : rect.width
      const x = ((event.clientX - rect.left) / rect.width) * vbW
      const mark = nearestMark(marksOf(run), x)
      // The same mark as last time is not a change; nothing to redraw.
      if (mark && run.dataset.active !== String(mark.i)) nameMark(run, mark.i)
    }
    const onPointerEnd = () => clearTimer()
    // Entering a row with the pointer seats the endpoint so the readout is
    // populated before the reader reaches the chart.
    const onPointerOver = (event: PointerEvent) => {
      const item = itemOf(event.target)
      const run = scrubRunOf(item)
      if (run) seatEndpoint(run)
    }
    const onFocusIn = (event: FocusEvent) => {
      const item = itemOf(event.target)
      const run = scrubRunOf(item)
      if (run) seatEndpoint(run)
    }
    // The keys: step through the published marks on the focused row.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const item = itemOf(event.target)
      const run = scrubRunOf(item)
      if (!run) return
      const marks = marksOf(run)
      if (marks.length === 0) return
      const current = run.dataset.active != null ? Number(run.dataset.active) : NaN
      const at = marks.findIndex((m) => m.i === current)
      let next: number | null = null
      if (event.key === 'ArrowRight') next = Math.min(marks.length - 1, at < 0 ? marks.length - 1 : at + 1)
      else if (event.key === 'ArrowLeft') next = Math.max(0, at < 0 ? marks.length - 1 : at - 1)
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = marks.length - 1
      if (next == null) return
      event.preventDefault()
      nameMark(run, marks[next]!.i)
    }
    const onClick = (event: MouseEvent) => {
      if (!swallowClick) return
      swallowClick = false
      event.preventDefault()
      event.stopPropagation()
    }
    // The OS long-press menu on a link, held back only while a hold is live.
    const onContextMenu = (event: Event) => {
      if (timer != null || swallowClick) event.preventDefault()
    }
    const onDocumentPointerDown = (event: PointerEvent) => {
      const item = itemOf(event.target)
      if (!item || !root.contains(item)) closeAll()
    }

    root.addEventListener('pointerdown', onPointerDown)
    root.addEventListener('pointermove', onPointerMove)
    root.addEventListener('pointerover', onPointerOver)
    root.addEventListener('pointerup', onPointerEnd)
    root.addEventListener('pointercancel', onPointerEnd)
    root.addEventListener('focusin', onFocusIn)
    root.addEventListener('keydown', onKeyDown)
    root.addEventListener('click', onClick, true)
    root.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('pointerdown', onDocumentPointerDown)
    return () => {
      clearTimer()
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerover', onPointerOver)
      root.removeEventListener('pointerup', onPointerEnd)
      root.removeEventListener('pointercancel', onPointerEnd)
      root.removeEventListener('focusin', onFocusIn)
      root.removeEventListener('keydown', onKeyDown)
      root.removeEventListener('click', onClick, true)
      root.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('pointerdown', onDocumentPointerDown)
    }
  }, [])

  return (
    <div ref={ref} className="v3-ledger__hold">
      {children}
    </div>
  )
}

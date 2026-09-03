'use client'
/**
 * The selection behaviour for V3CourseMap.
 *
 * The section ships every hole's card as server HTML so the page reads whole
 * with JavaScript off. This island's first act is to mark the section enhanced,
 * which is what lets the CSS collapse eighteen cards down to one; until then the
 * stylesheet leaves them all showing. Nothing here renders content.
 *
 * ONE SELECTION, NOT TWO. Pointing at a hole selects it and leaving does not
 * clear it. A preview-on-hover plus a separate committed selection reads fine
 * with a mouse and breaks under a finger, which fires pointerenter and then
 * pointerleave on the lift — the trap the Atlas readout hit, where a tapped
 * place flashed its name and went blank.
 *
 * It reaches into its own section by class rather than owning the markup,
 * because the drawing is a few hundred paths and re-rendering it from the client
 * would ship the whole geometry a second time.
 */
import { useEffect, useRef } from 'react'

export function V3CourseMapControl() {
  const anchor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = anchor.current?.closest<HTMLElement>('.v3-course')
    if (!root) return
    const svg = root.querySelector<SVGSVGElement>('.v3-course__svg')
    const hits = Array.from(root.querySelectorAll<SVGCircleElement>('.v3-course__hit'))
    const picks = Array.from(root.querySelectorAll<HTMLButtonElement>('.v3-course__pick'))
    const cards = Array.from(root.querySelectorAll<HTMLElement>('.v3-course__card'))
    const refs = picks.map((p) => p.dataset.hole).filter((r): r is string => !!r)
    if (refs.length === 0) return

    const select = (ref: string) => {
      if (!refs.includes(ref)) return
      root.dataset.hole = ref
      for (const el of Array.from(root.querySelectorAll('.is-on'))) el.classList.remove('is-on')
      if (svg) {
        for (const el of Array.from(svg.querySelectorAll(`.H${CSS.escape(ref)}`))) {
          el.classList.add('is-on')
        }
      }
      for (const p of picks) p.setAttribute('aria-pressed', String(p.dataset.hole === ref))
      for (const c of cards) c.hidden = c.dataset.hole !== ref
    }

    // The hole numbers are one tab stop with arrow keys inside it. Eighteen
    // separate stops in the middle of a page is a wall, not a control.
    const focusPick = (i: number) => {
      const next = (i + picks.length) % picks.length
      picks.forEach((p, j) => p.setAttribute('tabindex', j === next ? '0' : '-1'))
      picks[next]?.focus()
      const ref = picks[next]?.dataset.hole
      if (ref) select(ref)
    }

    const onPickKey = (e: KeyboardEvent) => {
      const i = picks.indexOf(e.currentTarget as HTMLButtonElement)
      if (i < 0) return
      const step =
        e.key === 'ArrowRight' || e.key === 'ArrowDown'
          ? 1
          : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
            ? -1
            : 0
      if (step === 0 && e.key !== 'Home' && e.key !== 'End') return
      e.preventDefault()
      focusPick(e.key === 'Home' ? 0 : e.key === 'End' ? picks.length - 1 : i + step)
    }

    const onHole = (e: Event) => {
      const ref = (e.currentTarget as HTMLElement | SVGElement).dataset.hole
      if (ref) select(ref)
    }

    picks.forEach((p, i) => {
      p.setAttribute('tabindex', i === 0 ? '0' : '-1')
      p.addEventListener('click', onHole)
      p.addEventListener('keydown', onPickKey as EventListener)
    })
    for (const hit of hits) {
      hit.setAttribute('tabindex', '-1')
      hit.addEventListener('pointerenter', onHole)
      hit.addEventListener('pointerdown', onHole)
    }

    root.dataset.enhanced = 'on'
    select(root.dataset.hole ?? refs[0]!)

    return () => {
      for (const p of picks) {
        p.removeEventListener('click', onHole)
        p.removeEventListener('keydown', onPickKey as EventListener)
      }
      for (const hit of hits) {
        hit.removeEventListener('pointerenter', onHole)
        hit.removeEventListener('pointerdown', onHole)
      }
      for (const c of cards) c.hidden = false
      delete root.dataset.enhanced
    }
  }, [])

  return <div ref={anchor} className="v3-course__control" aria-hidden="true" />
}

'use client'
/**
 * Selection behaviour for V3CourseMap.
 *
 * The section ships every hole's card as server HTML. This island marks the
 * section enhanced and hides the unselected cards. It renders no content.
 *
 * One selection, no hover preview. Pointing at a hole selects it; leaving does
 * not clear it. A hover preview plus a separate committed selection breaks under
 * touch, which fires pointerenter then pointerleave on the lift (the Atlas
 * readout hit this: a tapped place flashed its name and went blank).
 *
 * It queries its own section by class instead of owning the markup. The drawing
 * is a few hundred paths and rendering it from the client would ship the
 * geometry twice.
 */
import { useEffect, useRef } from 'react'

export function V3CourseMapControl() {
  const anchor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = anchor.current?.closest<HTMLElement>('.v3-course')
    if (!root) return
    const hits = Array.from(root.querySelectorAll<HTMLElement>('.v3-course__hit'))
    const picks = Array.from(root.querySelectorAll<HTMLButtonElement>('.v3-course__pick'))
    const cards = Array.from(root.querySelectorAll<HTMLElement>('.v3-course__card'))
    // The scorecard is the control on a numbered course. A course whose holes
    // carry no numbers in the source has no scorecard to build, so the marks on
    // the map are the control instead. Before this the island read `picks`
    // only, found none, and returned — leaving all eighteen cards on screen.
    const controls: HTMLElement[] = picks.length ? picks : hits
    const refs = controls.map((c) => c.dataset.hole).filter((r): r is string => !!r)
    if (refs.length === 0) return

    const select = (ref: string) => {
      if (!refs.includes(ref)) return
      root.dataset.hole = ref
      for (const el of Array.from(root.querySelectorAll('.is-on'))) el.classList.remove('is-on')
      // Root, not the svg: the hole numbers live in the HTML tap layer beside it.
      for (const el of Array.from(root.querySelectorAll(`.H${CSS.escape(ref)}`))) {
        el.classList.add('is-on')
      }
      for (const c of controls) c.setAttribute('aria-pressed', String(c.dataset.hole === ref))
      for (const c of cards) c.hidden = c.dataset.hole !== ref
    }

    // The hole numbers are one tab stop with arrow keys inside it, rather than
    // eighteen separate stops mid-page.
    const focusPick = (i: number) => {
      const next = (i + controls.length) % controls.length
      controls.forEach((p, j) => p.setAttribute('tabindex', j === next ? '0' : '-1'))
      controls[next]?.focus()
      const ref = controls[next]?.dataset.hole
      if (ref) select(ref)
    }

    const onPickKey = (e: KeyboardEvent) => {
      const i = controls.indexOf(e.currentTarget as HTMLElement)
      if (i < 0) return
      // A mark on the map is a role=button span, so Enter and Space have to be
      // wired by hand; a real <button> in the scorecard gets them free.
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const ref = controls[i]?.dataset.hole
        if (ref) select(ref)
        return
      }
      const step =
        e.key === 'ArrowRight' || e.key === 'ArrowDown'
          ? 1
          : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
            ? -1
            : 0
      if (step === 0 && e.key !== 'Home' && e.key !== 'End') return
      e.preventDefault()
      focusPick(e.key === 'Home' ? 0 : e.key === 'End' ? controls.length - 1 : i + step)
    }

    const onHole = (e: Event) => {
      const ref = (e.currentTarget as HTMLElement | SVGElement).dataset.hole
      if (ref) select(ref)
    }

    controls.forEach((p, i) => {
      p.setAttribute('tabindex', i === 0 ? '0' : '-1')
      p.addEventListener('click', onHole)
      p.addEventListener('keydown', onPickKey as EventListener)
    })
    for (const hit of hits) {
      hit.addEventListener('pointerenter', onHole)
      hit.addEventListener('pointerdown', onHole)
    }

    root.dataset.enhanced = 'on'
    select(root.dataset.hole ?? refs[0]!)

    return () => {
      for (const p of controls) {
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

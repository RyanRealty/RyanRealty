'use client'

/**
 * V3Reveal — the house mount of the installed beUI scroll animation
 * (`components/motion/scroll-reveal.tsx`, fetched from
 * https://beui.dev/r/scroll-reveal.json, documented at
 * https://beui.dev/components/motion/scroll-animation, the URL the community
 * builder card names). The catalog component is imported, not re-implemented:
 * `motion/react` on a house wrapper would be a dependency of beUI, not beUI.
 *
 * WHAT IT IS FOR, AND WHAT IT IS NOT FOR (SITE-116 round 2, 2026-09-16). The
 * evaluator's craft finding on the community class was that "no shot shows a
 * real catalog interaction — every section is a static hairline list on load".
 * The answer is NOT to fade the page in. `ScrollReveal` renders its child at
 * `opacity: 0` in the SERVED HTML and only reveals it once the element is in
 * view, so any text put inside it is text a no-JS reader and a crawler are
 * handed invisible. §0 and the SEO half of this queue's accept test both say
 * that is not a trade we make.
 *
 * So this wrapper is for MEDIA ONLY — a photograph, a drawn mark, a frame:
 * things whose absence costs a reader nothing and whose arrival is the motion
 * a person notices. Every word on the page stays outside it, in plain HTML, at
 * full opacity, on the first byte. The prop is named `media` to say so.
 *
 * The house paint is the motion ladder in CLAUDE.md §3: 300ms entrances,
 * ≤16px travel, ease-out, and `prefers-reduced-motion` respected — which the
 * catalog component already honours through `useReducedMotion` (it drops the
 * travel and the blur and fades alone). The numbers live here rather than in
 * tokens.css because they are JavaScript arguments to the installed
 * component, not CSS custom properties it could read.
 */
import type { ReactNode } from 'react'
import { ScrollReveal } from '@/components/motion/scroll-reveal'
import { cn } from '@/lib/utils'
import './tokens.css'

/** 300ms — the entrance rung of the motion ladder. */
const V3_REVEAL_SECONDS = 0.3
/** 16px — the ladder's travel ceiling. */
const V3_REVEAL_TRAVEL = 16
/**
 * No enter blur. The catalog default is 8px and beUI's own convention caps it
 * at 10, but the house motion ladder (CLAUDE.md §3) has fades, entrances,
 * travel and loops in it and no blur rung — an entrance that smears the frame
 * is beUI's paint, not ours, and this is the register where a photograph has
 * to read as a photograph. It also keeps the entrance on opacity and transform
 * alone, which is the pair the browser animates compositor-side.
 */
const V3_REVEAL_BLUR = 0

export type V3RevealProps = {
  /**
   * The media that reveals. Never words: see the note above. A caller with a
   * caption puts the caption outside this element.
   */
  media: ReactNode
  /**
   * Stagger, in reveal steps, for a set of frames or tiles that should not all
   * arrive on the same frame. Step 0 is immediate; each step adds 60ms, and
   * the ramp stops at 6 steps so the last tile of a long board is never left
   * waiting on a third of a second of queue.
   */
  step?: number
  className?: string
}

const STEP_SECONDS = 0.06
const MAX_STEPS = 6

export function V3Reveal({ media, step = 0, className }: V3RevealProps) {
  const clamped = Number.isFinite(step) ? Math.min(Math.max(Math.trunc(step), 0), MAX_STEPS) : 0
  return (
    <ScrollReveal
      y={V3_REVEAL_TRAVEL}
      blur={V3_REVEAL_BLUR}
      duration={V3_REVEAL_SECONDS}
      delay={clamped * STEP_SECONDS}
      // TRIGGER ON THE FIRST PIXEL, NOT ON A THIRD OF THE BOX. The catalog
      // default is amount 0.3, and a photograph on a board tile is ~230px
      // tall: measured on /communities/tetherow 2026-09-16, the Tetherow
      // course frame was still at opacity 0 in the plate a moment after the
      // section was framed, because the observer had not crossed 30% yet and
      // the 300ms entrance had not begun. A grey box where a photograph
      // belongs is the exact defect this whole pass is fixing, and a fast
      // scroller pays it too. `some` starts the entrance the instant the
      // element touches the viewport edge — the same reasoning
      // components/motion/number.tsx records for dropping its own threshold
      // to 0.15 after a fold numeral stuck at 0.
      amount="some"
      once
      className={cn('v3-reveal', className)}
    >
      {media}
    </ScrollReveal>
  )
}

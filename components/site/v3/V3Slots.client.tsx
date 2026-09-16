'use client'

/* ===========================================================================
   PATTERN 10: SLOTS — a tool's empty state, drawn as the thing it makes.

   WHY IT EXISTS (site queue SITE-50, 2026-09-09). /compare's landing state was
   a heading, one two-sentence paragraph and a text link. The 2026-09-08 taste
   table scored the class 29 and named it exactly: "the single most generic
   empty-state pattern available — heading, sentence, link — indistinguishable
   from any SaaS empty-cart screen", with "no illustration of what a finished
   four-home comparison looks like and no visible slot the visitor can watch
   fill". A tool that describes itself in prose has not shown itself.

   THE FORM. Two parts, and both are the product rather than a description of
   it: the SLOTS — one outlined box per place the tool holds, filled ones
   carrying what is in them and empty ones carrying the way to fill them — and
   a WORKED EXAMPLE, the tool's real output over real rows, labelled in a word
   the reader cannot miss so nobody mistakes the example for their own.

   WHAT CHANGED (SITE-95, 2026-09-15). The example used to be a table this file
   drew by hand: hairline underlines for marks, 64px photo stamps, four
   identical outline buttons, and at 375 a scroller that cropped the second home
   through its own address. The 2026-09-12 table scored that 46 with
   demoMatch false. The example is now whatever the CALLER hands in — on
   /compare it is `app/compare/_v3/CompareSheet.client.tsx`, the installed
   shadcn Table and shadcn Carousel painted with house tokens. This pattern
   keeps what it was always for: the headline, the one-sentence claim, the
   visible SAMPLE label, the tray, and the §0 trace under all of it.

   NOT A SIXTH SECTION ON A PAGE THAT HAS ONE. This replaces a Quiet block on
   /compare; it does not sit beside one. Any tool with a bounded tray and an
   output worth previewing takes it: a saved-search tray, a comp picker.

   HONESTY IS STRUCTURAL. `sample.label` is a required string and it renders as
   visible words beside the example, not as a styling cue — a faded table is
   not a disclosure. No label, no example: the tray stands in instead, and the
   caller's §0 trace still renders.
   =========================================================================== */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading, V3SourceDisclosure, type V3Text } from './atoms'
import './tokens.css'
import './V3Slots.css'

/** What is in a slot right now. */
export type V3SlotsFill = {
  key: string
  label: string
  href?: string
}

export type V3SlotsProps = {
  id: string
  /** The page's or section's own name. */
  headline: V3Text
  /** 2 by default; 1 when this block opens the page, as it does on /compare. */
  headingLevel?: 1 | 2
  eyebrow?: string
  /** One sentence saying what the tool does. Not a paragraph. */
  claim: string
  /**
   * The door at the end of the claim: where a reader goes to pick their own
   * subjects. A real anchor, because the tray that used to carry that link is
   * withheld while the sample is the opening (SITE-65) and a landing state with
   * no way out is a dead end.
   */
  claimAction?: { label: string; href: string }
  /** How many subjects the tool holds. Clamped to 2..6. */
  slots: number
  /** The filled slots, in order. Anything past `slots` is ignored. */
  filled?: readonly V3SlotsFill[]
  /** The words inside an empty slot. */
  emptyLabel: string
  /** Where an empty slot goes: the place a visitor finds subjects. */
  emptyHref: string
  sample: {
    /** The visible word that says this is an example. Required, and shown. */
    label: string
    /** One sentence under the label. */
    caption: string
  }
  /**
   * The worked example: the tool's REAL output, rendered by the caller. On
   * /compare this is the shadcn-table + shadcn-carousel compare sheet. Omit it
   * (or omit `sample.label`) and the tray stands in — this pattern never draws
   * half an example.
   */
  example?: ReactNode
  /** The full section 0 trace for the example's figures, behind "Source". */
  source: string
  className?: string
}

const MIN_SLOTS = 2
const MAX_SLOTS = 6

export function V3Slots({
  id,
  headline,
  headingLevel = 2,
  eyebrow,
  claim,
  claimAction,
  slots,
  filled,
  emptyLabel,
  emptyHref,
  sample,
  example,
  source,
  className,
}: V3SlotsProps) {
  const count = Math.max(MIN_SLOTS, Math.min(MAX_SLOTS, Math.round(slots)))
  const taken = (filled ?? []).slice(0, count)
  const sampleLabel = sample.label.trim()
  // A worked example with no label is an example nobody was told about, which
  // is the one thing this pattern exists to prevent. No label, no example.
  const showSample = example != null && sampleLabel.length > 0

  const headingId = `${id}-heading`
  /* SITE-65: an all-empty tray above the sample is four dashed boxes the
     visitor has to look past to see the comparison. When the sample is
     present and the personal tray is empty, the sample IS the opening.
     The tray comes back the moment the visitor has a home in it, or when
     there is no labelled sample to stand in. */
  const showTray = taken.length > 0 || !showSample

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-slots', className)}
      aria-labelledby={headingId}
    >
      <div className="v3-slots__inner">
        {eyebrow ? <V3Eyebrow>{eyebrow}</V3Eyebrow> : null}
        <V3Heading level={headingLevel} id={headingId} className="v3-slots__headline">
          {headline}
        </V3Heading>
        <p className="v3-slots__claim">
          {claim}
          {claimAction ? (
            <a className="v3-slots__claim-action" href={claimAction.href}>
              {claimAction.label}
            </a>
          ) : null}
        </p>

        {showSample ? (
          <figure className="v3-slots__sample">
            <figcaption className="v3-slots__sample-head">
              <span className="v3-slots__sample-tag">{sampleLabel}</span>
              <span className="v3-slots__sample-caption">{sample.caption}</span>
            </figcaption>
            {example}
          </figure>
        ) : null}

        {showTray ? (
          <ol className="v3-slots__tray" style={{ ['--v3-slots-n' as string]: String(count) }}>
            {Array.from({ length: count }, (_, i) => {
              const fill = taken[i]
              return (
                <li
                  key={`slot-${i}`}
                  className={cn('v3-slots__slot', fill ? 'v3-slots__slot--full' : 'v3-slots__slot--empty')}
                  data-slot={i + 1}
                  data-state={fill ? 'full' : 'empty'}
                >
                  <span className="v3-slots__ordinal" aria-hidden="true">
                    {i + 1}
                  </span>
                  {fill ? (
                    fill.href ? (
                      <a className="v3-slots__slot-link" href={fill.href}>
                        {fill.label}
                      </a>
                    ) : (
                      <span className="v3-slots__slot-label">{fill.label}</span>
                    )
                  ) : (
                    <a className="v3-slots__slot-link v3-slots__slot-add" href={emptyHref}>
                      {emptyLabel}
                    </a>
                  )}
                </li>
              )
            })}
          </ol>
        ) : null}

        <V3SourceDisclosure source={source} className="v3-slots__source" />
      </div>
    </section>
  )
}

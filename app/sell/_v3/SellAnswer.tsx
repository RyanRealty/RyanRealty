'use client'

/**
 * THE /sell ANSWER BODY.
 *
 * Site queue SITE-02, then SITE-02b. Its only input is `SellAnswerData`, which
 * is the DAL's answer plus its section-0 trace and nothing else
 * (app/sell/_v3/sell-answer.ts).
 *
 * WHAT 02b CHANGED, AND WHY. This file used to draw its own answer: two
 * percentage bars built from inline `inlineSize` styles, a cash meter built the
 * same way, and a scrolling list of four named comparable sales. The /sell
 * evaluator's standing finding on that last one was blunt — "the comps ledger
 * has no visual encoding (no map, no distance marks) — it is rows" — and the
 * community page, answering the SAME question with the SAME figures, drew a
 * definition list instead. Two surfaces, two drawings, one question.
 *
 * So the drawing left this file. `V3Drawing` (components/site/v3) draws all
 * three figures for every surface that answers a typed address: supply as two
 * named counts on one scale, pace as one mark on a 0-to-120-day rule with the
 * city median beside it, the comparable closes as a dot strip by close month
 * with a reading per dot. The figures themselves are shaped on the server by
 * buildAnswerFigures, so this component holds no arithmetic and no copy.
 *
 * WHAT STAYED HERE. The address eyebrow, the claim, the one reading that has no
 * drawing (who is buying, which is a share of a whole with nothing to plot it
 * against), the door to the place's own market report, and the full trace.
 *
 * NO DOLLAR FIGURE. Matt's ruling: a typed address on a public page never gets
 * a price. The price is in the written valuation the next step delivers.
 */

import { useState } from 'react'
import { V3Drawing, V3SourceDisclosure } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import { sellAnswerClaim, sellAnswerReadings, type SellAnswerData } from './sell-answer'

export function SellAnswer({ answer }: { answer: SellAnswerData }) {
  const [open, setOpen] = useState<string | null>(null)
  const readings = sellAnswerReadings(answer)

  return (
    <section className="sell-answer" aria-labelledby="sell-answer-claim">
      <p className="sell-answer__eyebrow">
        {answer.street}
        {answer.asOfLabel ? <span className="sell-answer__stamp"> · read {answer.asOfLabel}</span> : null}
      </p>

      <h2 id="sell-answer-claim" className="sell-answer__claim">
        {sellAnswerClaim(answer)}
      </h2>

      {answer.figures.length > 0 ? (
        <V3Drawing
          className="sell-answer__drawing"
          figures={answer.figures}
          label={`${answer.placeLabel} right now`}
        />
      ) : null}

      {readings.length > 0 ? (
        <ul className="sell-answer__readings">
          {readings.map((reading) => {
            const isOpen = open === reading.key
            return (
              <li key={reading.key} className="sell-answer__reading">
                <p className="sell-answer__reading-line">
                  <span className="sell-answer__reading-value">{reading.value}</span>
                  <span className="sell-answer__reading-label">{reading.label}</span>
                </p>
                <p className="sell-answer__reading-sentence">{reading.sentence}</p>
                <button
                  type="button"
                  className="sell-answer__more"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : reading.key)}
                >
                  {isOpen ? 'Close' : 'How we count this'}
                </button>
                <p className={cn('sell-answer__detail', !isOpen && 'sell-answer__detail--closed')}>
                  {reading.detail}
                </p>
              </li>
            )
          })}
        </ul>
      ) : null}

      {answer.placeHref ? (
        <p className="sell-answer__door">
          <a href={answer.placeHref}>Every figure we publish for {answer.placeLabel}</a>
        </p>
      ) : null}

      <V3SourceDisclosure
        className="sell-answer__source"
        source={
          answer.trace.length > 0
            ? answer.trace.join(' · ')
            : `Regional MLS through Oregon Data Share, read through the Market Truth metric layer: detached single-family homes in ${answer.placeLabel}.`
        }
      />
    </section>
  )
}

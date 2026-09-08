'use client'

/**
 * THE /sell ANSWER BODY — one component, deliberately swappable.
 *
 * Site queue SITE-02. Its only input is `SellAnswerData`, which is the DAL's
 * answer plus its §0 trace and nothing else (app/sell/_v3/sell-answer.ts). The
 * following session (02b) replaces what is drawn here with the drawing
 * primitive without touching the form, the action, or the type.
 *
 * THE FORM, AND WHY IT IS THIS FORM. TASTE.md bans the KPI grid by name — "a
 * number, a percentage, and jargon" with no sentence saying what it means — and
 * DATA_GRAPHICS.md says months of supply is TWO BARS (homes for sale against a
 * month of sales), never a tile that says 3.9 and makes the reader divide. So
 * the claim is a sentence, the supply figure is a drawing, and every reading
 * beside it is a sentence with its figure inside. Each reading opens to the
 * definition behind it, which is the "what does the reader DO here" rule met
 * with more DATA rather than with decoration.
 *
 * NO DOLLAR FIGURE. Matt's ruling: a typed address on a public page never gets
 * a price. The price is in the written valuation the next step delivers.
 */

import { useState } from 'react'
import { V3SourceDisclosure } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import {
  sellAnswerClaim,
  sellAnswerReadings,
  sellSupplyBars,
  sellSupplySentence,
  type SellAnswerData,
} from './sell-answer'

export function SellAnswer({ answer }: { answer: SellAnswerData }) {
  const [open, setOpen] = useState<string | null>(null)
  const bars = sellSupplyBars(answer)
  const supply = sellSupplySentence(answer)
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

      {bars && supply ? (
        <figure className="sell-answer__figure">
          <figcaption className="sell-answer__caption">{supply}</figcaption>
          <div className="sell-answer__bars">
            <div className="sell-answer__bar">
              <span className="sell-answer__bar-label">For sale now</span>
              <span className="sell-answer__track">
                <span
                  className="sell-answer__fill"
                  style={{ inlineSize: `${bars.forSale.pct}%` }}
                  aria-hidden="true"
                />
              </span>
              <span className="sell-answer__bar-value">
                {bars.forSale.count.toLocaleString('en-US')}
              </span>
            </div>
            <div className="sell-answer__bar sell-answer__bar--pace">
              <span className="sell-answer__bar-label">Under contract in a month</span>
              <span className="sell-answer__track">
                <span
                  className="sell-answer__fill"
                  style={{ inlineSize: `${bars.sold.pct}%` }}
                  aria-hidden="true"
                />
              </span>
              <span className="sell-answer__bar-value">{bars.sold.count.toLocaleString('en-US')}</span>
            </div>
          </div>
          {answer.verdictLabel && answer.monthsOfSupply ? (
            <p className="sell-answer__verdict">
              <span className="sell-answer__verdict-months">{answer.monthsOfSupply} months</span> of
              homes on the market. Four months or less is a seller&apos;s market, six or more is a
              buyer&apos;s, so {answer.placeLabel} is a {answer.verdictLabel}.
            </p>
          ) : null}
        </figure>
      ) : null}

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

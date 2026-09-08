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
  sellBarReading,
  sellSupplyBars,
  sellSupplySentence,
  type SellAnswerData,
} from './sell-answer'

/** The two bars, in reading order. One template, two members. */
const BARS = [
  { key: 'forSale' as const, label: 'For sale now' },
  { key: 'sold' as const, label: 'Under contract in a month' },
]

export function SellAnswer({ answer }: { answer: SellAnswerData }) {
  const [open, setOpen] = useState<string | null>(null)
  const [bar, setBar] = useState<'forSale' | 'sold' | null>(null)
  const bars = sellSupplyBars(answer)
  const supply = sellSupplySentence(answer)
  const readings = sellAnswerReadings(answer)
  const barReading = bar ? sellBarReading(answer, bar) : null

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
            {BARS.map((b) => (
              <button
                key={b.key}
                type="button"
                className={cn(
                  'sell-answer__bar',
                  b.key === 'sold' && 'sell-answer__bar--pace',
                  bar === b.key && 'sell-answer__bar--live',
                )}
                aria-expanded={bar === b.key}
                aria-controls="sell-answer-bar-reading"
                onMouseEnter={() => setBar(b.key)}
                onFocus={() => setBar(b.key)}
                onMouseLeave={() => setBar((c) => (c === b.key ? null : c))}
                onBlur={() => setBar((c) => (c === b.key ? null : c))}
                onClick={() => setBar((c) => (c === b.key ? null : b.key))}
              >
                <span className="sell-answer__bar-label">{b.label}</span>
                <span className="sell-answer__track">
                  <span
                    className="sell-answer__fill"
                    style={{ inlineSize: `${bars[b.key].pct}%` }}
                    aria-hidden="true"
                  />
                </span>
                <span className="sell-answer__bar-value">
                  {bars[b.key].count.toLocaleString('en-US')}
                </span>
              </button>
            ))}
          </div>

          {/* The drawing answers when it is asked: hover, tap or tab a bar and
              it gives up its window, its population and its definition. */}
          <p
            id="sell-answer-bar-reading"
            className={cn('sell-answer__bar-reading', !barReading && 'sell-answer__bar-reading--idle')}
            aria-live="polite"
          >
            {barReading ?? 'Hover or tap a bar for the window and what it counts.'}
          </p>
          {answer.verdictLabel && answer.monthsOfSupply ? (
            <p className="sell-answer__verdict">
              <span className="sell-answer__verdict-months">{answer.monthsOfSupply} months</span> of
              homes on the market, which is a {answer.verdictLabel}.
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
              {/* A proportion draws itself. Cash against financed is the one
                  reading here that IS a share, so it gets a meter rather than
                  the number-and-label shape its neighbour already wears. */}
              {reading.meterPct != null ? (
                <p className="sell-answer__meter" aria-hidden="true">
                  <span
                    className="sell-answer__meter-fill"
                    style={{ inlineSize: `${reading.meterPct}%` }}
                  />
                </p>
              ) : null}
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

              {/* The comps themselves. A count with no way to check it is half
                  the transparency: these name WHICH homes the ladder matched,
                  how alike they are and when they sold. No prices — that is
                  Matt's ruling and it is what the written valuation is for. */}
              {reading.key === 'comps' && answer.comps.length > 0 ? (
                <ul className="sell-answer__comps">
                  {answer.comps.map((comp) => (
                    <li key={comp.id} className="sell-answer__comp">
                      <span className="sell-answer__comp-street">{comp.street}</span>
                      <span className="sell-answer__comp-where">
                        {comp.where}
                        {comp.proximity ? ` · ${comp.proximity}` : ''}
                      </span>
                      <span className="sell-answer__comp-facts">{comp.facts}</span>
                      <span className="sell-answer__comp-when">{comp.when}</span>
                    </li>
                  ))}
                  {answer.compCount != null && answer.compCount > answer.comps.length ? (
                    <li className="sell-answer__comp sell-answer__comp--more">
                      <span className="sell-answer__comp-street">
                        {answer.compCount - answer.comps.length} more in the written valuation
                      </span>
                      <span className="sell-answer__comp-where">
                        with what each one sold for
                      </span>
                    </li>
                  ) : null}
                </ul>
              ) : null}
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

/**
 * First viewport of /reviews: Google reviews as written.
 * No star HUD, no paraphrase, no ticker. Attribution stays.
 * Hairlines from Quiet. Compact padding from AboutFaces so a quote
 * lands in the first screen at 390 and 1280.
 */

import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import type { ReviewQuote } from './review-quotes'
import './reviews-quotes.css'

export function ReviewsQuotes({
  quotes,
  eyebrow,
  heading,
}: {
  quotes: readonly ReviewQuote[]
  eyebrow: string
  heading: string
}) {
  if (quotes.length === 0) return null

  return (
    <section
      id="reviews"
      className={cn(V3_ROOT_CLASS, 'reviews-quotes')}
      aria-labelledby="reviews-heading"
    >
      <div className="reviews-quotes__head">
        <V3Eyebrow>{eyebrow}</V3Eyebrow>
        <V3Heading level={1} id="reviews-heading" className="reviews-quotes__heading">
          {heading}
        </V3Heading>
      </div>
      <ul className="reviews-quotes__list">
        {quotes.map((row) => {
          const paras = row.quote
            .split(/\n+/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
          if (paras.length === 0) return null
          return (
            <li key={`${row.author}-${row.date ?? ''}-${row.quote.slice(0, 24)}`}>
              <figure className="reviews-quotes__item">
                <blockquote className="reviews-quotes__quote">
                  {paras.map((para) => (
                    <p className="reviews-quotes__para" key={para.slice(0, 48)}>
                      {para}
                    </p>
                  ))}
                </blockquote>
                <figcaption className="reviews-quotes__who">
                  <cite className="reviews-quotes__author">{row.author}</cite>
                  <span className="reviews-quotes__meta">{row.attribution}</span>
                </figcaption>
              </figure>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

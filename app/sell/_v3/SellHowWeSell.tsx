/**
 * How we sell, in three steps. Modeled on Compass's clear phased story and
 * Stellar's numbered process, kept to three concrete outcomes (Matt 2026-09-28
 * brief; rebuilt 2026-10-05 so the whole page, not just the fold, reads as a
 * seller plan). Full plan inclusions sit behind one native disclosure.
 *
 * Every sentence restates LISTING_TERMS, PLAN_GROUPS or the listing-time FAQ
 * in sell-constants.ts. Nothing is promised that the plan does not say.
 */
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import { LISTING_TERMS, PLAN_GROUPS } from './sell-constants'

export const SELL_HOW_STEPS = [
  {
    title: 'A price built from closed sales',
    body: 'We set the list price from homes like yours that closed nearby and the ones competing with it now. Before you decide, we walk you through the comparable sales behind the number.',
  },
  {
    title: 'A complete launch in week one',
    body: 'Professional photos within 48 hours of signing, plus aerial drone video, a cinematic walkthrough and a 3D tour, all in the 3%. Live on the MLS typically 5 to 7 business days after a signed agreement.',
  },
  {
    title: 'A written report every week',
    body: 'Every week you are on the market you get it in writing: showings, traffic and buyer feedback, so you always know where the listing stands.',
  },
] as const

export function SellHowWeSell() {
  return (
    <section
      id="how-we-sell"
      className={`${V3_ROOT_CLASS} sell-how`}
      aria-labelledby="how-we-sell-title"
    >
      <header className="sell-how__head">
        <V3Eyebrow>How working with us goes</V3Eyebrow>
        <V3Heading level={2} id="how-we-sell-title">
          Three steps from your address to a weekly written report
        </V3Heading>
        <p className="sell-how__lead">
          No market lecture. A clear price, a complete launch, and a report you
          can read every week. Everything below is in the 3% listing fee.
        </p>
      </header>
      <ol className="sell-how__steps">
        {SELL_HOW_STEPS.map((step, i) => (
          <li key={step.title} className="sell-how__step">
            <span className="sell-how__n" aria-hidden="true">
              {i + 1}
            </span>
            <div className="sell-how__copy">
              <h3 className="sell-how__title">{step.title}</h3>
              <p className="sell-how__body">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <details className="sell-how__all" data-sell-cta="plan-inclusions">
        <summary className="sell-how__toggle">Everything the 3% includes</summary>
        <div className="sell-how__groups">
          {PLAN_GROUPS.map((group) => (
            <div key={group.title} className="sell-how__group">
              <h3 className="sell-how__group-title">{group.title}</h3>
              <ul className="sell-how__items">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="sell-how__terms">
          {LISTING_TERMS.fee} {LISTING_TERMS.buyerAgent}.
        </p>
      </details>
    </section>
  )
}

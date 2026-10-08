/**
 * The direct answer under the /sell H1: two plain sentences in server HTML,
 * then a small source line. Composed by sell-direct-answer.ts from live reads.
 * Both links are tracked like every other /sell control (data-sell-cta).
 */
import Link from 'next/link'

type Props = {
  marketLine: string | null
  feeLine: string
  asOf: string
  city: string
}

export function SellDirectAnswer({ marketLine, feeLine, asOf, city }: Props) {
  return (
    <div className="sell-hero-answer">
      <p className="sell-hero-answer__text">
        {marketLine ? `${marketLine} ` : ''}
        {feeLine}
      </p>
      <p className="sell-hero-answer__source">
        {marketLine ? `Single-family homes in ${city}, Oregon Data Share MLS, as of ${asOf}. ` : ''}
        <Link href="/housing-market/bend" data-sell-cta="answer-market">
          Bend housing market
        </Link>
        {' · '}
        <Link href="/blog/cost-to-sell-house-bend-oregon" data-sell-cta="answer-cost">
          What it costs to sell
        </Link>
      </p>
    </div>
  )
}

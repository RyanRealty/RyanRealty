/**
 * The direct answer on /sell (SEO & AEO Desk brief 2026-10-08): two plain
 * sentences in server HTML, then a small source line. Its own calm section on
 * cream directly under the hero card, never over the photograph (Matt
 * 2026-10-08). Composed by sell-direct-answer.ts from live reads. Both links are
 * tracked like every other /sell control (data-sell-cta).
 */
import Link from 'next/link'
import { V3_ROOT_CLASS } from '@/components/site/v3'

type Props = {
  id: string
  marketLine: string | null
  feeLine: string
  asOf: string
  city: string
}

export function SellDirectAnswer({ id, marketLine, feeLine, asOf, city }: Props) {
  return (
    <section id={id} className={`${V3_ROOT_CLASS} sell-direct`} aria-label={`Selling in ${city} right now`}>
      <p className="sell-direct__text">
        {marketLine ? `${marketLine} ` : ''}
        {feeLine}
      </p>
      <p className="sell-direct__source">
        {marketLine ? `Single-family homes in ${city}, Oregon Data Share MLS, as of ${asOf}. ` : ''}
        <Link href="/housing-market/bend" data-sell-cta="answer-market">
          Bend housing market
        </Link>
        {' · '}
        <Link href="/blog/cost-to-sell-house-bend-oregon" data-sell-cta="answer-cost">
          What it costs to sell
        </Link>
      </p>
    </section>
  )
}

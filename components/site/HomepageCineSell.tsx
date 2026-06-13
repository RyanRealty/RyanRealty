/**
 * HomepageCineSell — the seller conversion + instant-value hook.
 *
 * Left: the pitch + CTA into /lp/seller-home-value (the main seller funnel).
 * Right: a value-estimate card framed with REAL regional context from
 * getRegionPulse (median list, sold-30d) — labeled as Central Oregon context,
 * never presented as an estimate of any specific home (§0). The address field
 * is a visual affordance only; the real estimate happens on the LP.
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { H2 } from '@/components/site/primitives'
import { CONTACT } from '@/lib/brand/contact'

type Props = {
  medianListPrice: number | null
  soldCount30d: number | null
  medianDaysToPending: number | null
}

function fmtPrice(n: number): string {
  return `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}`
}

export default function HomepageCineSell({ medianListPrice, soldCount30d, medianDaysToPending }: Props) {
  const rows: Array<{ k: string; v: string }> = []
  if (medianListPrice != null) rows.push({ k: 'Median list, Central Oregon', v: fmtPrice(medianListPrice) })
  if (medianDaysToPending != null) rows.push({ k: 'Typical time to pending', v: `${Math.round(medianDaysToPending)} days` })
  if (soldCount30d != null) rows.push({ k: 'Sold in the last 30 days', v: soldCount30d.toLocaleString('en-US') })

  return (
    <section className="cine-sell" aria-label="What is your home worth">
      <div className="cine-sell-wrap">
        <div className="cine-sell-copy">
          <H2 className="cine-h2">Know what your home is worth before you list.</H2>
          <p>
            A broker who closes deals here reads your home against live comparable sales and the
            same market data behind this page. No guesswork, no pressure, a real number you can plan around.
          </p>
          <div className="cine-sell-actions">
            <Button asChild className="cine-btn-primary">
              <Link href="/lp/seller-home-value">Get your home value</Link>
            </Button>
            <a className="cine-btn-ghost" href={`tel:${CONTACT.phoneDirectTel}`}>
              {CONTACT.phoneDirect}
            </a>
          </div>
        </div>
        <div className="cine-sell-card">
          <p className="cine-eyebrow">Your home, valued by a broker</p>
          <div className="cine-sell-addr">
            <span>Enter your address on the next step</span>
          </div>
          {rows.length > 0 && (
            <div className="cine-sell-rows">
              {rows.map((r) => (
                <div key={r.k} className="cine-sell-row">
                  <span className="k">{r.k}</span>
                  <span className="v">{r.v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

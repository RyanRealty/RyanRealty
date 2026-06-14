/**
 * HomepageV6Sell — seller conversion + value context, Linear finish.
 * Left: pitch + CTA into /lp/seller-home-value. Right: a hairline value panel
 * framed with REAL regional context (median, time-to-pending, sold-30d) from
 * getRegionPulse — labeled as Central Oregon context, never a specific-home
 * estimate (§0). The address field is a visual affordance; the estimate runs
 * on the LP.
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CONTACT } from '@/lib/brand/contact'

type Props = {
  medianListPrice: number | null
  soldCount30d: number | null
  medianDaysToPending: number | null
}

function fmtPrice(n: number): string {
  return `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}`
}

export default function HomepageV6Sell({ medianListPrice, soldCount30d, medianDaysToPending }: Props) {
  const rows: Array<{ k: string; v: string }> = []
  if (medianListPrice != null) rows.push({ k: 'Median list, Central Oregon', v: fmtPrice(medianListPrice) })
  if (medianDaysToPending != null) rows.push({ k: 'Typical time to pending', v: `${Math.round(medianDaysToPending)} days` })
  if (soldCount30d != null) rows.push({ k: 'Sold in the last 30 days', v: soldCount30d.toLocaleString('en-US') })

  return (
    <section className="v6-section" aria-label="What is your home worth">
      <div className="v6-section-wrap">
        <div className="v6-sell-grid">
          <div className="v6-sell-copy">
            {/* heading-display-ok */}
            <h2>Know what your home is worth before you list.</h2>
            <p>
              A broker who closes deals here reads your home against live comparable sales and the
              same market data behind this page. No guesswork, no pressure, a real number you can plan around.
            </p>
            <div className="v6-sell-actions">
              <Button asChild className="v6-btn-primary">
                <Link href="/lp/seller-home-value">Get your home value</Link>
              </Button>
              <a className="v6-btn-ghost v6-tnum" href={`tel:${CONTACT.phoneDirectTel}`}>
                {CONTACT.phoneDirect}
              </a>
            </div>
          </div>
          <div className="v6-value-panel">
            <div className="v6-value-head">
              <span className="v6-label">Your home, valued by a broker</span>
            </div>
            <div className="v6-value-addr">Enter your address on the next step</div>
            {rows.length > 0 && (
              <div className="v6-value-rows">
                {rows.map((r) => (
                  <div key={r.k} className="v6-ledger-row v6-tnum">
                    <span className="v6-name">{r.k}</span>
                    <span className="v6-val">{r.v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

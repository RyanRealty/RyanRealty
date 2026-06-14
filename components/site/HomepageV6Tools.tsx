/**
 * HomepageV6Tools — working calculators on the front page, Linear finish.
 * Hairline tile cards linking to the real /tools routes. Static, no fetch.
 */

import Link from 'next/link'

const TOOLS = [
  { name: 'Mortgage calculator', desc: 'Payment, taxes, and insurance on any Central Oregon price point.', href: '/tools/mortgage-calculator' },
  { name: 'Appreciation projector', desc: 'What a Bend, Redmond, or Sisters home could be worth over your hold.', href: '/tools/appreciation' },
  { name: 'Rental analysis', desc: 'Cash flow, cap rate, and return before you make an offer.', href: '/tools/rental-property-calculator' },
] as const

export default function HomepageV6Tools() {
  return (
    <section className="v6-section" aria-label="Tools">
      <div className="v6-section-wrap">
        <div className="v6-section-head">
          {/* heading-display-ok */}
          <h2>Run the numbers before you talk to anyone</h2>
        </div>
        <div className="v6-tiles">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} className="v6-tile">
              <span className="v6-tile-name">{t.name}</span>
              <span className="v6-tile-desc">{t.desc}</span>
              <span className="v6-tile-go">Open the calculator →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

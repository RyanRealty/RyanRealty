/**
 * HomepageCineTools — the working tools competitors bury or omit, on the
 * front page. Links to the live calculators that already exist under /tools.
 * Static content, no data fetch — every destination is a real route.
 */

import Link from 'next/link'
import { H2 } from '@/components/site/primitives'

const TOOLS = [
  {
    name: 'Mortgage calculator',
    desc: 'Payment, taxes, and insurance on any Central Oregon price point, with current rate assumptions.',
    href: '/tools/mortgage-calculator',
  },
  {
    name: 'Appreciation projector',
    desc: 'Model what a Bend, Redmond, or Sisters home could be worth over the years you plan to hold it.',
    href: '/tools/appreciation',
  },
  {
    name: 'Rental property analysis',
    desc: 'Cash flow, cap rate, and return on a short or long-term rental before you make an offer.',
    href: '/tools/rental-property-calculator',
  },
] as const

export default function HomepageCineTools() {
  return (
    <section className="cine-tools" aria-label="Tools">
      <div className="cine-tools-wrap">
        <H2 className="cine-h2">Run the numbers before you talk to anyone.</H2>
        <div className="cine-tools-grid">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} className="cine-tool">
              <span className="cine-tool-name">{t.name}</span>
              <span className="cine-tool-desc">{t.desc}</span>
              <span className="cine-tool-go">Open the calculator →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

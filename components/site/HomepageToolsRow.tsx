// brand-voice:exempt
/**
 * HomepageToolsRow — three quiet calculator/tool card links.
 *
 * Server component. No client state needed.
 * Cards link to existing tool routes: /mortgage, /rental, /appreciation.
 * Hover: card lifts + border darkens.
 */

import Link from 'next/link'
import { Container, DisplayHeading, Eyebrow } from '@/components/site/primitives'

const TOOLS = [
  {
    href: '/mortgage',
    name: 'Mortgage calculator',
    desc: 'Estimate your monthly payment at current rates. Adjust down payment, term, and price to find a range that works.',
    cta: 'Calculate payment',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
  {
    href: '/rental',
    name: 'Rent vs. buy',
    desc: 'See how renting compares to buying at today\'s prices. Uses local market data for a Central Oregon-specific estimate.',
    cta: 'Run the numbers',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/appreciation',
    name: 'Appreciation estimate',
    desc: 'Look up the historical price trend for a Bend neighborhood or city. Pulls from our closed-sale database, not national indices.',
    cta: 'Explore trends',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
  },
] as const

export default function HomepageToolsRow() {
  return (
    <section
      className="py-16 md:py-20 bg-white border-t border-border"
      aria-labelledby="tools-heading"
    >
      <Container>
        <div className="mb-10">
          <Eyebrow className="mb-3">Tools</Eyebrow>
          <DisplayHeading as="h2" id="tools-heading" className="text-foreground">
            Run the numbers before you decide.
          </DisplayHeading>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="flex flex-col px-8 py-8 pb-10 rounded-2xl border border-border/60 bg-background transition-all duration-250 ease-out hover:border-primary hover:shadow-md hover:-translate-y-1"
            >
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center mb-5"
                style={{ background: 'rgba(16,39,66,0.06)' }}
              >
                <span className="text-foreground">{tool.icon}</span>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">{tool.name}</h3>
              <p className="text-[13px] leading-[1.55] text-foreground/55 mb-6 flex-1">{tool.desc}</p>
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground border-b border-border pb-0.5 hover:border-foreground transition-colors w-fit">
                {tool.cta}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  )
}

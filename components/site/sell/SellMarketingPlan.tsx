/**
 * SellMarketingPlan — "The plan" section for /sell. The centerpiece of the
 * seller page: what listing with Ryan Realty actually gets you, priced.
 *
 * POSITIONING (Matt, 2026-07-11): 3% is the headline. Enhanced (3%) is the
 * standard every home is compared to. Essential (2.5%) is the same spine with
 * the reach trimmed; Elite (3.5%) turns every channel all the way up. Tiers are
 * cumulative — Enhanced includes Essential, Elite includes Enhanced.
 *
 * STRUCTURE: an interactive navy "Plan Explorer" (the cinematic moment) sits at
 * the top, backed by the full line-by-line comparison for skimmers, then the
 * schedule every plan runs on, then the two proof cards.
 *
 * VOICE (VOICE.md — the Five Laws): show it, don't say it. A number beats an
 * adjective, so the plan is described in its own committed quantities. No banned
 * words, no em-dash, no hype.
 *
 * DATA ACCURACY (CLAUDE.md §0): no invented numbers. The process clocks (48
 * hours, 5 to 7 business days, weekly) are ones the brokerage operates. Plan
 * contents trace to the Ryan Realty Select Seller Plans document.
 *
 * Design-token colors + shadcn components only. Server-renderable; the
 * interactive Explorer and comparison are client children.
 */

import {
  Body,
  Container,
  Eyebrow,
  H2,
  H3,
  Section,
  Stack,
  TextLink,
} from '@/components/site/primitives'
import ScrollReveal from '@/components/landing/ScrollReveal'
import { cn } from '@/lib/utils'
import { SellPlanExplorer } from './SellPlanExplorer.client'
import { SellPlanComparison } from './SellPlanComparison.client'

const BROKER_HREF = '/contact?inquiry=Selling'

type Phase = { label: string; when: string; items: string[] }

const PHASES: Phase[] = [
  {
    label: 'Before it goes live',
    when: 'Day one to listed',
    items: [
      'A written CMA with three closed comps, three active comps, and the four levers that move the price. You see every number.',
      'Professional photography within 48 hours of a signed listing agreement.',
      'The MLS description written by the broker who priced your home, not a template.',
    ],
  },
  {
    label: 'Launch',
    when: '5 to 7 business days from signing',
    items: [
      'Live on the MLS with full syndication across Central Oregon.',
      'Its own page on ryan-realty.com where the video and 3D walkthrough play.',
      'An open-house schedule set with you, not just the first weekend.',
    ],
  },
  {
    label: 'On the market',
    when: 'Every week it is listed',
    items: [
      'A written update every week: showings, online traffic, and buyer feedback.',
      'Every offer reviewed with you in writing: what it says, not just the headline.',
      'The broker you met on day one is the broker at your closing.',
    ],
  },
]

function CheckMark() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-primary" fill="none">
      <circle cx="10" cy="10" r="9" className="fill-primary/10" />
      <path d="M6 10.5l2.5 2.5L14 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SellMarketingPlan() {
  return (
    <Section id="marketing-plan" padding="default" tone="default" divider className="scroll-mt-24">
      <Container>
        {/* Intro */}
        <Stack gap="tight" className="mb-8 max-w-2xl">
          <Eyebrow>The plan</Eyebrow>
          <H2>Three plans: 2.5%, 3%, and 3.5% of the sale price.</H2>
          <Body size="large" tone="muted" className="mt-1 leading-relaxed">
            Enhanced is 3%, and it is the plan most homes list on. Essential is
            2.5% with the same spine and less reach. Elite is 3.5% and adds a
            pre-listing inspection, a professional stager, paid social, and a
            placement in Bend Magazine. All three get the same broker, the same
            weekly written report, and the same comps behind the price.
          </Body>
        </Stack>

        {/* Interactive centerpiece */}
        <SellPlanExplorer valuationHref="#get-value" />

        <p className="mt-4 text-sm text-muted-foreground">
          A written valuation includes a broker walking you through all three.{' '}
          <TextLink href={BROKER_HREF} tone="primary" underline="on-hover">
            Or talk to a broker first
          </TextLink>
          .
        </p>

        {/* Full comparison matrix (interactive) */}
        <div className="mt-14">
          <SellPlanComparison />
        </div>

        {/* The schedule — every plan runs on it */}
        <Stack gap="tight" className="mb-8 mt-16 max-w-2xl">
          <Eyebrow>What happens, and when</Eyebrow>
          <H2>Every plan runs on the same schedule.</H2>
        </Stack>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PHASES.map((phase, i) => (
            <ScrollReveal key={phase.label} delayMs={i * 90}>
              <div className="flex h-full flex-col rounded-[14px] border border-border bg-card p-6">
                <div className="mb-4">
                  <Eyebrow>Phase {i + 1}</Eyebrow>
                  <H3 className="mt-1 text-xl">{phase.label}</H3>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">{phase.when}</p>
                </div>
                <ul className="flex flex-col gap-3">
                  {phase.items.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <CheckMark />
                      <Body size="default" tone="muted" className="leading-relaxed">
                        {item}
                      </Body>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* The two things a competitor cannot paste in */}
        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {[
            {
              eyebrow: 'The price',
              title: 'Six comps, and the range they support.',
              body: 'Three recent closed sales near you, three homes yours competes against, and the four variables that move the range. Every figure comes from the MLS, and each comp we used is printed on the page next to it.',
              tone: 'muted' as const,
            },
            {
              eyebrow: 'The reporting',
              title: 'A written update every week it is listed.',
              body: 'How many showings, how much online traffic, which sources the views came from, and what the buyers who walked through it said.',
              tone: 'card' as const,
            },
          ].map((c, i) => (
            <ScrollReveal key={c.eyebrow} delayMs={i * 90}>
              <div
                className={cn(
                  'h-full rounded-[14px] border border-l-4 border-border border-l-primary p-6 sm:p-7',
                  c.tone === 'muted' ? 'bg-muted' : 'bg-card',
                )}
              >
                <Eyebrow>{c.eyebrow}</Eyebrow>
                <H3 className="mt-2">{c.title}</H3>
                <Body size="default" tone="muted" className="mt-3 leading-relaxed">
                  {c.body}
                </Body>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </Container>
    </Section>
  )
}

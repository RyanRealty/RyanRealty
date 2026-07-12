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
      'Its own page on ryan-realty.com where the film and walkthrough play.',
      'An open-house cadence set with you, not just the first weekend.',
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
          <H2>Three plans. One is the line everyone else is measured against.</H2>
          <Body size="large" tone="muted" className="mt-1 leading-relaxed">
            List at 3% and your home gets the full plan. Want to spend less and
            trim the reach? Essential, at 2.5%. Want every channel working at
            once for a harder sale? Elite, at 3.5%. The same broker, the same
            weekly report, and the same math behind your price run through all
            three.
          </Body>
        </Stack>

        {/* Interactive centerpiece */}
        <SellPlanExplorer />

        <p className="mt-4 text-sm text-muted-foreground">
          Not sure which fits? Start with a free valuation and a broker walks you
          through it.{' '}
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
              title: 'You see every number behind it.',
              body: 'Most pricing is a number with a story attached. Ours is a number with the comps attached. Three recent closed sales near you, three homes yours is competing against, and the four variables that move the range. The math is on the page, and you price your home from it.',
              tone: 'muted' as const,
            },
            {
              eyebrow: 'The reporting',
              title: 'You know whether it is working, every week.',
              body: 'A written update lands in your inbox each week your home is listed: how many showings, how much online traffic, where the views came from, and what buyers said. No wondering how the marketing is going. You have the numbers.',
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

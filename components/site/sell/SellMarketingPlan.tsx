/**
 * SellMarketingPlan — the detailed "what happens to your home, and when"
 * marketing-package surface for /sell.
 *
 * WHY THIS EXISTS (research: out/marketing-package/research-luxury-packages.md):
 * No Bend brokerage publishes a per-listing deliverable schedule, a timeline,
 * or a reporting commitment. Cascade Hasson, LUXE, Duke Warner, and Total all
 * market in adjectives. The open ground is the schedule itself: what happens to
 * YOUR home, by when, and how you see whether it is working. This block is that
 * schedule.
 *
 * VOICE (voice_system_v2.md):
 *  - Proof hierarchy: the market, then the work product, then the process as
 *    fact. NEVER track-record / tenure / headcount.
 *  - Process stated as fact with a clock (Technique 3): "Photography within 48
 *    hours." No "we strive to," no adjectives.
 *  - Parity capabilities (film, 3D, drone, photos) are SHOWN, never claimed as
 *    selling copy. The deliverables here are stated as plain schedule facts and
 *    the production is shown on the home's own listing page (linked), not
 *    described with adjectives.
 *  - The two MOAT claims a competitor cannot paste in: pricing you can check
 *    against every comp, and a written report every week. Those get the weight.
 *
 * DATA ACCURACY (CLAUDE.md §0): no invented numbers. The only figures here are
 * the process clocks (48 hours, 5 to 7 business days, weekly) that are already
 * stated elsewhere on /sell and that the brokerage operates. No closing counts,
 * no syndication-site count, no dollar ad budget.
 *
 * Design-token colors only. Server-renderable.
 */

import {
  Body,
  Container,
  CTAButton,
  DisplayHeading,
  Eyebrow,
  H2,
  H3,
  Section,
  Stack,
  TextLink,
} from '@/components/site/primitives'

type Phase = {
  label: string
  when: string
  items: string[]
}

const PHASES: Phase[] = [
  {
    label: 'Before it goes live',
    when: 'Day one to listed',
    items: [
      'A written CMA with three closed comps, three active comps, and the four levers that move the price. You see every number we used.',
      'Professional photography within 48 hours of a signed listing agreement.',
      'The MLS description written by the broker who priced your home, not pulled from a template.',
      'Your home gets its own page on ryan-realty.com, where the film and the walkthrough play.',
    ],
  },
  {
    label: 'Launch',
    when: '5 to 7 business days from signing',
    items: [
      'Live on the MLS with full syndication across Central Oregon.',
      'Posted to @ryanrealtybend across Instagram, Facebook, TikTok, and YouTube.',
      'Pricing and description locked the day after the photos return.',
      'An open-house cadence set with you, not just the first weekend.',
    ],
  },
  {
    label: 'On the market',
    when: 'Every week it is listed',
    items: [
      'A written update every week: showings, online traffic, where the views came from, and buyer feedback.',
      'Every offer reviewed with you in writing: what it says, not just the headline number.',
      'We negotiate, then manage inspection, appraisal, and close.',
      'The broker you met on day one is the broker at your closing.',
    ],
  },
]

function Check() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="mt-0.5 h-5 w-5 shrink-0 text-primary"
      fill="none"
    >
      <circle cx="10" cy="10" r="9" className="fill-primary/10" />
      <path
        d="M6 10.5l2.5 2.5L14 7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SellMarketingPlan() {
  return (
    <Section
      id="marketing-plan"
      padding="default"
      tone="default"
      divider
      className="scroll-mt-24"
    >
      <Container>
        <Stack gap="tight" className="mb-8 max-w-2xl">
          <Eyebrow>The plan</Eyebrow>
          <H2>One plan. It covers everything.</H2>
          <Body size="large" tone="muted" className="mt-1 leading-relaxed">
            No tiers to compare, no packages, no marketing held back for the top
            of the market. Every home gets the same plan on the same schedule,
            and you can check the two things that matter: the math behind the
            price, and a written report every week.
          </Body>
        </Stack>

        {/* The price — one published number */}
        <div className="mb-12 flex flex-col gap-6 rounded-[14px] border border-l-4 border-border border-l-primary bg-muted p-7 sm:flex-row sm:items-center sm:gap-10">
          <div className="shrink-0">
            <DisplayHeading as="p" className="text-7xl tabular-nums text-primary">
              3%
            </DisplayHeading>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              of the sale price to list with us
            </p>
          </div>
          <div className="flex-1">
            <Body size="default" tone="muted" className="leading-relaxed">
              One listing fee, with no add-on charges. Everything below is in it:
              the same plan runs on a $400,000 home and a $4 million one. We walk
              you through how buyer-agent compensation works under the current
              rules before you sign anything.
            </Body>
            <div className="mt-4">
              <CTAButton href="/lp/seller-home-value" tone="primary" size="md">
                Get your free valuation
              </CTAButton>
            </div>
          </div>
        </div>

        {/* The schedule — what the 3% covers */}
        <Stack gap="tight" className="mb-8 max-w-2xl">
          <Eyebrow>What it covers</Eyebrow>
          <H2>What happens to your home, and when.</H2>
        </Stack>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PHASES.map((phase, i) => (
            <div
              key={phase.label}
              className="flex flex-col rounded-[14px] border border-border bg-card p-6 shadow-sm"
            >
              <div className="mb-4">
                <Eyebrow>Phase {i + 1}</Eyebrow>
                <H3 className="mt-1 text-xl">{phase.label}</H3>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {phase.when}
                </p>
              </div>
              <ul className="flex flex-col gap-3">
                {phase.items.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Check />
                    <Body size="default" tone="muted" className="leading-relaxed">
                      {item}
                    </Body>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          The film and 3D walkthrough are on the listing page, not described in a
          brochure.{' '}
          <TextLink href="/search" tone="primary" underline="on-hover">
            Browse current listings
          </TextLink>{' '}
          to see one.
        </p>

        {/* The two MOAT centerpieces — the claims a competitor cannot paste in */}
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-[14px] border border-l-4 border-border border-l-primary bg-muted p-7">
            <Eyebrow>The price</Eyebrow>
            <H3 className="mt-2">
              You see every number behind it.
            </H3>
            <Body size="default" tone="muted" className="mt-3 leading-relaxed">
              Most pricing is a number with a story attached. Ours is a number
              with the comps attached. Three recent closed sales near you, three
              homes yours is competing against, and the four variables that move
              the range. The math is on the page, and you price your home from it.
            </Body>
          </div>
          <div className="rounded-[14px] border border-l-4 border-border border-l-primary bg-card p-7">
            <Eyebrow>The reporting</Eyebrow>
            <H3 className="mt-2">
              You know whether it is working, every week.
            </H3>
            <Body size="default" tone="muted" className="mt-3 leading-relaxed">
              A written update lands in your inbox each week your home is listed:
              how many showings, how much online traffic, where the views came
              from, and what buyers said. No wondering how the marketing is
              going. You have the numbers.
            </Body>
          </div>
        </div>
      </Container>
    </Section>
  )
}

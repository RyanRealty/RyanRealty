'use client'

/**
 * SellerSituations — "What's bringing you to sell?" situation recognition.
 *
 * STRATEGY (Matt, 2026-07-11): people sell for very different reasons, and each
 * reason carries a different worry. Meeting a seller where they actually are is
 * the highest-leverage trust move on the page. This is a StoryBrand "guide"
 * layer: the seller is the hero, we name their real fear in one honest line and
 * show how we handle it. Posture is low pressure and resource-first: asking a
 * question is a first-class action, and "not selling at all" is welcome.
 *
 * Grounded in the NAR seller-motivation categories (move closer to family,
 * too small, too large, relocation, life change, curiosity). We use the
 * CATEGORIES, never the secondary-summary percentages (CLAUDE.md §0 — no
 * unsourced numbers on the page).
 *
 * VOICE: "you" is the subject, we are the guide. Show a fact, do not claim a
 * virtue. No banned words, no em-dash, no semicolons. Specific promises, not
 * adjectives.
 *
 * Reusable on /sell and /lp/seller-home-value. The selected situation is
 * carried into the CTA as ?reason=<key> so follow-up can be tailored.
 *
 * TOKENS: design-token colors only, locked ladder, no raw controls. Content is
 * never gated on an animation (a switched panel is always visible).
 */

import { useCallback, useState } from 'react'
import {
  Body,
  CTAButton,
  Container,
  Eyebrow,
  H2,
  H3,
  Section,
  Stack,
} from '@/components/site/primitives'
import { cn } from '@/lib/utils'

const VALUATION_HREF = '/lp/seller-home-value'
const ASK_HREF = '/contact?inquiry=Selling'

type Situation = {
  key: string
  chip: string
  headline: string
  body: string
}

// Order leads with the calm, common situations and keeps "just curious" as a
// welcomed, first-class option (resource-first posture).
const SITUATIONS: Situation[] = [
  {
    key: 'curious',
    chip: 'Just curious',
    headline: 'You want a real number.',
    body: 'A broker’s written read on your home’s value, closer to what closed sales support than an online guess. We tell you who follows up and when. Plenty of people start here years before they sell.',
  },
  {
    key: 'downsizing',
    chip: 'Downsizing or retiring',
    headline: 'You have built real equity here, and you want to know what it means for what is next.',
    body: 'We start with your net number, what you would actually walk away with, before anything else. If the house needs work first, we line up the prep so it does not fall on you.',
  },
  {
    key: 'more-space',
    chip: 'Need more space',
    headline: 'You are ready for more room, and the timing is the hard part.',
    body: 'We walk through selling first or buying first with real math on carrying two homes, so you can move up without getting stuck between two houses.',
  },
  {
    key: 'relocating',
    chip: 'Relocating for work',
    headline: 'You are managing a move and a sale at the same time.',
    body: 'We map the sale to your move date and run it while you focus on the new place. If you are already out of the area, we handle showings, paperwork, and closing so you do not fly back for it.',
  },
  {
    key: 'inherited',
    chip: 'Inherited a home',
    headline: 'You did not plan for this, and there is a lot to sort out.',
    body: 'We have handled inherited homes before. We coordinate with the title company and the attorney, work with the other heirs, and manage a property you cannot be there for. No repairs needed to start the conversation.',
  },
  {
    key: 'life-change',
    chip: 'A life change',
    headline: 'Sometimes the house is the smallest part of what is going on.',
    body: 'One broker, at the pace that works for you. Start with a conversation. Nothing to sign until you decide to list.',
  },
  {
    key: 'sell-soon',
    chip: 'Need to sell soon',
    headline: 'You are on a timeline, and you do not want speed to cost you.',
    body: 'We lay out the tradeoff between speed and price for your situation, using local days on market, including the faster options. You decide when to move.',
  },
  {
    key: 'investment',
    chip: 'Investment or second home',
    headline: 'This is a numbers decision.',
    body: 'We work in net after costs, coordinate around tenants and showings, and know the 1031 clock is real, so we loop in your CPA early.',
  },
]

export function SellerSituations({ tone = 'default' }: { tone?: 'default' | 'muted' }) {
  const [active, setActive] = useState(0)
  const current = SITUATIONS[active]!

  const onKey = useCallback((e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i + 1) % SITUATIONS.length)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i - 1 + SITUATIONS.length) % SITUATIONS.length)
    }
  }, [])

  return (
    <Section id="your-situation" padding="default" tone={tone} divider>
      <Container>
        <Stack gap="tight" className="mb-8 max-w-2xl">
          <Eyebrow>Your situation</Eyebrow>
          <H2>What is bringing you to sell?</H2>
          <Body size="large" tone="muted" className="mt-1 leading-relaxed">
            Pick the situation that fits. We show you how we would handle it.
            If you are not selling yet and only want a number, that is a fine
            place to start.
          </Body>
        </Stack>

        {/* Situation chips */}
        <div role="radiogroup" aria-label="What is bringing you to sell" className="flex flex-wrap gap-2.5">
          {SITUATIONS.map((s, i) => (
            <div
              key={s.key}
              role="radio"
              aria-checked={active === i}
              tabIndex={active === i ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(i) }
                else onKey(e, i)
              }}
              className={cn(
                'cursor-pointer select-none rounded-full border px-4 py-2 text-sm font-semibold transition',
                active === i
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:border-primary/40',
              )}
            >
              {s.chip}
            </div>
          ))}
        </div>

        {/* Tailored reassurance — always visible, keyed by selection */}
        <div
          key={current.key}
          className="mt-6 rounded-[14px] border border-l-4 border-border border-l-primary bg-muted p-6 sm:p-8 motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-10">
            <div className="lg:col-span-2">
              <H3 className="max-w-xl leading-snug">{current.headline}</H3>
              <Body size="default" tone="muted" className="mt-3 max-w-xl leading-relaxed">
                {current.body}
              </Body>
            </div>
            <div className="flex flex-col gap-3 lg:items-end lg:justify-center">
              <CTAButton href={`${VALUATION_HREF}?reason=${current.key}`} tone="primary" size="md" className="w-full lg:w-auto">
                Get your home value
              </CTAButton>
              <CTAButton href={`${ASK_HREF}&reason=${current.key}`} tone="outline" size="md" className="w-full lg:w-auto">
                Ask a broker a question
              </CTAButton>
            </div>
          </div>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          Ask a question, get a written valuation, or just watch the market. You
          decide the pace.
        </p>
      </Container>
    </Section>
  )
}

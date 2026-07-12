'use client'

/**
 * SellPlanComparison — the full, service-by-service plan matrix for /sell.
 *
 * WHY THIS EXISTS: no Central Oregon brokerage publishes what each dollar of
 * commission actually buys. This table is the differentiator — a seller can
 * read, line by line, exactly what changes when they trim to Essential (2.5%)
 * or push to Elite (3.5%). 3% (Enhanced) is the standard everyone is compared
 * against, so it is the default-spotlit column.
 *
 * INTERACTION: a segmented plan picker. On phones the table shows one plan's
 * column at a time (three columns will not fit at 375px); the picker switches
 * it. On md+ all three columns show and the picker spotlights one.
 *
 * DATA ACCURACY (CLAUDE.md §0): every row and its tier assignment is taken from
 * the Ryan Realty Select Seller Plans document (Essential / Enhanced / Elite),
 * read cumulatively (each tier includes the one below it). Service quantities
 * that appear (300 homeowners, 200 mailers, 50 agents, 300 dollars) are the
 * plan's own committed figures, not market statistics. No third-party
 * percentages are asserted as fact.
 *
 * TOKENS: design-token classes only, shadcn <Table> + <ToggleGroup>, locked
 * size/space ladder.
 */

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Body, CTAButton, Eyebrow } from '@/components/site/primitives'
import { cn } from '@/lib/utils'

type Tri = [boolean, boolean, boolean] // [Essential, Enhanced, Elite]

type Feature = { label: string; tiers: Tri }
type Group = { title: string; features: Feature[] }

const PLANS = [
  { key: 'essential', name: 'Essential', rate: '2.5%' },
  { key: 'enhanced', name: 'Enhanced', rate: '3%' },
  { key: 'elite', name: 'Elite', rate: '3.5%' },
] as const

const GROUPS: Group[] = [
  {
    title: 'Pricing and the transaction',
    features: [
      { label: 'Written CMA with the comps behind your price', tiers: [true, true, true] },
      { label: 'Independent transaction coordinator through close', tiers: [true, true, true] },
      { label: 'One broker start to finish, reachable seven days a week', tiers: [true, true, true] },
      { label: 'A written report every week: showings, traffic, feedback', tiers: [true, true, true] },
      { label: 'Post-sale support for your next move', tiers: [true, true, true] },
      { label: 'Home warranty to take repair worry off the buyer', tiers: [false, false, true] },
    ],
  },
  {
    title: 'Where your home shows up',
    features: [
      { label: 'Central Oregon MLS', tiers: [true, true, true] },
      { label: 'Zillow, Redfin, Trulia and the national feeds', tiers: [true, true, true] },
      { label: 'Its own page on ryan-realty.com', tiers: [true, true, true] },
      { label: 'Vetted lender, title, mover and contractor network', tiers: [true, true, true] },
    ],
  },
  {
    title: 'Photography and media',
    features: [
      { label: 'Professional photography', tiers: [true, true, true] },
      { label: '3D walkthrough tour', tiers: [true, true, true] },
      { label: 'Yard sign with a QR code to the listing', tiers: [true, true, true] },
      { label: 'Aerial drone video', tiers: [false, true, true] },
      { label: 'Cinematic video walkthrough', tiers: [false, true, true] },
    ],
  },
  {
    title: 'Getting buyers through the door',
    features: [
      { label: 'Staging consult using your own furnishings', tiers: [true, true, true] },
      { label: 'Open houses on a set cadence', tiers: [false, true, true] },
      { label: 'Broker tour for local agents', tiers: [false, true, true] },
      { label: 'Virtual staging for vacant rooms', tiers: [false, true, true] },
      { label: 'A professional stager in the home', tiers: [false, false, true] },
      { label: 'Pre-listing inspection so nothing derails escrow', tiers: [false, false, true] },
    ],
  },
  {
    title: 'Marketing reach',
    features: [
      { label: 'Organic posts on @ryanrealtybend', tiers: [false, true, true] },
      { label: 'Short-form video (Reels, TikTok)', tiers: [false, true, true] },
      { label: 'Email to 300 nearby homeowners', tiers: [false, true, true] },
      { label: 'Printed mailers to 200 neighbors', tiers: [false, true, true] },
      { label: 'Direct outreach to thousands of local agents', tiers: [false, true, true] },
      { label: 'Outreach to 50 top agents in Portland, Seattle, LA and SF', tiers: [false, true, true] },
      { label: 'Paid Facebook and Instagram ads (300 dollar budget)', tiers: [false, false, true] },
      { label: 'Placement in Bend Magazine', tiers: [false, false, true] },
    ],
  },
  {
    title: 'While you are away',
    features: [
      { label: 'Remote-owner care: mail, snow, plant watering, security checks', tiers: [false, true, true] },
      { label: 'Move-out and deep-cleaning coordination', tiers: [false, true, true] },
    ],
  },
]

function Yes() {
  return (
    <svg aria-label="included" role="img" viewBox="0 0 20 20" className="mx-auto h-5 w-5 text-primary" fill="none">
      <circle cx="10" cy="10" r="9" className="fill-primary/10" />
      <path d="M6 10.5l2.5 2.5L14 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function No() {
  return (
    <svg aria-label="not included" role="img" viewBox="0 0 20 20" className="mx-auto h-5 w-5 text-muted-foreground/40" fill="none">
      <path d="M6.5 10h7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

export function SellPlanComparison() {
  // Default spotlight = Enhanced (3%), the standard every home is compared to.
  const [active, setActive] = useState(1)

  return (
    <div>
      {/* Plan picker — segmented control */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Eyebrow>Compare line by line</Eyebrow>
        <div
          role="group"
          aria-label="Choose a plan to compare"
          className="inline-flex self-start gap-1 rounded-[10px] border border-border bg-muted p-1"
        >
          {PLANS.map((p, i) => (
            <CTAButton
              key={p.key}
              tone={i === active ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActive(i)}
              aria-label={`Compare the ${p.name} plan at ${p.rate}`}
              className="tabular-nums"
            >
              <span className="hidden sm:inline">{p.name}&nbsp;</span>
              {p.rate}
            </CTAButton>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead
                className="w-1/2 py-4 pl-5 align-bottom text-foreground"
                style={{ whiteSpace: 'normal' }}
              >
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  What is included
                </span>
              </TableHead>
              {PLANS.map((p, i) => (
                <TableHead
                  key={p.key}
                  className={cn(
                    'py-4 text-center align-bottom',
                    i === active ? 'bg-primary/5' : 'hidden md:table-cell',
                  )}
                >
                  <span
                    className={cn(
                      'block font-display text-2xl leading-none',
                      i === active ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {p.rate}
                  </span>
                  <span className="mt-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {p.name}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {GROUPS.map((group) => (
              <GroupRows key={group.title} group={group} active={active} />
            ))}
          </TableBody>
        </Table>
      </div>

      <Body size="default" tone="muted" className="mt-4 max-w-3xl leading-relaxed">
        Every plan runs on the same schedule and the same weekly report. The
        difference is reach. Essential covers the essentials, Enhanced is the
        full-court press most homes get, and Elite adds the channels that matter
        for a harder sale or a higher price. Commission is negotiable, and every
        listing agreement is its own conversation.
      </Body>
    </div>
  )
}

function GroupRows({ group, active }: { group: Group; active: number }) {
  return (
    <>
      <TableRow className="border-border bg-muted/60 hover:bg-muted/60">
        <TableCell colSpan={4} className="py-2.5 pl-5">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            {group.title}
          </span>
        </TableCell>
      </TableRow>
      {group.features.map((f) => (
        <TableRow key={f.label} className="border-border transition-colors hover:bg-muted/40">
          <TableCell className="py-3 pl-5 pr-3 align-middle" style={{ whiteSpace: 'normal' }}>
            <Body size="default" className="leading-snug">
              {f.label}
            </Body>
          </TableCell>
          {f.tiers.map((has, i) => (
            <TableCell
              key={i}
              className={cn(
                'py-3 text-center align-middle',
                i === active ? 'bg-primary/5' : 'hidden md:table-cell',
              )}
            >
              {has ? <Yes /> : <No />}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

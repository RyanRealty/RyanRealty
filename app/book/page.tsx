// @no-breadcrumb — a standalone task surface, not a content page. The same
// reason app/lp/* and app/sign/* are exempt: "Home > Book a broker" describes
// no hierarchy a visitor is navigating.
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site/page-metadata'
import { getCrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'
import { getBrokerBusyIntervals } from '@/lib/data/crm/bookingAvailability'
import {
  generateDaySlots,
  upcomingDateKeys,
  type Slot,
} from '@/lib/booking/slots'
import { formatDate } from '@/lib/format/date'
import {
  V3Footer,
  V3Quiet,
  V3SectionTracker,
  V3_FOOTER_COLUMNS,
  V3_ROOT_CLASS,
} from '@/components/site/v3'
import BookingClient from './BookingClient'

/**
 * /book — the public appointment surface.
 *
 * The page READS availability through the DAL and composes it with the pure
 * slot engine; app/actions/book-appointment owns only the WRITE. That split is
 * why this file, not the action, holds the data imports (G8).
 *
 * force-dynamic because a cached availability page offers slots that are
 * already gone (see reference_isr_caches_empty_fallback).
 */
export const dynamic = 'force-dynamic'

/** How far ahead the public surface will offer time. */
const HORIZON_DAYS = 21

const BROKER_SLUGS = ['matt', 'rebecca', 'paul'] as const

export const metadata: Metadata = pageMetadata({
  path: '/book',
  title: 'Book time with a broker',
  description:
    'Pick a time that works and a licensed Central Oregon broker will be there. No call center.',
})

type BookableDay = { dateKey: string; label: string; slots: Slot[] }

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>
}) {
  const params = await searchParams
  const requested = String(params.agent ?? '').trim().toLowerCase()
  const brokerSlug = (BROKER_SLUGS as readonly string[]).includes(requested) ? requested : 'matt'

  const settings = await getCrmCompanySettings()
  const timeZone = settings.time_zone || 'America/Los_Angeles'
  const now = new Date()
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60_000)

  let days: BookableDay[] = []
  let available = true
  try {
    const busy = await getBrokerBusyIntervals({
      brokerSlug,
      fromIso: now.toISOString(),
      toIso: horizon.toISOString(),
      timeZone,
    })
    for (const dateKey of upcomingDateKeys(now, HORIZON_DAYS, timeZone)) {
      const slots = generateDaySlots({
        dateKey,
        blocks: settings.booking_hours,
        timeZone,
        busy,
        now,
        horizon,
      })
      if (slots.length === 0) continue
      days.push({
        dateKey,
        label: formatDate(dateKey, {
          timeZone, weekday: 'long', month: 'long', day: 'numeric', year: undefined,
        }),
        slots,
      })
    }
  } catch {
    // The availability read fails CLOSED. Offering a calendar we could not
    // verify would double-book a broker.
    available = false
    days = []
  }

  return (
    <>
    <main className={V3_ROOT_CLASS}>
      <V3SectionTracker />

      {/* Quiet opens the surface and the Sheet does the work, which is the
          opening PUBLIC_UI.md section 3 gives About and every other page whose
          job is a single step. The lede is one passage, so it is a Quiet prose
          item rather than a loose paragraph the token scope would not style. */}
      <V3Quiet
        id="book-intro"
        heading="Book time with a broker"
        headingLevel={1}
        items={[
          {
            kind: 'prose',
            body: 'Pick a time that works. A licensed Oregon broker will be on the other end, not a call center.',
          },
        ]}
      />

      <section aria-label="Available times" className="mx-auto w-full max-w-3xl px-5 pb-16">
        <BookingClient
          days={days}
          brokerSlug={brokerSlug}
          timeZone={timeZone}
          available={available}
        />
      </section>

    </main>

    {/* This surface shows the site header, so it owes the site footer too: the
        footer is route-owned here, not rendered by the layout. Outside <main> on
        purpose -- HTML-AAM maps <footer> to role=contentinfo only when it is not
        nested in sectioning content, and it sat inside until 2026-08-27, so this
        page had the right footer and no contentinfo landmark. */}
    <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

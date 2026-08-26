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
import { H1, Body, Container, Section } from '@/components/site/primitives'
import { V3Footer, V3_FOOTER_COLUMNS } from '@/components/site/v3'
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
      <Section>
      <Container>
        <div className="mx-auto max-w-3xl">
          <H1>Book time with a broker</H1>
          <Body className="mt-4 max-w-2xl">
            Pick a time that works. A licensed Oregon broker will be on the other end, not a call
            center.
          </Body>

          <div className="mt-10">
            <BookingClient
              days={days}
              brokerSlug={brokerSlug}
              timeZone={timeZone}
              available={available}
            />
          </div>
        </div>
      </Container>
        </Section>
      {/* This surface shows the site header, so it owes the site footer too:
          the footer is route-owned here, not rendered by the layout. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

/**
 * Below the proof: What Ryan Realty does, the differentiators, Key facts in one <dl>, and the same business day reply.
 *
 * /about below the proof: the About-page AEO playbook sections (Matt
 * 2026-09-23). Everything a visitor reads in What Ryan Realty does, What makes
 * Ryan Realty different, Who Ryan Realty works with, How Ryan Realty works,
 * The team behind Ryan Realty and Key facts is built here, from:
 *
 *   - lib/brand/contact.ts            name, legal name, LLC year, office opening,
 *                                     address, website, social, phone, email
 *   - app/sell/_v3/sell-constants.ts  LISTING_TERMS / LISTING_FEE_PERCENT (the
 *                                     3% fee and what it covers, one spelling)
 *   - lib/sell/publish-sell-valuation SELL_VALUATION_CONFIRM_SLA ("within 24 hours")
 *   - app/buy/_v3/buy-constants.ts    what a buyer gets (search, tours, comps,
 *                                     the same broker to the closing table)
 *   - the live reads the page already makes: the roster (public.brokers), the
 *     closings record (the same tiles as the closings rail), the Google reviews,
 *     and crm_company_settings.booking_hours.
 *
 * Nothing here fetches. A live value that did not load is left out rather than
 * guessed (CLAUDE.md §0), so every builder takes it as nullable.
 *
 * NO COMPETITOR IS NAMED, and no claim is a comparison (Matt 2026-09-23: NAR
 * Code Article 15 and the Oregon advertising rules). Clients are named by what
 * they need, never by who they are (fair housing). No em dashes (VOICE.md).
 *
 * THE REPLY-TIME PROMISE is Matt's commitment of 2026-09-23 ("same business
 * day"), stated plainly as his. It is not a measured response time; V3OnDuty
 * still prints only the published hours against the clock (SITE-09).
 */

import { BRAND, BROKERS, CONTACT } from '@/lib/brand/contact'
import { OFFICE_DAYS, parseHm, type OfficeDay } from '@/lib/crm/office-hours'
import type { OfficeHoursBlock } from '@/lib/data/crm/getCrmCompanySettings'
import { formatCalendarDay } from '@/lib/format/date'
import { SELL_VALUATION_CONFIRM_SLA } from '@/lib/sell/publish-sell-valuation'
import { LISTING_FEE_PERCENT, LISTING_TERMS } from '@/app/sell/_v3/sell-constants'
import { hmLabel } from '@/components/site/v3'
import type {
  V3Claim,
  V3Entry,
  V3Fact,
  V3MarkStripProps,
  V3QuietItem,
  V3RollItem,
  V3Step,
  V3StepsFact,
} from '@/components/site/v3'
import type { FirmClosingRecord } from '@/app/team/[slug]/_v3/sale-rows'
import { ABOUT_CITY_LABELS, FIRM_LICENSE, countWord, roleWords } from './about-constants'

/** Matt 2026-09-23: the reply-time promise, in his words. */
export const ABOUT_REPLY_PROMISE = 'same business day'

/** The firm's category, as the opening sentence and the key facts both say it. */
export const ABOUT_FIRM_TYPE = 'Boutique real estate brokerage'

const OFFICE_LINE = `${BRAND.address.street}, ${BRAND.address.city}, ${BRAND.address.region} ${BRAND.address.postalCode}`
const FIRM_LICENSE_NUMBER = FIRM_LICENSE.replace(/^OREA\s+/, '')

/* -------------------------------------------------------------------------- */
/* Live inputs                                                                 */
/* -------------------------------------------------------------------------- */

export type AboutPerson = { name: string; title: string; href: string; src?: string | null }

export type AboutReviewsFigure = { average: number; count: number } | null

const DAY_LONG: Record<OfficeDay, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
}

function dayPhrase(days: readonly OfficeDay[]): string {
  const order = [...days].sort((a, b) => OFFICE_DAYS.indexOf(a) - OFFICE_DAYS.indexOf(b))
  const indexes = order.map((d) => OFFICE_DAYS.indexOf(d))
  const contiguous = indexes.every((value, i) => i === 0 || value === (indexes[i - 1] ?? -2) + 1)
  const names = order.map((d) => DAY_LONG[d])
  if (names.length === 1) return names[0] ?? ''
  if (contiguous && names.length >= 3) return `${names[0]} through ${names[names.length - 1]}`
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

/**
 * "Monday through Saturday, 9:00 am to 5:00 pm Pacific", from the published
 * booking_hours rows (the same rows V3OnDuty and /book read). Null when no
 * block parses: the page then prints no hours rather than guessing.
 */
export function aboutHoursSentence(
  blocks: readonly OfficeHoursBlock[] | null | undefined,
  timeZone: string | null | undefined,
): string | null {
  const parts: string[] = []
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const start = parseHm(block?.start_time)
    const end = parseHm(block?.end_time)
    const rawDays: readonly string[] = Array.isArray(block?.days) ? block.days : []
    const days = rawDays.filter((d): d is OfficeDay => (OFFICE_DAYS as readonly string[]).includes(d))
    if (start == null || end == null || days.length === 0) continue
    parts.push(`${dayPhrase([...new Set(days)])}, ${hmLabel(start)} to ${hmLabel(end)}`)
  }
  if (parts.length === 0) return null
  const zone = (timeZone || 'America/Los_Angeles') === 'America/Los_Angeles' ? ' Pacific' : ''
  return `${parts.join('; ')}${zone}`
}

/** "Apr 2015 to Sep 2026" from the closings record, or null when undated. */
export function aboutClosingSpan(record: FirmClosingRecord | null | undefined): string | null {
  if (!record?.firstClose || !record.lastClose) return null
  const opts = { month: 'short', day: undefined, year: 'numeric' } as const
  const first = formatCalendarDay(record.firstClose, opts)
  const last = formatCalendarDay(record.lastClose, opts)
  if (!first || !last) return null
  return first === last ? first : `${first} to ${last}`
}

/* -------------------------------------------------------------------------- */
/* What Ryan Realty does                                                       */
/* -------------------------------------------------------------------------- */

export const ABOUT_SERVICES_LEDE =
  'Whether it is a first home, a ranch, or a rental, the work starts with a licensed broker who knows the neighborhood and stays with you through closing.'

/** Each service: what it is and what the client gets. The door is the page that delivers it. */
export function aboutServices(valuationHref: string): V3Entry[] {
  return [
    {
      id: 'service-selling',
      title: 'Selling a home',
      body: `We price your home from recent closed sales near you, put it in front of buyers, and negotiate every offer. ${LISTING_TERMS.fee} ${LISTING_TERMS.covers}`,
      door: { label: 'How we sell a home', href: '/sell' },
    },
    {
      id: 'service-buying',
      title: 'Buying a home',
      body: 'We set up an MLS search to your criteria and send new matches the day they list. We tour homes with you, pull the recent closed sales for the address you like, and write and negotiate your offer from those numbers.',
      door: { label: 'Buying with Ryan Realty', href: '/buy' },
    },
    {
      id: 'service-valuation',
      title: 'Free home valuation',
      body: `A broker prepares a written comparative market analysis from recent closed sales and current listings near you, and sends it ${SELL_VALUATION_CONFIRM_SLA}. It is free, with no listing agreement and no obligation.`,
      door: { label: 'Value my home', href: valuationHref },
    },
    {
      id: 'service-relocation',
      title: 'Relocating to Central Oregon',
      body: 'Moving here from somewhere else? We help you compare Bend, Redmond, Sisters, Sunriver, and the towns around them with live listings and recent sales, then tour the homes that fit when you visit.',
      door: { label: 'Central Oregon towns', href: '/cities' },
    },
    {
      id: 'service-rural-resort',
      title: 'Rural, land, and resort property',
      body: 'Rural parcels raise questions a city lot does not, like the well and the septic, and we get the answers before you write an offer. In resort communities with few sales, we widen the comp window and show you which sales we used and why.',
      door: { label: 'Resort communities', href: '/communities' },
    },
    {
      id: 'service-investment',
      title: 'Investment property',
      body: 'We help investors buy multi-family, rental, and land property across Central Oregon. Every offer starts from the recent closed sales behind the price, not from the asking price.',
      door: { label: 'Investment property', href: '/invest' },
    },
  ]
}

/* -------------------------------------------------------------------------- */
/* What makes Ryan Realty different                                            */
/* -------------------------------------------------------------------------- */

/**
 * Five of our own facts, each with the figure that proves it. A claim whose
 * live figure did not load is dropped, never printed without its number.
 */
export function aboutDifferentiators(input: {
  reviews: AboutReviewsFigure
  record: FirmClosingRecord | null
  valuationHref: string
}): V3Claim[] {
  const claims: V3Claim[] = []
  const { reviews, record } = input
  if (reviews && reviews.count > 0) {
    const average = reviews.average.toFixed(1)
    claims.push({
      id: 'different-reviews',
      figure: { value: average, label: `Google rating, ${reviews.count} reviews` },
      title: 'Reviews you can read in full',
      body: `Our ${reviews.count} Google reviews average ${average} out of 5. Every one is on the reviews page in full, exactly as it was written.`,
      door: { label: 'Read every review', href: '/reviews' },
    })
  }
  claims.push({
    id: 'different-listing',
    figure: { value: LISTING_FEE_PERCENT, label: 'Listing fee, no add-ons' },
    title: 'The same listing at every price point',
    body: `Every listing gets professional photography, a video, and a 3D walkthrough, whatever the price. The fee is ${LISTING_FEE_PERCENT} of the sale price, with no add-on fees.`,
    door: { label: 'How we list a home', href: '/sell' },
  })
  claims.push({
    id: 'different-valuation',
    figure: { value: '24', label: 'Hours to a written valuation' },
    title: `A written valuation ${SELL_VALUATION_CONFIRM_SLA}`,
    body: `Ask for your home's value and a broker sends a written comparative market analysis ${SELL_VALUATION_CONFIRM_SLA}, with the closed and active sales behind the range. There is no listing agreement attached.`,
    door: { label: 'Value my home', href: input.valuationHref },
  })
  const firstYear = record?.firstClose?.slice(0, 4)
  if (record && record.count > 0 && firstYear) {
    const strip = aboutClosingStrip(record)
    claims.push({
      id: 'different-closings',
      figure: { value: String(record.count), label: `Closings since ${firstYear}` },
      title: 'Our closings are public',
      body: 'Every closing above is a recorded MLS sale, shown with its address, the price it closed at, and the date. Each one links to the home.',
      door: { label: 'See the closings', href: '#firm-sales' },
      ...(strip ? { strip } : {}),
    })
  }
  claims.push({
    id: 'different-broker',
    figure: { value: '1', label: 'Broker, first call to closing' },
    title: 'One broker from your first call to closing',
    body: 'The broker you start with is the broker who negotiates for you and sits with you at closing. You are never handed to a junior agent.',
    door: { label: 'The brokers', href: '/team' },
  })
  return claims
}

/** The one trace line under the claims band (§0), in a visitor's words. */
export function aboutDifferentiatorsSource(input: {
  reviews: AboutReviewsFigure
  record: FirmClosingRecord | null
}): string | undefined {
  const parts: string[] = []
  if (input.reviews && input.reviews.count > 0) parts.push('Rating and count from our Google Business Profile reviews.')
  const span = aboutClosingSpan(input.record)
  if (input.record && input.record.count > 0 && span) {
    parts.push(`Closings from the MLS record for Ryan Realty brokers, ${span}.`)
  }
  return parts.length > 0 ? parts.join(' ') : undefined
}

/* -------------------------------------------------------------------------- */
/* Who Ryan Realty works with                                                  */
/* -------------------------------------------------------------------------- */

/** Clients by what they need. Never a protected class (fair housing). */
export const ABOUT_CLIENTS: V3RollItem[] = [
  { label: 'First-time buyers', href: '/buy' },
  { label: 'Home sellers', href: '/sell' },
  { label: 'People relocating to Central Oregon', href: '/cities' },
  { label: 'Second-home and resort-community buyers', href: '/communities' },
  { label: 'Land and rural buyers', href: '/homes-for-sale' },
  { label: 'Investors', href: '/invest' },
  { label: 'Brokers referring a client', href: '/refer-a-client' },
]

export const ABOUT_CLIENTS_LEDE = 'Buyers and sellers across Central Oregon, at every price point.'

/* -------------------------------------------------------------------------- */
/* How Ryan Realty works                                                       */
/* -------------------------------------------------------------------------- */

export const ABOUT_PROMISE_LINE = `We reply the ${ABOUT_REPLY_PROMISE}.`

export const ABOUT_HOW_STEPS: V3Step[] = [
  {
    id: 'how-reach',
    title: 'Call, text, email, or schedule',
    body: `Call or text ${CONTACT.phoneDirect}, send an email, or book a time online. You talk directly with a licensed broker, not a call center.`,
  },
  {
    id: 'how-start',
    title: 'Your first conversation',
    body: `Tell us what you want to buy or sell, your timing, and the neighborhoods you have in mind. Sellers get a written valuation ${SELL_VALUATION_CONFIRM_SLA}; buyers get an MLS search set to their criteria.`,
  },
  {
    id: 'how-close',
    title: 'Through closing',
    body: 'Your broker writes and negotiates the offer, reads every document with you, and stays with you from inspection and appraisal to the closing table.',
  },
]

export function aboutHowFacts(hours: string | null): V3StepsFact[] {
  return [
    ...(hours ? [{ term: 'Office hours', value: hours }] : []),
    { term: 'Office', value: OFFICE_LINE },
  ]
}

/* -------------------------------------------------------------------------- */
/* The team behind Ryan Realty                                                 */
/* -------------------------------------------------------------------------- */

/** The origin, as Matt tells it (VOICE.md exemplar bio, 2026-09-07). */
export function aboutOriginBody(): string {
  return `${BROKERS.matt.nameShort}, ${roleWords(BROKERS.matt.title)}, started ${BRAND.legalName} in ${BRAND.llcSince} and opened the Bend office in ${BRAND.foundedLabel}, after years in the fire service. He learned the business from his mentor, Hjalmar "Red" Erickson, and runs the brokerage the way Red taught him: every client gets the same care and the same effort.`
}

/** Team composition from the live roster. Null when the roster did not load. */
export function aboutTeamBody(people: readonly AboutPerson[]): string | null {
  const count = people.filter((p) => p.name.trim()).length
  if (count === 0) return null
  const word = countWord(count)
  const noun = count === 1 ? 'licensed broker' : 'licensed brokers'
  const where =
    count === 1
      ? 'who lives and works in Central Oregon'
      : `and all ${word} live and work in Central Oregon`
  const sentence = count === 1 ? `Ryan Realty has ${word} ${noun} ${where}.` : `Ryan Realty has ${word} ${noun}, ${where}.`
  return `${sentence} Each broker's page has their Oregon license, recorded closings, and direct line.`
}

/** A door per broker, lighter than a cell: one inline line, never roster cards. */
export function aboutBrokerDoors(people: readonly AboutPerson[]): V3QuietItem[] {
  return people
    .filter((p) => p.name.trim() && p.href.trim())
    .map((p) => ({
      label: p.name,
      href: p.href,
      weight: 'secondary' as const,
      mark: 'person' as const,
      ...(p.src ? { media: { src: p.src, alt: '' } } : {}),
    }))
}

const SOCIAL_LABELS: Record<keyof typeof BRAND.social, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  x: 'X',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
  threads: 'Threads',
  googleBusinessProfile: 'Google',
}

/** The firm's profiles, in the locked sameAs order (lib/brand/contact.ts). */
export const ABOUT_SOCIAL_LINKS: Array<{ label: string; href: string }> = (
  Object.keys(BRAND.social) as Array<keyof typeof BRAND.social>
).map((key) => ({ label: SOCIAL_LABELS[key], href: BRAND.social[key] }))

/**
 * The profiles as one inline line, under their own label so they do not fold
 * into the license door's group (a label row ends a door run in V3Quiet).
 */
export function aboutSocialDoors(): V3QuietItem[] {
  return [
    { kind: 'prose', term: 'Ryan Realty online', body: [] },
    ...ABOUT_SOCIAL_LINKS.map((link) => ({ ...link, weight: 'secondary' as const })),
  ]
}

/* -------------------------------------------------------------------------- */
/* Key facts about Ryan Realty                                                 */
/* -------------------------------------------------------------------------- */

/** Service area as the key facts print it and areaServed carries it. */
export const ABOUT_SERVICE_AREA: string[] = [...ABOUT_CITY_LABELS, 'Tumalo']

function listWords(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

/** Read after the figure: "3% of the sale price as the listing fee, ..." */
export const ABOUT_PRICING = `of the sale price as the listing fee, with no add-on fees. ${LISTING_TERMS.buyerAgent}. Home valuations are free.`

export const ABOUT_CORE_OFFERING =
  'Helping clients buy and sell homes, land, and resort property in Central Oregon, with one broker from first call to closing.'

export const ABOUT_COMMUNICATION = `Call or text ${CONTACT.phoneDirect}, email, or schedule a time. We reply the ${ABOUT_REPLY_PROMISE}.`

/** The written channels behind ABOUT_COMMUNICATION, as doors on the fact. */
export const ABOUT_COMMUNICATION_LINKS = [
  { label: CONTACT.email.primary, href: `mailto:${CONTACT.email.primary}` },
  { label: 'Schedule online', href: '/book' },
]

/**
 * The key facts sheet. Rows with a live value that did not load are left out
 * (the founder, the brokers, the hours, the closings, the reviews).
 */
export function aboutKeyFacts(input: {
  founder: AboutPerson | null
  people: readonly AboutPerson[]
  services: readonly V3Entry[]
  hours: string | null
  record: FirmClosingRecord | null
  reviews: AboutReviewsFigure
}): V3Fact[] {
  const facts: V3Fact[] = [
    { id: 'fact-name', term: 'Company name', value: BRAND.name, detail: `Legal name ${BRAND.legalName}` },
    { id: 'fact-type', term: 'Type', value: ABOUT_FIRM_TYPE },
    {
      id: 'fact-founded',
      term: 'Founded',
      figure: BRAND.llcSince,
      value: `as ${BRAND.legalName}`,
      detail: `Bend office opened ${BRAND.foundedLabel}`,
    },
  ]
  if (input.founder) {
    facts.push({
      id: 'fact-founder',
      term: 'Founder',
      links: [{ label: `${input.founder.name}, ${titleWords(input.founder.title)}`, href: input.founder.href }],
    })
  }
  const named = input.people.filter((p) => p.name.trim() && p.href.trim())
  if (named.length > 0) {
    facts.push({
      id: 'fact-brokers',
      term: 'Brokers',
      figure: String(named.length),
      value: `licensed ${named.length === 1 ? 'broker' : 'brokers'}`,
      links: named.map((p) => ({ label: p.name, href: p.href })),
    })
  }
  facts.push(
    { id: 'fact-headquarters', term: 'Headquarters', value: OFFICE_LINE, detail: 'Downtown Bend, Oregon' },
    { id: 'fact-website', term: 'Website', links: [{ label: BRAND.domain, href: BRAND.url }] },
    { id: 'fact-offering', term: 'Core offering', value: ABOUT_CORE_OFFERING },
    { id: 'fact-pricing', term: 'Pricing', figure: LISTING_FEE_PERCENT, value: ABOUT_PRICING },
    {
      id: 'fact-services',
      term: 'Services',
      value: input.services.map((s) => s.title).join('; '),
    },
    {
      id: 'fact-communication',
      term: 'Communication',
      value: ABOUT_COMMUNICATION,
      links: ABOUT_COMMUNICATION_LINKS,
    },
  )
  if (input.hours) facts.push({ id: 'fact-hours', term: 'Office hours', value: input.hours })
  facts.push(
    {
      id: 'fact-area',
      term: 'Service area',
      value: `Central Oregon: ${listWords(ABOUT_SERVICE_AREA)}`,
      detail: 'Plus the resort communities, including Tetherow, Pronghorn, Eagle Crest, and Brasada Ranch',
    },
    {
      id: 'fact-license',
      term: 'Brokerage license',
      value: `Oregon Real Estate Agency firm license ${FIRM_LICENSE_NUMBER}`,
      detail: `Principal broker license ${BROKERS.matt.license}`,
    },
  )
  const span = aboutClosingSpan(input.record)
  if (input.record && input.record.count > 0) {
    facts.push({
      id: 'fact-clients',
      term: 'Clients served',
      figure: String(input.record.count),
      value: `recorded ${input.record.count === 1 ? 'closing' : 'closings'} in Central Oregon`,
      detail: span ? `MLS record, ${span}` : 'MLS record',
    })
  }
  if (input.reviews && input.reviews.count > 0) {
    facts.push({
      id: 'fact-reviews',
      term: 'Reviews',
      figure: input.reviews.average.toFixed(1),
      value: `average from ${input.reviews.count} Google reviews`,
      links: [{ label: 'Read every review', href: '/reviews' }],
    })
  }
  facts.push({ id: 'fact-social', term: 'Social', links: ABOUT_SOCIAL_LINKS })
  return facts
}

const MONTH_YEAR = { month: 'short', day: undefined, year: 'numeric' } as const

/**
 * The closings record drawn: one mark per dated closing, placed by its close
 * day between the first and the last, labelled with the address and the
 * recorded price the rail prints. Null when fewer than two dated closings or
 * no span (a line needs two ends).
 */
export function aboutClosingStrip(
  record: FirmClosingRecord | null | undefined,
): Omit<V3MarkStripProps, 'className'> | null {
  const dated = record?.dated ?? []
  if (!record?.firstClose || !record.lastClose || dated.length < 2) return null
  const start = Date.parse(`${record.firstClose}T12:00:00Z`)
  const end = Date.parse(`${record.lastClose}T12:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  const from = formatCalendarDay(record.firstClose, MONTH_YEAR)
  const to = formatCalendarDay(record.lastClose, MONTH_YEAR)
  const notes = officeNote(start, end)
  return {
    label: `${record.count} recorded closings from ${from} to ${to}, one mark per closing${
      notes.length > 0 ? `, with the Bend office opening in ${BRAND.foundedLabel} marked` : ''
    }`,
    from,
    to,
    marks: dated.map((mark) => ({
      at: (Date.parse(`${mark.day}T12:00:00Z`) - start) / (end - start),
      label: `${mark.what}, ${mark.value}, ${formatCalendarDay(mark.day, MONTH_YEAR)}`,
    })),
    notes,
  }
}

/** The Bend office opening (BRAND.founded) on the closings line, when it falls inside it. */
function officeNote(start: number, end: number): Array<{ at: number; label: string }> {
  const opened = Date.parse(`${BRAND.founded}T12:00:00Z`)
  if (!Number.isFinite(opened) || opened <= start || opened >= end) return []
  return [{ at: (opened - start) / (end - start), label: `Bend office, ${formatCalendarDay(BRAND.founded, MONTH_YEAR)}` }]
}

/** "Owner & Principal Broker" -> "Owner and Principal Broker". */
function titleWords(title: string): string {
  return title.trim().replace(/\s*&\s*/g, ' and ')
}

/* -------------------------------------------------------------------------- */
/* JSON-LD: the Organization facts this page shows                             */
/* -------------------------------------------------------------------------- */

/** Every value here is printed in the key facts or What Ryan Realty does. */
export function aboutOrganizationFacts(input: { services: readonly V3Entry[]; brokerCount: number }) {
  return {
    knowsAbout: input.services.map((s) => s.title),
    areaServed: ['Central Oregon', ...ABOUT_SERVICE_AREA],
    numberOfEmployees: input.brokerCount > 0 ? input.brokerCount : undefined,
    services: input.services.map((s) => ({
      name: s.title,
      description: typeof s.body === 'string' ? s.body : s.body.join(' '),
      url: s.door?.href,
    })),
  }
}

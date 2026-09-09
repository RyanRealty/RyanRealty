/**
 * About first-viewport faces. Canonical transparent PNGs only
 * (`/images/brokers/*.png`). JPG fallbacks carry a white box and are refused.
 * Remote photo_url values are refused — those are not the locked cutouts.
 * Call / text hrefs are derived from the live broker phone, never invented.
 */

import { BROKERS, type BrokerKey } from '@/lib/brand/contact'
import { teamPath } from '@/lib/slug'

/**
 * One differentiator per broker, beyond contact plumbing (SITE-48).
 *
 * The taste table scored /team 39 and named the cause: "three identical
 * directory cards … with no bio, specialty, tenure, or sales fact to
 * differentiate one broker from another". The fix has to be a FIGURE that is
 * this broker's and no one else's, and section 0 decides where it may come
 * from — the MLS record SITE-11 reads, never a self-declared specialty tag.
 *
 * A broker with nothing on the record carries NO record block. Unknown is not
 * zero: a card that printed "0 closings" would be publishing a number the data
 * does not support about a licensed broker.
 */
export type AboutFaceRecord = {
  /** The figure itself, formatted. */
  value: string
  /** The plain sentence beside it: "closings in the last 12 months". */
  label: string
  /** Where those transactions were, largest first. Empty is allowed. */
  places: readonly { name: string; n: number }[]
  /** The disclosure's control: "Where those closings were". */
  placesSummary: string
  /** The section 0 trace for the figure and the places. */
  trace: string
  /** The source's short name for the folded clause. */
  sourceName: string
}

export type AboutFace = {
  href: string
  src: string
  name: string
  title: string
  tel: string | null
  email: string | null
  /** /book?agent=<key> when the roster knows this broker. */
  bookHref: string | null
  /** Oregon license digits from live RR data / BROKERS. Never invented. */
  license: string | null
  /** Readable dotted phone for above-the-fold contact (not icon-only). */
  phoneDisplay: string | null
  /** This broker's own MLS record, when there is one. See AboutFaceRecord. */
  record?: AboutFaceRecord | null
}

const CANONICAL_HEADSHOT = /^\/images\/brokers\/[a-z0-9-]+\.png$/

const BROKER_BY_SLUG = new Map<string, (typeof BROKERS)[BrokerKey]>(
  (Object.keys(BROKERS) as BrokerKey[]).map((key) => [BROKERS[key].slug, BROKERS[key]]),
)

const BOOK_KEY_BY_SLUG = new Map<string, BrokerKey>(
  (Object.keys(BROKERS) as BrokerKey[]).map((key) => [BROKERS[key].slug, key]),
)

/** Public booking surface for a known broker. Null when the slug is not on the roster. */
export function aboutBookHref(slug: string): string | null {
  const key = BOOK_KEY_BY_SLUG.get(slug)
  return key ? `/book?agent=${key}` : null
}

/** E.164 for tel: / sms:. Null when the number cannot parse. */
export function aboutPhoneE164(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return digits.length === 10 ? `+1${digits}` : null
}

/**
 * The everyday display form for a broker the roster knows, falling back to the
 * `brokers.display_name` the DAL returned. `display_name` carries the LEGAL
 * name ("Rebecca Ryser Peterson"); `nameShort` is what the site shows. Every
 * place /about prints a broker's name goes through here, so the page cannot
 * print two spellings of one person again (2026-09-02).
 */
export function aboutDisplayName(slug: string, fullName: string): string {
  return BROKER_BY_SLUG.get(slug)?.nameShort ?? fullName
}

export type AboutReachRow = {
  kind: 'call' | 'text' | 'book'
  href: string
  /** The row label at every width. */
  label: string
  /**
   * Shown beside the label from 48rem up, where a tel: link is not a tap: the
   * broker's own number on Call, "Same number" on Text (the digits print once,
   * so two identical rows never read as a data error), what /book offers on
   * Book. Never an invented number: null when the roster has no display phone.
   */
  detail: string | null
  ariaLabel: string
}

/**
 * The compact (homepage) reach rows, in table order: Call, Text, Book. Email
 * and Schedule stay on the roster and the portrait. A row the broker cannot
 * take is absent, never a placeholder, so no dead link ships.
 */
export function aboutCompactReach(
  person: Pick<AboutFace, 'name' | 'tel' | 'phoneDisplay' | 'bookHref'>,
): AboutReachRow[] {
  const rows: AboutReachRow[] = []
  if (person.tel) {
    rows.push({
      kind: 'call',
      href: `tel:${person.tel}`,
      label: 'Call',
      detail: person.phoneDisplay,
      ariaLabel: `Call ${person.name}`,
    })
    rows.push({
      kind: 'text',
      href: `sms:${person.tel}`,
      label: 'Text',
      detail: person.phoneDisplay ? 'Same number' : null,
      ariaLabel: `Text ${person.name}`,
    })
  }
  if (person.bookHref) {
    rows.push({
      kind: 'book',
      href: person.bookHref,
      label: 'Book',
      detail: 'Pick a time',
      ariaLabel: `Book time with ${person.name}`,
    })
  }
  return rows
}

export function aboutFaceFromBroker(b: {
  slug: string
  fullName: string | null | undefined
  title?: string | null
  headshotPng?: string | null
  phoneDirect?: string | null
  email?: string | null
  licenseNumber?: string | null
}): AboutFace | null {
  const name = b.fullName?.trim()
  const slug = b.slug?.trim()
  const src = b.headshotPng?.trim()
  if (!name || !slug || !src) return null
  if (!CANONICAL_HEADSHOT.test(src)) return null
  const title = b.title?.trim()
  const roster = BROKER_BY_SLUG.get(slug)
  const license = b.licenseNumber?.trim() || roster?.license || null
  const phoneDisplay = b.phoneDirect?.trim() || null
  return {
    href: teamPath(slug),
    src,
    name: aboutDisplayName(slug, name),
    title: title || 'Broker',
    tel: aboutPhoneE164(b.phoneDirect),
    email: b.email?.trim() || null,
    bookHref: aboutBookHref(slug),
    license,
    phoneDisplay,
  }
}

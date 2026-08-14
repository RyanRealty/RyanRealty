/**
 * About first-viewport faces. Canonical transparent PNGs only
 * (`/images/brokers/*.png`). JPG fallbacks carry a white box and are refused.
 * Remote photo_url values are refused — those are not the locked cutouts.
 * Call / text hrefs are derived from the live broker phone, never invented.
 */

import { BROKERS, type BrokerKey } from '@/lib/brand/contact'
import { teamPath } from '@/lib/slug'

export type AboutFace = {
  href: string
  src: string
  name: string
  title: string
  tel: string | null
}

const CANONICAL_HEADSHOT = /^\/images\/brokers\/[a-z0-9-]+\.png$/

const BROKER_BY_SLUG = new Map<string, (typeof BROKERS)[BrokerKey]>(
  (Object.keys(BROKERS) as BrokerKey[]).map((key) => [BROKERS[key].slug, BROKERS[key]]),
)

/** E.164 for tel: / sms:. Null when the number cannot parse. */
export function aboutPhoneE164(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return digits.length === 10 ? `+1${digits}` : null
}

function displayName(slug: string, fullName: string): string {
  return BROKER_BY_SLUG.get(slug)?.nameShort ?? fullName
}

export function aboutFaceFromBroker(b: {
  slug: string
  fullName: string | null | undefined
  title?: string | null
  headshotPng?: string | null
  phoneDirect?: string | null
}): AboutFace | null {
  const name = b.fullName?.trim()
  const slug = b.slug?.trim()
  const src = b.headshotPng?.trim()
  if (!name || !slug || !src) return null
  if (!CANONICAL_HEADSHOT.test(src)) return null
  const title = b.title?.trim()
  return {
    href: teamPath(slug),
    src,
    name: displayName(slug, name),
    title: title || 'Broker',
    tel: aboutPhoneE164(b.phoneDirect),
  }
}

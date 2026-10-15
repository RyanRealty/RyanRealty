/**
 * reachability: entry-point — which licensed broker Sarah routes to.
 *
 * Assigned agent on the CRM person record wins. No person, or no assignment,
 * is Matt. Call/text/message links, live-session alerts, and "{name} has joined"
 * takeover copy all read this shape. Do not use visit ?agent= attribution here.
 */
import { BROKERS, type BrokerKey } from '@/lib/brand/contact'
import { normalizeAgentSlug, type BrokerSlug } from '@/lib/agent-attribution'

export const SARAH_DEFAULT_BROKER_SLUG: BrokerSlug = 'matt'

export const SARAH_BROKER_HEADSHOT: Record<BrokerSlug, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}

export type SarahDeskBroker = {
  slug: BrokerSlug
  firstName: string
  fullName: string
  photoSrc: string
  photoAlt: string
  phoneDisplay: string
  phoneTel: string
  email: string
  contactHref: string
}

function firstNameOf(nameShort: string): string {
  const first = nameShort.trim().split(/\s+/)[0]
  return first || nameShort
}

function phoneTelOf(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  return `+${digits}`
}

export function deskBrokerSlug(assigned: string | null | undefined): BrokerSlug {
  return normalizeAgentSlug(assigned) ?? SARAH_DEFAULT_BROKER_SLUG
}

export function deskBrokerFromAssigned(assigned: string | null | undefined): SarahDeskBroker {
  const slug = deskBrokerSlug(assigned)
  const key = slug as BrokerKey
  const row = BROKERS[key]
  return {
    slug,
    firstName: firstNameOf(row.nameShort),
    fullName: row.nameShort,
    photoSrc: SARAH_BROKER_HEADSHOT[slug],
    photoAlt: row.nameShort,
    phoneDisplay: row.phone,
    phoneTel: phoneTelOf(row.phone),
    email: row.email,
    contactHref: `/contact?agent=${slug}`,
  }
}

export function brokerJoinedLine(broker: SarahDeskBroker): string {
  return `${broker.firstName} has joined`
}

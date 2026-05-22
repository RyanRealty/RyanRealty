/**
 * Lead types — every lead capture form on the site produces one of these.
 * All leads route to Follow Up Boss (FUB) with per-broker attribution
 * (via the `rr_agent_attribution` cookie).
 */

import type { BrokerSlug } from './broker'

export type LeadSource =
  | 'listing-detail-inquiry'
  | 'seller-home-value'
  | 'buyer-listing-alerts'
  | 'expired-listing'
  | 'schedule-tour'
  | 'general-contact'

export type LeadInput = {
  source: LeadSource
  firstName: string
  lastName: string | null
  email: string
  phone: string | null
  message: string | null
  agentAttribution: BrokerSlug | null   // from the rr_agent_attribution cookie
  pageContext: {
    url: string
    listingKey?: string
    citySlug?: string
    communitySlug?: string
  }
}

export type BuyerLead = LeadInput & {
  source: 'buyer-listing-alerts' | 'listing-detail-inquiry' | 'schedule-tour'
  searchCriteria?: {
    minPrice?: number
    maxPrice?: number
    cities?: string[]
    minBeds?: number
  }
}

export type SellerLead = LeadInput & {
  source: 'seller-home-value'
  propertyAddress: string
  bedroomsTotal?: number
  bathroomsTotal?: number
  livingAreaSqFt?: number
  timeframe?: 'asap' | '1-3-months' | '3-6-months' | '6-12-months' | 'just-curious'
}

export type ExpiredLead = LeadInput & {
  source: 'expired-listing'
  listingKey: string
  reasonForCalling?: string
}

export type LeadResult = {
  success: boolean
  fubPersonId?: string
  brokerAssigned?: BrokerSlug
  error?: string
}

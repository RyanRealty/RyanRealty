/**
 * JSON-LD structured data generators for SEO. Step 20.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export type ListingForSchema = {
  listing_key: string
  list_price?: number | null
  beds_total?: number | null
  baths_full?: number | null
  living_area?: number | null
  subdivision_name?: string | null
  standard_status?: string | null
}

export type PropertyAddress = {
  street_number?: string | null
  street_name?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  unparsed_address?: string | null
}

export function generateListingSchema(
  listing: ListingForSchema,
  address: PropertyAddress,
  photoUrl?: string | null
): Record<string, unknown> {
  const street = [address.street_number, address.street_name].filter(Boolean).join(' ')
  return {
    '@context': 'https://schema.org',
    '@type': listing.living_area != null && listing.living_area > 0 ? 'SingleFamilyResidence' : 'Residence',
    name: address.unparsed_address ?? street ?? 'Property',
    url: `${SITE_URL}/listing/${encodeURIComponent(listing.listing_key)}`,
    ...(listing.list_price != null && listing.list_price > 0 && {
      offers: { '@type': 'Offer', price: listing.list_price, priceCurrency: 'USD' },
    }),
    numberOfRooms: listing.beds_total ?? undefined,
    numberOfBathroomsTotal: listing.baths_full ?? undefined,
    floorSize: listing.living_area != null ? { '@type': 'QuantitativeValue', value: listing.living_area, unitCode: 'FTK' } : undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: street || undefined,
      addressLocality: address.city ?? undefined,
      addressRegion: address.state ?? undefined,
      postalCode: address.postal_code ?? undefined,
    },
    ...(photoUrl && { image: photoUrl }),
  }
}

export function generateCommunitySchema(community: { name: string; slug: string; description?: string | null }): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: community.name,
    url: `${SITE_URL}/communities/${encodeURIComponent(community.slug)}`,
    description: community.description ?? undefined,
  }
}

export function generateCitySchema(city: { name: string; slug: string }): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'City',
    name: city.name,
    url: `${SITE_URL}/cities/${encodeURIComponent(city.slug)}`,
  }
}

export function generateBrokerSchema(broker: {
  display_name: string
  slug: string
  title?: string | null
  email?: string | null
  phone?: string | null
  photo_url?: string | null
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: broker.display_name,
    jobTitle: broker.title ?? undefined,
    url: `${SITE_URL}/agents/${encodeURIComponent(broker.slug)}`,
    email: broker.email ?? undefined,
    telephone: broker.phone ?? undefined,
    image: broker.photo_url ?? undefined,
  }
}

export function generateBlogSchema(post: {
  title: string
  slug: string
  excerpt?: string | null
  published_at?: string | null
  author_name?: string | null
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    url: `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`,
    description: post.excerpt ?? undefined,
    datePublished: post.published_at ?? undefined,
    author: post.author_name ? { '@type': 'Person', name: post.author_name } : undefined,
  }
}

export function generateBrokerageSchema(brokerage: { name: string; url?: string; phone?: string | null }): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': ['RealEstateAgent', 'LocalBusiness'],
    name: brokerage.name,
    url: brokerage.url ?? SITE_URL,
    telephone: brokerage.phone ?? undefined,
  }
}

export type BreadcrumbItem = { name: string; url: string }

export function generateBreadcrumbSchema(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export type FAQItem = { question: string; answer: string }

export function generateFAQSchema(faqs: FAQItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }
}

export function generateEventSchema(openHouse: {
  event_date: string
  start_time?: string | null
  end_time?: string | null
  address?: string | null
  listing_url?: string
}): Record<string, unknown> {
  const start = `${openHouse.event_date}T${(openHouse.start_time ?? '09:00').toString().slice(0, 5)}:00`
  const end = `${openHouse.event_date}T${(openHouse.end_time ?? '12:00').toString().slice(0, 5)}:00`
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: 'Open House',
    startDate: start,
    endDate: end,
    location: openHouse.address ? { '@type': 'Place', address: openHouse.address } : undefined,
    url: openHouse.listing_url ?? undefined,
  }
}

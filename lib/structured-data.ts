/**
 * JSON-LD structured data generators for SEO. Step 20.
 */
import { listingDetailPath, teamPath } from '@/lib/slug'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export type ListingForSchema = {
  listing_key: string
  list_number?: string | null
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
    url: `${SITE_URL}${listingDetailPath(
      listing.list_number ?? listing.listing_key,
      {
        streetNumber: address.street_number ?? null,
        streetName: address.street_name ?? null,
        city: address.city ?? null,
        state: address.state ?? null,
        postalCode: address.postal_code ?? null,
      },
      {
        city: address.city ?? null,
        subdivision: listing.subdivision_name ?? null,
      },
      {
        mlsNumber: listing.list_number ?? null,
      }
    )}`,
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
    url: `${SITE_URL}${teamPath(broker.slug)}`,
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
  updated_at?: string | null
  image?: string | null
  author_name?: string | null
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    url: `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`,
    description: post.excerpt ?? undefined,
    image: post.image ?? undefined,
    datePublished: post.published_at ?? undefined,
    // dateModified drives the AI/Google recency preference; fall back to the
    // publish date so the field is always present (no freshness cliff on edits).
    dateModified: post.updated_at ?? post.published_at ?? undefined,
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
  const normalizedItems =
    items.length > 0 && items[0]?.name === 'Home'
      ? items
      : [{ name: 'Home', url: SITE_URL }, ...items]

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: normalizedItems.map((item, i) => ({
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


/**
 * Site-wide identity JSON-LD, rendered once in the root layout.
 *
 * Emits the canonical Organization entity (RealEstateAgent + LocalBusiness)
 * that every other page's JSON-LD references by @id, plus the WebSite block
 * with the sitelinks SearchAction.
 *
 * The Organization is the anchor AI engines and Google use to attribute every
 * citation. It carries verified NAP, the locked social profiles (sameAs), the
 * brokerage founding date, and the three licensed brokers (founder + employees)
 * pulled live from the cached brokers DAL so the markup never diverges from the
 * roster. Broker license numbers come from public.brokers (OREA-authoritative).
 */
import { getBrokers } from '@/lib/data/brokers/getBrokers'
import type { Broker } from '@/lib/data/types/broker'
import { teamPath } from '@/lib/slug'
import { BRAND, CONTACT, SOCIAL_PROFILES } from '@/lib/brand/contact'

/** "541.213.6706" -> "+1-541-213-6706" (schema.org E.164-ish telephone). */
function toTel(dotted: string | null | undefined): string | undefined {
  if (!dotted) return undefined
  const digits = dotted.replace(/\D/g, '')
  if (digits.length !== 10) return undefined
  return `+1-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

function prune<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as Record<string, unknown>
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) continue
    out[k] = v
  }
  return out as T
}

function brokerAgent(b: Broker, baseUrl: string): Record<string, unknown> {
  const url = `${baseUrl}${teamPath(b.slug)}`
  return prune({
    '@type': 'RealEstateAgent',
    '@id': `${url}#person`,
    name: b.fullName,
    jobTitle: b.title,
    url,
    image: b.headshotPng ? `${baseUrl}${b.headshotPng}` : undefined,
    telephone: toTel(b.phoneDirect),
    email: b.email ?? undefined,
    worksFor: { '@id': `${baseUrl}#organization` },
    identifier: b.licenseNumber
      ? { '@type': 'PropertyValue', propertyID: 'Oregon Real Estate License', value: b.licenseNumber }
      : undefined,
  })
}

export default async function JsonLd() {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? BRAND.url).replace(/\/$/, '')
  const brokers = await getBrokers().catch(() => [] as Broker[])
  const principal = brokers.find((b) => b.isPrincipal) ?? null
  const team = brokers.filter((b) => !b.isPrincipal)

  const organization = prune({
    '@context': 'https://schema.org',
    '@type': ['RealEstateAgent', 'LocalBusiness'],
    '@id': `${baseUrl}#organization`,
    name: BRAND.name,
    legalName: BRAND.legalName,
    description:
      'Independent real estate brokerage serving Bend, Redmond, Sisters, Sunriver, and Central Oregon. Browse homes for sale, search by city and neighborhood, and see live market data.',
    url: baseUrl,
    telephone: CONTACT.phoneDirectTel,
    email: CONTACT.email.primary,
    foundingDate: BRAND.founded,
    areaServed: {
      '@type': 'GeoCircle',
      geoMidpoint: { '@type': 'GeoCoordinates', latitude: 44.0582, longitude: -121.3153 },
      geoRadius: '80000',
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: BRAND.address.city,
      addressRegion: BRAND.address.region,
      addressCountry: 'US',
    },
    sameAs: SOCIAL_PROFILES,
    founder: principal ? brokerAgent(principal, baseUrl) : undefined,
    employee: team.length > 0 ? team.map((b) => brokerAgent(b, baseUrl)) : undefined,
  })

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${baseUrl}#website`,
    name: BRAND.name,
    url: baseUrl,
    description: 'Search Central Oregon homes for sale. Browse listings, maps, and live market data.',
    publisher: { '@id': `${baseUrl}#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${baseUrl}/homes-for-sale?keywords={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  )
}

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
import { siteOrigin } from '@/lib/site-origin'
import type { Broker } from '@/lib/data/types/broker'
import { teamPath } from '@/lib/slug'
import { BRAND, CONTACT, ENTITY_SAME_AS } from '@/lib/brand/contact'
import { brokerAlternateName, brokerPersonId, brokerSameAs } from '@/lib/site/broker-entity'

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
  const sameAs = brokerSameAs(b.slug)
  return prune({
    '@type': 'RealEstateAgent',
    // AEO-6: the same id /team/[slug] gives its page node (brokerPersonId).
    '@id': brokerPersonId(baseUrl, b.slug),
    name: b.fullName,
    // 2026-10-08: the other spelling engines see (OREA "Matthew Ryan"; the
    // site prints "Rebecca Peterson" for "Rebecca Ryser Peterson").
    alternateName: brokerAlternateName(b.slug),
    jobTitle: b.title,
    url,
    image: b.headshotPng ? `${baseUrl}${b.headshotPng}` : undefined,
    telephone: toTel(b.phoneDirect),
    email: b.email ?? undefined,
    worksFor: { '@id': `${baseUrl}#organization` },
    identifier: b.licenseNumber
      ? { '@type': 'PropertyValue', propertyID: 'Oregon Real Estate License', value: b.licenseNumber }
      : undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  })
}

export default async function JsonLd() {
  const baseUrl = siteOrigin()
  const brokers = await getBrokers().catch(() => [] as Broker[])
  const principal = brokers.find((b) => b.isPrincipal) ?? null
  const team = brokers.filter((b) => !b.isPrincipal)

  const organization = prune({
    '@context': 'https://schema.org',
    '@type': ['RealEstateAgent', 'LocalBusiness'],
    '@id': `${baseUrl}#organization`,
    name: BRAND.name,
    alternateName: [...BRAND.alternateNames],
    legalName: BRAND.legalName,
    description:
      'Ryan Realty covers Bend, Redmond, Sisters, Sunriver, and Central Oregon. Browse homes for sale, search by city and neighborhood, and see live market data.',
    url: baseUrl,
    telephone: CONTACT.phoneDirectTel,
    email: CONTACT.email.primary,
    // Founded 2014 (Matt 2026-09-24, restated 2026-10-08: "2014 everywhere");
    // June 2023 is the Bend office (BRAND.bendOfficeOpened), never this field.
    foundingDate: BRAND.llcSince,
    // OREA License Lookup (2026-10-08): 201253677 is license type "Registered
    // Business Name", ACTIVE. Stated as the Agency states it.
    identifier: {
      '@type': 'PropertyValue',
      propertyID: 'Oregon Real Estate Agency license (Registered Business Name)',
      value: BRAND.firmLicense,
    },
    hasCredential: {
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'Oregon Real Estate Agency registered business name license',
      identifier: BRAND.firmLicense,
      recognizedBy: { '@type': 'GovernmentOrganization', name: 'Oregon Real Estate Agency', url: 'https://www.oregon.gov/rea' },
    },
    areaServed: {
      '@type': 'GeoCircle',
      geoMidpoint: { '@type': 'GeoCoordinates', latitude: 44.0582, longitude: -121.3153 },
      geoRadius: '80000',
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: BRAND.address.street,
      addressLocality: BRAND.address.city,
      addressRegion: BRAND.address.region,
      postalCode: BRAND.address.postalCode,
      addressCountry: 'US',
    },
    sameAs: ENTITY_SAME_AS,
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

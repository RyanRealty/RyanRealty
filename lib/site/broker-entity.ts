/**
 * One entity per broker across the site's JSON-LD (AEO-6, visibility audit
 * 2026-09-22).
 *
 * components/JsonLd.tsx emits every broker as the Organization's founder or
 * employee under `${site}/team/<slug>#person`. /team/<slug> emitted its own
 * RealEstateAgent node with NO @id and no sameAs, so an engine reading the
 * broker's own page saw a second, unlinked person. Both now take the id and
 * the verified profiles from here, so the two nodes merge into one entity.
 *
 * 2026-10-08 (SEO & AEO Desk /about brief): the broker page's node is a
 * Person + RealEstateAgent with an absolute image, an E.164 phone, the OREA
 * license as identifier and credential, and `worksFor` as the organization's
 * @id ONLY. It no longer restates the organization's name ("Ryan Realty LLC"
 * conflicted with the org node's "Ryan Realty") and carries no
 * aggregateRating: self-serving review markup on a LocalBusiness is not
 * eligible, and a broker page is not where the firm's rating belongs.
 * No "licensed since" or dateCreated: the original issue date is not on the
 * Agency's lookup.
 */
import { teamPath } from '@/lib/slug'
import { BROKER_ENTITY_EXTRAS, BROKER_SAME_AS } from '@/lib/brand/contact'

export function brokerPersonId(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/$/, '')}${teamPath(slug)}#person`
}

/** Third-party profiles verified to be this broker (lib/brand/contact.ts BROKER_SAME_AS). */
export function brokerSameAs(slug: string): string[] {
  return [...(BROKER_SAME_AS[slug] ?? [])]
}

/** The other spelling of this broker's name engines see (OREA, profiles), if any. */
export function brokerAlternateName(slug: string): string | undefined {
  return BROKER_ENTITY_EXTRAS[slug]?.alternateName
}

/** "541.703.3095" -> "+15417033095". Undefined when it is not ten digits. */
export function brokerPhoneE164(phone: string | null | undefined): string | undefined {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return undefined
}

function absoluteUrl(baseUrl: string, src: string | null | undefined): string | undefined {
  const value = String(src ?? '').trim()
  if (!value) return undefined
  if (/^https?:\/\//i.test(value)) return value
  return `${baseUrl.replace(/\/$/, '')}${value.startsWith('/') ? '' : '/'}${value}`
}

/**
 * The Person + RealEstateAgent node for a broker's own /team/<slug> page.
 * Keys with no value are left out rather than sent empty.
 */
export function brokerPersonNode(input: {
  baseUrl: string
  slug: string
  name: string
  jobTitle: string
  url: string
  image?: string | null
  phone?: string | null
  email?: string | null
  license?: string | null
  isPrincipal?: boolean
}): Record<string, unknown> {
  const base = input.baseUrl.replace(/\/$/, '')
  const extras = BROKER_ENTITY_EXTRAS[input.slug] ?? {}
  const license = String(input.license ?? '').trim()
  const sameAs = brokerSameAs(input.slug)
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['Person', 'RealEstateAgent'],
    '@id': brokerPersonId(base, input.slug),
    name: input.name,
    alternateName: extras.alternateName,
    jobTitle: input.jobTitle,
    url: input.url,
    image: absoluteUrl(base, input.image),
    telephone: brokerPhoneE164(input.phone),
    email: input.email ?? undefined,
    worksFor: { '@id': `${base}#organization` },
    identifier: license
      ? { '@type': 'PropertyValue', propertyID: 'Oregon Real Estate License', value: license }
      : undefined,
    hasCredential: license
      ? {
          '@type': 'EducationalOccupationalCredential',
          credentialCategory: input.isPrincipal ? 'Oregon principal broker license' : 'Oregon broker license',
          identifier: license,
          recognizedBy: {
            '@type': 'GovernmentOrganization',
            name: 'Oregon Real Estate Agency',
            url: 'https://www.oregon.gov/rea',
          },
        }
      : undefined,
    knowsAbout: extras.knowsAbout && extras.knowsAbout.length > 0 ? [...extras.knowsAbout] : undefined,
    areaServed:
      extras.areaServed && extras.areaServed.length > 0
        ? extras.areaServed.map((area) => ({ '@type': area.type, name: area.name }))
        : { '@type': 'Place', name: 'Central Oregon' },
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  }
  for (const key of Object.keys(node)) if (node[key] === undefined) delete node[key]
  return node
}

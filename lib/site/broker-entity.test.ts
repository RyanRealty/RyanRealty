import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BRAND, ENTITY_SAME_AS, SOCIAL_PROFILES } from '@/lib/brand/contact'
import { brokerPersonId, brokerSameAs } from './broker-entity'

describe('broker entity ids and sameAs (AEO-6 / COMP-8)', () => {
  it('builds the same #person id JsonLd gives the founder/employee node', () => {
    expect(brokerPersonId('https://ryan-realty.com/', 'matthew-ryan')).toBe(
      'https://ryan-realty.com/team/matthew-ryan#person',
    )
  })

  it("gives Matt his verified Zillow and LinkedIn profiles and invents none for anyone else", () => {
    expect(brokerSameAs('matthew-ryan')).toEqual([
      'https://www.zillow.com/profile/Ryan%20Realty%20Bend',
      'https://www.linkedin.com/in/mattmryan',
    ])
    expect(brokerSameAs('paul-stevenson')).toEqual([])
    expect(brokerSameAs('rebecca-peterson')).toEqual([])
  })

  it('keeps the social sameAs order and appends the directory profiles', () => {
    expect(ENTITY_SAME_AS.slice(0, SOCIAL_PROFILES.length)).toEqual(SOCIAL_PROFILES)
    expect(ENTITY_SAME_AS).toContain('https://www.zillow.com/profile/Ryan%20Realty%20Bend')
    expect(ENTITY_SAME_AS).toContain('https://www.yelp.com/biz/ryan-realty-bend')
    expect(new Set(ENTITY_SAME_AS).size).toBe(ENTITY_SAME_AS.length)
  })

  it("keeps the entity name exactly 'Ryan Realty' and lists other spellings as alternateName only", () => {
    expect(BRAND.name).toBe('Ryan Realty')
    expect(BRAND.alternateNames).not.toContain(BRAND.name)
    expect(BRAND.alternateNames).toContain('Ryan Realty Bend')
  })

  it('wires the Organization and the /team/[slug] page node to these helpers', () => {
    const jsonLd = readFileSync('components/JsonLd.tsx', 'utf8')
    expect(jsonLd).toMatch(/sameAs: ENTITY_SAME_AS/)
    expect(jsonLd).toMatch(/alternateName: \[\.\.\.BRAND\.alternateNames\]/)
    expect(jsonLd).toMatch(/'@id': brokerPersonId\(baseUrl, b\.slug\)/)
    const teamPage = readFileSync('app/team/[slug]/page.tsx', 'utf8')
    expect(teamPage).toMatch(/'@id': brokerPersonId\(siteUrl, canonicalPathSlug\)/)
    expect(teamPage).toMatch(/'@id': `\$\{siteUrl\}#organization`/)
  })
})

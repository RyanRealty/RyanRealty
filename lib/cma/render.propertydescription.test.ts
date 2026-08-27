import { describe, expect, it } from 'vitest'
import { propertyDescription } from '@/lib/cma/render'
import type { CmaSubject } from '@/lib/cma/types'

/**
 * The disclosure's property description is an ORS 696 / OAR 863-015-0190
 * statement. On land it used to print "— bedrooms · — bathrooms · — sqft",
 * which describes nothing about a vacant lot. Omitting an absent fact is the
 * accurate form, not a cosmetic one.
 */
const subject = (over: Partial<CmaSubject> = {}): CmaSubject =>
  ({
    streetAddress: '1 Elkwood',
    city: 'Chiloquin',
    postalCode: '97624',
    beds: null,
    baths: null,
    sqft: null,
    lotAcres: 0.69,
    yearBuilt: null,
    ...over,
  }) as unknown as CmaSubject

describe('disclosure property description', () => {
  it('omits bedrooms, bathrooms and living area on land', () => {
    const line = propertyDescription(subject())
    expect(line).not.toMatch(/bedrooms/)
    expect(line).not.toMatch(/bathrooms/)
    expect(line).not.toMatch(/sqft/)
    expect(line).not.toMatch(/—/)
    expect(line).toMatch(/0\.69 acres/)
    expect(line).toMatch(/1 Elkwood, Chiloquin, Oregon 97624/)
  })

  it('still states every fact for an improved home', () => {
    const line = propertyDescription(
      subject({ beds: 3, baths: 2, sqft: 2000, yearBuilt: 2001, lotAcres: 0.2 }),
    )
    expect(line).toMatch(/3 bedrooms/)
    expect(line).toMatch(/2 bathrooms/)
    expect(line).toMatch(/2,000 sqft/)
    expect(line).toMatch(/0\.20 acres/)
    expect(line).toMatch(/built 2001/)
  })

  it('keeps a half bath rather than rounding it away', () => {
    expect(propertyDescription(subject({ baths: 2.5 }))).toMatch(/2\.5 bathrooms/)
  })

  it('degrades to the address alone when the record carries nothing else', () => {
    const line = propertyDescription(subject({ lotAcres: null }))
    expect(line).toBe('1 Elkwood, Chiloquin, Oregon 97624.')
  })
})

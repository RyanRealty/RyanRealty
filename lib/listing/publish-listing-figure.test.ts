import { describe, expect, it } from 'vitest'
import {
  isZeroDollarText,
  listingIsFractionalInterest,
  listingPriceIsFractionalShare,
  listingPriceIsLeaseRate,
  publishMoneyText,
  publishPricePerSqft,
  publishSaleAskAmount,
  publishWholePropertyAmount,
} from './publish-listing-figure'

describe('listingPriceIsLeaseRate', () => {
  it('reads MLS PropertyType G as a lease rate', () => {
    // 4,310 rows carry PropertyTypeLabel "Commercial Lease"; 25 carry none;
    // no 'G' row is ever labelled anything else (listings, 2026-08-19).
    expect(listingPriceIsLeaseRate('G')).toBe(true)
    expect(listingPriceIsLeaseRate('g')).toBe(true)
    expect(listingPriceIsLeaseRate(' G ')).toBe(true)
  })

  it('leaves every sale property type alone', () => {
    for (const code of ['A', 'B', 'C', 'D', 'E', 'F', 'H']) {
      expect(listingPriceIsLeaseRate(code)).toBe(false)
    }
    expect(listingPriceIsLeaseRate(null)).toBe(false)
    expect(listingPriceIsLeaseRate('')).toBe(false)
  })
})

describe('publishMoneyText', () => {
  it('never publishes $0 for an amount that is not zero', () => {
    // 735 Purcell (MLS 220174840) published "Listed $0 / Price change $0 /
    // Back on market $0" from lease rates of $2.50-$2.75 thousand-rounded.
    expect(publishMoneyText(2.5)).toBeNull()
    expect(publishMoneyText(2.75)).toBeNull()
    expect(publishMoneyText(499)).toBeNull()
    expect(publishMoneyText(0.4, 'exact')).toBeNull()
    expect(publishMoneyText(0.4, 'compact')).toBeNull()
  })

  it('publishes the registers it can represent', () => {
    expect(publishMoneyText(895_000)).toBe('$895,000')
    expect(publishMoneyText(500)).toBe('$1,000')
    expect(publishMoneyText(771, 'exact')).toBe('$771')
    expect(publishMoneyText(2.5, 'exact')).toBe('$3')
    expect(publishMoneyText(260_000, 'compact')).toBe('$260k')
    expect(publishMoneyText(1_495_000, 'compact')).toBe('$1.5M')
  })

  it('withholds a missing or non-positive amount', () => {
    expect(publishMoneyText(null)).toBeNull()
    expect(publishMoneyText(undefined)).toBeNull()
    expect(publishMoneyText(0)).toBeNull()
    expect(publishMoneyText(-5)).toBeNull()
    expect(publishMoneyText(Number.NaN)).toBeNull()
  })
})

describe('isZeroDollarText', () => {
  it('catches every register that spells zero dollars', () => {
    expect(isZeroDollarText('$0')).toBe(true)
    expect(isZeroDollarText('$0k')).toBe(true)
    expect(isZeroDollarText('$0.0M')).toBe(true)
    expect(isZeroDollarText('$1,000')).toBe(false)
    expect(isZeroDollarText('$0.5M')).toBe(false)
  })
})

describe('publishPricePerSqft', () => {
  it('withholds a lease rate dressed as a sale figure', () => {
    expect(publishPricePerSqft({ propertyType: 'G', pricePerSqft: 3.26 })).toBeNull()
    expect(publishPricePerSqft({ propertyType: 'G', pricePerSqft: 500 })).toBeNull()
  })

  it('withholds a figure that would publish as $0', () => {
    expect(publishPricePerSqft({ propertyType: 'A', pricePerSqft: 0.36 })).toBeNull()
    expect(publishPricePerSqft({ propertyType: 'A', pricePerSqft: 0 })).toBeNull()
  })

  it('publishes a verified figure at whole-dollar precision, however low', () => {
    expect(publishPricePerSqft({ propertyType: 'A', pricePerSqft: 656.47 })).toBe(656)
    expect(publishPricePerSqft({ propertyType: 'B', pricePerSqft: 10.84 })).toBe(11)
    expect(publishPricePerSqft({ propertyType: 'F', pricePerSqft: 7.45 })).toBe(7)
  })
})

describe('publishSaleAskAmount', () => {
  it('withholds the ask on a lease listing', () => {
    // 735 Purcell published an H1 of "$3" from ListPrice 2.5.
    expect(publishSaleAskAmount({ price: 2.5, propertyType: 'G' })).toBeNull()
    expect(publishSaleAskAmount({ price: 4200, propertyType: 'G' })).toBeNull()
  })

  it('publishes the exact whole-dollar ask on a sale listing', () => {
    expect(publishSaleAskAmount({ price: 1_695_000, propertyType: 'A' })).toBe(1_695_000)
    expect(publishSaleAskAmount({ price: 6_500_000, propertyType: 'D' })).toBe(6_500_000)
    expect(publishSaleAskAmount({ price: 424_990, propertyType: 'A' })).toBe(424_990)
  })

  it('withholds a missing or non-positive price', () => {
    expect(publishSaleAskAmount({ price: null, propertyType: 'A' })).toBeNull()
    expect(publishSaleAskAmount({ price: 0, propertyType: 'A' })).toBeNull()
  })
})

describe('listingPriceIsFractionalShare', () => {
  it('is true for the two sub types whose price buys a share', () => {
    expect(listingPriceIsFractionalShare('Tenancy in Common')).toBe(true)
    expect(listingPriceIsFractionalShare('Timeshare')).toBe(true)
    expect(listingPriceIsFractionalShare(' Tenancy in Common ')).toBe(true)
  })

  it('is false for whole-dwelling sub types, including a co-op share', () => {
    // A Stock Cooperative share carries the exclusive right to one whole unit.
    for (const t of ['Single Family Residence', 'Condominium', 'Stock Cooperative', 'In Park']) {
      expect(listingPriceIsFractionalShare(t)).toBe(false)
    }
    expect(listingPriceIsFractionalShare(null)).toBe(false)
    expect(listingPriceIsFractionalShare('')).toBe(false)
  })
})

/** A listing nowhere near a registered fractional-interest property. */
const ELSEWHERE = { subdivisionName: 'Awbrey Butte', city: 'Bend', listNumber: '220000000' }

describe('listingIsFractionalInterest', () => {
  it('catches the sub-type rows the feed labels', () => {
    expect(
      listingIsFractionalInterest({ ...ELSEWHERE, propertySubType: 'Tenancy in Common' }),
    ).toBe(true)
    expect(listingIsFractionalInterest({ ...ELSEWHERE, propertySubType: 'Timeshare' })).toBe(true)
  })

  it('catches the eight Lake Creek Lodge quarter shares the feed files as Condominium', () => {
    // The exact live rows, 2026-08-19. Each says 25% / 1/4 / one-quarter in its
    // own remarks; none carries a fractional sub type.
    for (const listNumber of [
      '220218114',
      '220218115',
      '220222476',
      '220222478',
      '220215583',
      '220203447',
      '220218395',
      '220170948',
    ]) {
      expect(
        listingIsFractionalInterest({
          propertySubType: 'Condominium',
          subdivisionName: 'Lake Creek Lodge',
          city: 'Camp Sherman',
          listNumber,
        }),
      ).toBe(true)
    }
  })

  it('catches Cabin 10 U2, which discloses no share of its own', () => {
    // 220222477 is unit "10, U2" — same cabin, same $159,900, same 866 sq ft as
    // 220222476 ("10, U1") and 220222478 ("10, U3"), both of which disclose a
    // quarter share. A remark rule would publish this one as a whole home and
    // withhold its two identical siblings. The property is the key, so it does
    // not.
    expect(
      listingIsFractionalInterest({
        propertySubType: 'Condominium',
        subdivisionName: 'Lake Creek Lodge',
        city: 'Camp Sherman',
        listNumber: '220222477',
      }),
    ).toBe(true)
  })

  it('catches the one reviewed listing at a property that also sells wholes', () => {
    expect(
      listingIsFractionalInterest({
        propertySubType: 'Multi Family',
        subdivisionName: 'Inn Of The 7th',
        city: 'Bend',
        listNumber: '220216423',
      }),
    ).toBe(true)
  })

  it('leaves the 27 whole condos at that same property alone', () => {
    // Inn Of The 7th is deliberately NOT a property entry: 27 Active
    // Condominium rows there, $150,000–$352,900, disclose no share.
    expect(
      listingIsFractionalInterest({
        propertySubType: 'Condominium',
        subdivisionName: 'Inn Of The 7th',
        city: 'Bend',
        listNumber: '220999111',
      }),
    ).toBe(false)
  })

  it('exempts the resort itself, which is sold whole', () => {
    // 220224690, PropertyType F at $10,000,000: "13 charming cabins, an iconic
    // lodge with an active restaurant". Its ListPrice IS the whole property.
    expect(
      listingIsFractionalInterest({
        propertySubType: null,
        subdivisionName: 'Lake Creek Lodge',
        city: 'Camp Sherman',
        listNumber: '220224690',
      }),
    ).toBe(false)
  })

  it('exempts the two whole cabins the property also sells', () => {
    // Counter-query, live `listings`, SubdivisionName 'Lake Creek Lodge',
    // 2026-08-19: 2 rows claim a full rather than partial ownership in their
    // own remarks. Both are Canceled, both filed under sub type "Condominium"
    // with a bare cabin number and no U1–U4 share index, and both render at
    // /listing/<key>. Before they were named, the property rule printed
    // "Fractional interest" beside a whole-cabin ask.
    for (const listNumber of ['201805357', '220194788']) {
      expect(
        listingIsFractionalInterest({
          propertySubType: 'Condominium',
          subdivisionName: 'Lake Creek Lodge',
          city: 'Camp Sherman',
          listNumber,
        }),
      ).toBe(false)
    }
    expect(
      publishWholePropertyAmount({
        propertySubType: 'Condominium',
        subdivisionName: 'Lake Creek Lodge',
        city: 'Camp Sherman',
        listNumber: '201805357',
        price: 849_500,
        propertyType: 'A',
      }),
    ).toBe(849_500)
  })

  it('matches the property on case and spacing, not on exact feed casing', () => {
    expect(
      listingIsFractionalInterest({
        propertySubType: 'Condominium',
        subdivisionName: '  lake   creek lodge ',
        city: 'CAMP SHERMAN',
        listNumber: '220218114',
      }),
    ).toBe(true)
  })

  it('is false for an ordinary home, and for a partial subject', () => {
    expect(
      listingIsFractionalInterest({ ...ELSEWHERE, propertySubType: 'Single Family Residence' }),
    ).toBe(false)
    // A cabin number without its town does not match a registry key.
    expect(
      listingIsFractionalInterest({
        propertySubType: 'Condominium',
        subdivisionName: 'Lake Creek Lodge',
        city: null,
        listNumber: null,
      }),
    ).toBe(false)
  })
})

describe('publishWholePropertyAmount', () => {
  const share = (price: number, propertySubType: string | null) =>
    publishWholePropertyAmount({ ...ELSEWHERE, price, propertyType: 'A', propertySubType })

  it('withholds every fractional interest, at any price', () => {
    // MLS 220190868 published a 1571464.0% cap rate and JSON-LD offers.price 1.
    expect(share(1, 'Tenancy in Common')).toBeNull()
    expect(share(250, 'Tenancy in Common')).toBeNull()
    expect(share(500, 'Tenancy in Common')).toBeNull()
    // 220224253 is a 1/3 share; 220221076 is a quarter ownership.
    expect(share(295_000, 'Tenancy in Common')).toBeNull()
    expect(share(215_000, 'Timeshare')).toBeNull()
  })

  it('withholds the Lake Creek Lodge rows the sub type alone would publish', () => {
    // The founding case. Sub type "Condominium" at $159,900 published a 3.5%
    // cap rate, "Cash needed $31,980", "$185 /sqft", and a
    // SingleFamilyResidence offer at that price on 220222478's page.
    expect(
      publishWholePropertyAmount({
        price: 159_900,
        propertyType: 'A',
        propertySubType: 'Condominium',
        subdivisionName: 'Lake Creek Lodge',
        city: 'Camp Sherman',
        listNumber: '220222478',
      }),
    ).toBeNull()
    // The same shape published elsewhere is untouched.
    expect(share(159_900, 'Condominium')).toBe(159_900)
  })

  it('withholds a lease rate', () => {
    expect(
      publishWholePropertyAmount({
        ...ELSEWHERE,
        price: 2.5,
        propertyType: 'G',
        propertySubType: null,
      }),
    ).toBeNull()
  })

  it('publishes the whole-dwelling rows, including ones cheaper than a share', () => {
    expect(share(1_695_000, 'Condominium')).toBe(1_695_000)
    expect(share(8_500, 'In Park')).toBe(8_500)
    expect(share(475_000, null)).toBe(475_000)
  })

  it('withholds a missing or non-positive price', () => {
    expect(share(0, 'Single Family Residence')).toBeNull()
    expect(
      publishWholePropertyAmount({
        ...ELSEWHERE,
        price: null,
        propertyType: 'A',
        propertySubType: null,
      }),
    ).toBeNull()
  })
})

/**
 * MLS 220218536, 57379 Beaver Ridge, Sunriver — the row that states nothing:
 * no sub type, no remarks, no beds, no baths, no living area. It published
 * "Cap rate 71.2%", "Cash on cash 324.3%", "Cash flow $1,054/mo", "Total
 * monthly (PITI) $115", "Loan amount $15,600", JSON-LD offers.price 19500 and
 * og:description "$19,500 · 57379 Beaver Ridge" with no share label anywhere.
 */
describe('the row that states nothing (MLS 220218536)', () => {
  const BEAVER_RIDGE = {
    propertySubType: null,
    subdivisionName: 'The Ridge',
    city: 'Sunriver',
    listNumber: '220218536',
  }

  it('is a fractional interest by its own dwelling’s listing history', () => {
    // Both other dimensions are silent on it: the feed files no sub type, and
    // The Ridge is deliberately not a registered property.
    expect(listingPriceIsFractionalShare(null)).toBe(false)
    expect(listingIsFractionalInterest(BEAVER_RIDGE)).toBe(true)
    expect(
      publishWholePropertyAmount({ ...BEAVER_RIDGE, price: 19_500, propertyType: 'A' }),
    ).toBeNull()
  })

  it('leaves the whole condos at the same property publishing', () => {
    // The Ridge sold 9 whole units, $199,000–$399,000, each saying "100%
    // share" / "100% ownership" in its own remarks; 220218659 is Pending now.
    // A property entry would have printed "Fractional interest" beside it.
    const wholeCondo = { ...BEAVER_RIDGE, propertySubType: 'Condominium', listNumber: '220218659' }
    expect(listingIsFractionalInterest(wholeCondo)).toBe(false)
    expect(publishWholePropertyAmount({ ...wholeCondo, price: 399_000, propertyType: 'A' })).toBe(
      399_000,
    )
  })

  it('leaves the other 45 silent rows alone — no beds is not a share', () => {
    // 46 live Active class-A rows state no beds, no baths, no living area and
    // no remarks. Only this one's address discloses a share. 220218842 asks
    // $1,600,000 in Awbrey Park and its ask is verified.
    const awbrey = {
      propertySubType: null,
      subdivisionName: 'Awbrey Park',
      city: 'Bend',
      listNumber: '220218842',
    }
    expect(listingIsFractionalInterest(awbrey)).toBe(false)
    expect(publishWholePropertyAmount({ ...awbrey, price: 1_600_000, propertyType: 'A' })).toBe(
      1_600_000,
    )
  })

  it('keys the entry on the MLS number, not on the subdivision', () => {
    // A listing entry withholds from exactly one row. Any other row at The
    // Ridge answers on its own sub type.
    expect(
      listingIsFractionalInterest({ ...BEAVER_RIDGE, listNumber: '220218403' }),
    ).toBe(false)
    expect(
      listingIsFractionalInterest({
        ...BEAVER_RIDGE,
        propertySubType: 'Tenancy in Common',
        listNumber: '220218403',
      }),
    ).toBe(true)
  })
})

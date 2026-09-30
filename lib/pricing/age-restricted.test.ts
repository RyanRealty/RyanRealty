/**
 * Age-restricted product detection. Every positive and every near miss is a
 * real MLS remarks shape (closed Oregon listings, sampled 2026-09-30). The near
 * misses matter as much as the hits: a false positive walls a good comp out of
 * a document.
 */
import { describe, expect, it } from 'vitest'
import {
  AGE_RESTRICTED_PLAT_SHARE,
  ageRestrictedMismatch,
  isAgeRestricted,
  isAgeRestrictedText,
  ownPlatAgeRestrictedShare,
  subjectAgeRestricted,
} from '@/lib/pricing/age-restricted'

describe('isAgeRestrictedText: the phrases that state a restriction', () => {
  it.each([
    // The two sales that priced ordinary homes on 2026-09-29.
    'Single level home in a 55+ community in NW Redmond.',
    'Meticulously maintained 55+ community home with a two car garage.',
    'This incredible over 55+ community offers a peaceful and welcoming environment.',
    'Come take a look at this wonderful home in the desirable 55 & over community of Waverly.',
    'Cottage Canyon is Bend\'s premiere 55 & older community, featuring cottage homes.',
    'Welcome to Dry Canyon, Redmond\'s premier 55+ community by Lennar!',
    'Dry Canyon Village, Central Oregon\'s premier age restricted gated community.',
    'Contemporary home in The Falls, A 55+ Active Adult Community at Eagle Crest!',
    'Wonderful 3 Bedroom with Den/2 Bath Home in The Falls Active Adult Comnmunity.',
    'The Falls is Central Oregon\'s original 55 and older Active Adult Community.',
    'Outstanding Buy At The Falls-active Adult Living For Those 55 Or Better.',
    'The Pines at Sisters, an over 55, private and gated community within the City of Sisters.',
    'Very nice single level home in 55 plus gated community.',
    'Mountain Meadows 55-Plus Community with views of the Siskiyou Mountains.',
    'Beautiful 55 +community with clubhouse & pool.',
    'Located in a 55 + older park.',
    'Summer Creek is a 55 and over community in SW Redmond.',
    '55 & older age requirement.',
    '55+ community so age restrictions apply.',
    'In-Park Type: Senior. Excellent home in a quiet park.',
    'Located in the private senior living community of Queens Garden.',
    'New home in 55 plus active retirement community with clubhouse.',
    'Easy care yard ... perfect Adult living for those over 55!',
    'Nestled in a community designed specifically for active adults over the age of 55.',
  ])('fires on %j', (remarks) => {
    expect(isAgeRestrictedText(remarks)).toBe(true)
  })
})

describe('isAgeRestrictedText: the near misses that must stay quiet', () => {
  it.each([
    // The task's named negatives.
    'Watch the game on the 55 inch TV that conveys with the home.',
    'Built in 1955 and lovingly updated.',
    'Easy access to Hwy 55 and downtown.',
    // Measurement tails the pattern must not read as an age.
    'NEW PRICE!!! 55 +/- acres near Ritter Junction.',
    'Undeveloped, .55 + acre lot with Cascade Mountain views.',
    '20 buildable acres (actually 19.55 +/-).',
    'Two separate tax lots totaling 65,755 +/- SF.',
    'Incredibly spacious at 2,455 +/- sq ft.',
    'Beautiful custom home built on over 55 acres of irrigated land.',
    'Ample storage including over 550 sq ft of unfinished space.',
    'This home has not been on the market in over 55+ yrs!',
    'It Is Obvious From The Plat Map That Lot 6 Is Over 55/100 Of An Acre.',
    'Perfect for workforce housing development, over 55 , or first time home owners?',
    'Unique custom home on 62+ acres of spectacular views.',
    // Negations.
    'HOA fees include water use and snow removal. Not a 55 + community.',
    'This community is not a 55 and over community.',
    'Home offers relaxed living in a friendly neighborhood. No age restrictions.',
    'Vaulted doublewide in all-ages park, no age restrictions.',
    'This is a manufactured home in a family park without any age restrictions.',
    'Acreage restricted to 1 home.',
    // Somewhere nearby, not this home's community.
    'Close to Richardson grade school, Central Point Retirement Center, Twin Creeks Retirement Community, and downtown.',
    'Located across from the 55+ Mountain Meadows Retirement community.',
    'Adjacent to the park is the Larkspur Bend Senior Community Center.',
    // Marketing to an age group.
    'An excellent option for 55+ buyers seeking comfort and accessibility.',
    'This home is perfect for the 55 & over crowd.',
    'This is a must see for the 55 & over home seekers.',
    'Great location for the golfer, active adult, or equestrian lover.',
    'These homes were created for the active adult in mind, low maintenance living.',
    'Great home for senior living or first time home buyer!',
    'A senior living facility is a potential conditional use.',
  ])('stays quiet on %j', (remarks) => {
    expect(isAgeRestrictedText(remarks)).toBe(false)
  })

  it('returns false on empty and missing text', () => {
    expect(isAgeRestrictedText('')).toBe(false)
    expect(isAgeRestrictedText(null)).toBe(false)
    expect(isAgeRestrictedText(undefined)).toBe(false)
  })
})

describe('isAgeRestricted reads remarks and the subdivision name', () => {
  it('fires on the subdivision name alone', () => {
    expect(isAgeRestricted({ publicRemarks: 'Single level home.', subdivision: 'The Falls 55+' })).toBe(true)
  })
  it('fires on remarks alone', () => {
    expect(isAgeRestricted({ publicRemarks: 'In a 55+ community.', subdivision: 'Waverly' })).toBe(true)
  })
  it('is false for an ordinary sale', () => {
    expect(isAgeRestricted({ publicRemarks: 'Three bedrooms on a quiet street.', subdivision: 'Canyon Rim Village' })).toBe(
      false,
    )
  })
})

describe('ageRestrictedMismatch: the wall', () => {
  const ordinarySubject = { publicRemarks: 'Updated single level home near parks.', subdivision: 'Canyon Rim Village' }
  const restrictedSubject = { publicRemarks: 'Gated 55 plus community home.', subdivision: 'Pines At Sisters' }
  const waverly = { publicRemarks: '55+ community in NW Redmond.', subdivision: 'Waverly' }
  const ordinaryComp = { publicRemarks: 'Three bedrooms, fenced yard.', subdivision: 'Canyon Rim Village' }

  it('walls a 55+ sale out of an ordinary subject on another plat (cma-1733-hemlock, 2933 Hemlock)', () => {
    expect(ageRestrictedMismatch({ subject: ordinarySubject, sale: waverly, saleInOwnPlat: false })).toBe(true)
  })

  it('lets a 55+ sale price a 55+ subject', () => {
    expect(ageRestrictedMismatch({ subject: restrictedSubject, sale: waverly, saleInOwnPlat: false })).toBe(false)
  })

  it('never walls an ordinary sale', () => {
    expect(ageRestrictedMismatch({ subject: ordinarySubject, sale: ordinaryComp })).toBe(false)
    expect(ageRestrictedMismatch({ subject: restrictedSubject, sale: ordinaryComp })).toBe(false)
  })

  it('lets an own-plat 55+ sale through a ladder that cannot see the plat yet', () => {
    expect(ageRestrictedMismatch({ subject: ordinarySubject, sale: waverly, saleInOwnPlat: true })).toBe(false)
  })

  it('treats a subject in a mostly-55+ plat as 55+ for every sale, own plat or not (cma-1109-yapoah-crater)', () => {
    // The subject's MLS name is "The Pines"; three of its comps carry "Pines At
    // Sisters". Neither the subject's remarks nor its plat name say 55+.
    const yapoah = { publicRemarks: 'Modern elegance, custom chandeliers, updated cabinetry.', subdivision: 'The Pines' }
    const pinesAtSisters = { publicRemarks: 'Same Pines 55+ product, gated.', subdivision: 'Pines At Sisters' }
    expect(subjectAgeRestricted(yapoah, 0.8)).toBe(true)
    expect(ageRestrictedMismatch({ subject: yapoah, sale: pinesAtSisters, saleInOwnPlat: false, ownPlatShare: 0.8 })).toBe(
      false,
    )
    expect(subjectAgeRestricted(yapoah, 0.5)).toBe(false)
    expect(ageRestrictedMismatch({ subject: yapoah, sale: pinesAtSisters, saleInOwnPlat: false, ownPlatShare: 0.5 })).toBe(
      true,
    )
  })

  it('keeps own-plat 55+ sales when most of the plat is 55+ (a Pines subject whose remarks never say so)', () => {
    const quietSubject = { publicRemarks: 'Single level home with a new roof.', subdivision: 'Pines At Sisters' }
    const share = ownPlatAgeRestrictedShare([
      { publicRemarks: 'Gated 55 plus community.', subdivision: 'Pines At Sisters' },
      { publicRemarks: 'The Pines 55+ gated community.', subdivision: 'Pines At Sisters' },
      { publicRemarks: 'Single level, HOA covers the yard.', subdivision: 'Pines At Sisters' },
    ])
    expect(share).toBeGreaterThan(AGE_RESTRICTED_PLAT_SHARE)
    expect(
      ageRestrictedMismatch({
        subject: quietSubject,
        sale: { publicRemarks: 'Gated 55 plus community.', subdivision: 'Pines At Sisters' },
        saleInOwnPlat: true,
        ownPlatShare: share,
      }),
    ).toBe(false)
  })

  it('walls the 55+ section of a larger plat name (The Falls inside Eagle Crest) from an ordinary Eagle Crest subject', () => {
    const eagleCrest = { publicRemarks: 'Golf course views from the deck.', subdivision: 'Eagle Crest' }
    const falls = { publicRemarks: 'Home in The Falls, a 55+ Active Adult Community at Eagle Crest.', subdivision: 'Eagle Crest' }
    const share = ownPlatAgeRestrictedShare([
      falls,
      { publicRemarks: 'Townhome on the golf course.', subdivision: 'Eagle Crest' },
      { publicRemarks: 'Resort living with pools.', subdivision: 'Eagle Crest' },
      { publicRemarks: 'Single level home.', subdivision: 'Eagle Crest' },
    ])
    expect(share).toBe(0.25)
    expect(ageRestrictedMismatch({ subject: eagleCrest, sale: falls, saleInOwnPlat: true, ownPlatShare: share })).toBe(true)
  })

  it('treats an empty plat view as no evidence the plat is 55+', () => {
    expect(ownPlatAgeRestrictedShare([])).toBeNull()
    expect(ageRestrictedMismatch({ subject: ordinarySubject, sale: waverly, saleInOwnPlat: true, ownPlatShare: null })).toBe(
      true,
    )
  })
})

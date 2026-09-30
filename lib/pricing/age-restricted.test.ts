/**
 * Age-restricted product detection. Every positive and every near miss is a
 * real MLS remarks shape (closed Oregon listings, sampled 2026-09-30). The near
 * misses matter as much as the hits: a false positive walls a good comp out of
 * a document.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AGE_RESTRICTED_PLAT_SHARE,
  ageRestrictedMismatch,
  ageRestrictionReads,
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
    'Nestled in a community designed specifically for active adults over the age of 55.',
    // The review of 2026-09-30: restriction wording the first pass missed.
    'Single level home in a 55-and-older community with a clubhouse.',
    'Over-55 community with low HOA dues.',
    'At least one resident must be 55 years of age or older.',
    'The HOA requires one owner to be 55 or older.',
    'This community operates under HOPA.',
    'Qualifies under the Housing for Older Persons Act.',
    // Real 2024-2026 closed Redmond remarks (the Eagle Crest 55+ section by name).
    'Start your next adventure in The Falls 55+, where breathtaking panoramic views meet resort-style living.',
    'Beautifully updated single-level in The Falls 55+ at Eagle Crest Resort!',
    'Welcome to Summer Creek, a sought-after 55+ community!',
    'Dry Canyon Village is Central Oregon\'s premier age-restricted 55+ gated community.',
    'Cardio, locker rooms and so much more at this sought-after 55+ enclave!',
    'Indulge in the luxury of a gated 55+ active adult living community!',
    'The Pines is a gated community for those 55 and older.',
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
    // The review of 2026-09-30: marketing copy is not a restriction, and a count
    // or a measurement after "over" is not an age.
    'Single level living, ideal for 55+ living.',
    'Great for anyone 55+.',
    'This home is perfect for 55+ or first-time buyers.',
    'Ideal for those 55 and older looking to downsize.',
    'Family owned for over 55 years.',
    'Over 55 miles of trails right out the door.',
    'A master planned community of over 55 homes.',
    'The shop and home total over 55,000 sq ft under roof.',
    'Perfect For 55+ Living In Great Condition.',
    'Great community for anyone 55+ or growing families.',
    'Located in Bend. 55+ buyers will love the single level.',
    // Pitches that name an age group (moved here from the positives: neither
    // names a restriction, a community rule or an HOA requirement).
    'Outstanding Buy At The Falls-active Adult Living For Those 55 Or Better.',
    'Easy care yard ... perfect Adult living for those over 55!',
    // Real closed remarks carrying a 55 that is a number.
    'This recently updated 3 bedroom, 2 bath 1558 sqft home.',
    'Surrounded by over 550 acres of park land.',
    'A Private Member Club, 55,000 sqft Club House, pools and a spa.',
    'Homesite #55 - MOVE IN READY.',
    'ASK about the 2.55% assumable loan.',
    'Tax Lot 05400 and Tax Lot 05500, offering flexibility.',
    'Close to the Bend Senior Center and Larkspur Park.',
    'Adjacent to the Senior Community Center and the library.',
    'Near the new 55+ community going in down the road.',
  ])('stays quiet on %j', (remarks) => {
    expect(isAgeRestrictedText(remarks)).toBe(false)
  })

  it('returns false on empty and missing text', () => {
    expect(isAgeRestrictedText('')).toBe(false)
    expect(isAgeRestrictedText(null)).toBe(false)
    expect(isAgeRestrictedText(undefined)).toBe(false)
  })
})

describe('isAgeRestrictedText: every restriction the 2026-09-30 wide sample found (real remarks, ten Central Oregon cities)', () => {
  // The second version read a 55 as a restriction only with a community word
  // right after it. A seeded sample of 100 hard negatives (seed 20260930)
  // showed that missed most parks and several Redmond plats. Each shape below
  // is a real remark from that sample or from the rows whose verdict changed.
  it.each([
    'Newly updated 2 bedroom situated in over-55 park on the edge of Redmond.',
    'It is in a 55 years and older park.',
    'Fenced back yard with 2 storage buildings. 55+ yrs. park, Space Rent $333.',
    'Custom home in The Falls Active Adult 55 Community, 2622 Sq Ft.',
    'Mobile Home only in one of the finest Senior (55 years and over) Parks in Bend.',
    'This charming single level home in The Pines, a 55 year and older gated community in the heart of Sisters.',
    '55 Year and older trailer park! Newer 2 bedroom 1 bath single-wide.',
    'A restful retreat found at this quiet park where you must be 55 years or older, and no rentals are allowed.',
    'Spacious Cottage-style Home In New Active Adult Commun. 3 Bed, 2 Bath.',
    'Active adult lifestyle community at The Falls at Eagle Crest.',
    "Wonderfull home in The Falls, Central Oregon's original Active Adult Comminity.",
    'Home in 55+ Suntree Village Park! 2 BR/2 BA.',
    'Welcome to 55+ Cascade Village MHP with updated large club house.',
    'Nestled in a tranquil 55+, very quiet, community.',
    'Beautiful 55+ Snowberry Village. Near medical community and lots of shopping.',
    'Welcome to your private retreat in Cascade Village, a 55+ luxury community.',
    'Premier 55+ mature living community in beautiful NW Redmond.',
    'Nestled in the quiet cul-de-sac of the desirable 55+ Summer Creek community.',
    'Located in a 55+ well maintained community w/access to public lands.',
    '55+ Senior Mfg Home Park. Very clean home.',
    'Updated, well-kept home in desirable 55+ Mt. View MH Park.',
    'Suntree Village 55+ with 3 car garage. Cash only.',
    'Beautiful Suntree Village (55+) park. Close to new senior center!',
    'Affordable living in a very nice mobile home park, 55 and over.',
    'Rent Is $265/Month & Requires Pre-park Approval. Adult Park 55 & Older.',
    'Park is now 55 and older and buyers must have park manager approval.',
    'This is a Co-Op Membership Senior 55+ adult mobile home park conveniently located to nearby shopping.',
    'Located on a corner lot in Cottage Canyon, a very friendly 55+ neighborhood, you will enjoy nearby shopping.',
    'Great home in a 55+ Community in Redmond, across the street from the golf course.',
    'Upgraded home in 55+ community with a park across the street!',
    'Located in a 55 and older cummunity.',
    'Well maintained mfg home in 55+ Ni La Sha. Quiet location close to hospital.',
    'Hard to find 55+ in Suntree Village with maintained park close to Senior Center.',
    'Great community in 55+. Well kept move in ready home.',
    'Very nice home in 55+. Close to all amenities.',
    'One of the larger lots in The Falls (55+), mature landscaping.',
    'Gorgeous single level with private setting in the Falls 55+ at Eagle Crest Resort!',
    'Fabulous home in The Falls, 55+ at Eagle Crest has an open floorplan.',
    'It is in the Falls, a 55 and older (very active) community.',
    'Smith rock area senior 55 and over MH PK.',
    'New Home In Brooks Camp Village @ The Pines, Quality, 55+ Adult Living, Gated Comm W/Clubhse.',
    "Charming, 55+ Adult Gated Comm'ty Of Brooks Camp Village At The Pines.",
    'Disc Quality 55+ Adult Liv In Gated Comm Of Brooks Camp Vi @ The Pines.',
    'Summer Creek, The community for active 55+. Awesome views.',
    'Medical Facilities -55+ Park- Carpets To Be Cleaned By Seller.',
    "Well cared for home in Redmond's premier 55+ Summer Creek addition.",
    'This is a 55 and older facility.',
    'Totally remolded move in ready 55+ in family owned park.',
    'Prestigious Cascade Village Mobile Home Park 55 and older.',
    'In the original Phase 1 of gated 55+ Dry Canyon, enjoy pickleball.',
    "Enjoy Resort living in one of Central Oregon's only active adult (55+) communities.",
    'Are you looking to live in a great 55+ community with lots of things to do?',
    'Want to live in a terrific 55+ Park in Bend? Rock Arbor Villa is the place for you!',
    'Secure Neighborhood W/ Friendly, Active People Age 55+.',
    'Perfect home for someone looking in a 55 and older community with all the amenities of Eagle Crest nearby.',
  ])('fires on %j', (remarks) => {
    expect(isAgeRestrictedText(remarks)).toBe(true)
  })

  it('reads "the NW corner of 55+ Suntree" on a Suntree Village sale', () => {
    const remarks = 'A must see! Nestled in the NW corner of 55+ Suntree, set back off the street.'
    expect(isAgeRestrictedText(remarks, { subdivision: 'Suntree Village' })).toBe(true)
    expect(isAgeRestricted({ publicRemarks: remarks, subdivision: 'Suntree Village' })).toBe(true)
  })

  it.each([
    // Pitches to an age group, real remarks.
    "55+ living at it's finest! See you at The Clubhouse!",
    'Relax & enjoy carefree 55+ living at its finest!',
    'Premier 55+ Living! Come enjoy all the amenities that Cascade Village offers.',
    'This very well kept community is perfect for the 55+ lifestyle who wants a little quieter environment.',
    'Refreshing & lovely home. If you are 55+, this community is delightful, well managed.',
    'The best spot in Central OR to retire--if you are 55+ and want to enjoy an active lifestyle.',
    'Senior living oasis. Are you 55 or older and not interested in assisted living?',
    'Over 55? This home is for you!',
    'Over 55 and looking to downsize. This home is for you.',
    // Not a restriction on this home.
    'Manufactured home in a desired, gated community of primarily 55+.',
    // Serving or catering to an age group is who the place markets to (the final
    // seeded sample's one false positive, P022).
    'Single level home in the desirable Waverly neighborhood, catering to the 55+ community.',
    'The gated community caters to the 55+ crowd.',
    'A peaceful park like community that serves 55+ active adults.',
    'These 2 phases are NOT a senior phase (Ph #1 of Ni-La-Sha 55+ phase).',
    'No longer a 55 and over requirement.',
    // Numbers.
    'RV hookups, 2-zone heat pump & central AC, pvt 55+gpm well.',
    'Borders of beds that support over 55 varieties of flowers and plants.',
    'Perfect for workforce housing development, over 55 , or first time home owners?',
  ])('stays quiet on %j', (remarks) => {
    expect(isAgeRestrictedText(remarks)).toBe(false)
  })

  it('leaves six terse shapes to the MLS flag, which every one of those sales carries', () => {
    // "55+" used as a noun with no place word, rule or pitch around it. The
    // text alone does not say a community restricts by age, so the text rule
    // does not claim it; the SeniorCommunityYN flag on each of these real
    // sales does, and the wall reads the flag.
    for (const remarks of [
      'Lovely 55+ home on cul-de-sac in Suntree Village.',
      'Large Beautiful 55+ on double lot w/fenced yard.',
      'Beautiful remolded 55+ on double lot w/fenced yard.',
      'Very Desirable 55+ close to hospital and shopping.',
      'Exclusive over 55 offers peace & quiet & easy access to retail shops.',
      'Enjoy the active Eagle Crest 55+ Falls lifestyle offering golf, trails and pools.',
    ]) {
      expect(isAgeRestrictedText(remarks)).toBe(false)
      expect(isAgeRestricted({ publicRemarks: remarks, subdivision: null, seniorCommunityYn: true })).toBe(true)
    }
  })
})

describe('isAgeRestricted reads remarks and the subdivision name', () => {
  it('fires on the subdivision name alone', () => {
    expect(isAgeRestricted({ publicRemarks: 'Single level home.', subdivision: 'The Falls 55+' })).toBe(true)
  })
  it('fires on remarks alone', () => {
    expect(isAgeRestricted({ publicRemarks: 'In a 55+ community.', subdivision: 'Waverly' })).toBe(true)
  })
  it('reads the MLS SeniorCommunityYN flag as evidence, and only when it is true', () => {
    expect(isAgeRestricted({ publicRemarks: null, subdivision: 'Brookside', seniorCommunityYn: true })).toBe(true)
    // False or null is the MLS default an agent leaves in place: never evidence against.
    expect(isAgeRestricted({ publicRemarks: 'In a 55+ community.', subdivision: 'Waverly', seniorCommunityYn: false })).toBe(true)
    expect(isAgeRestricted({ publicRemarks: 'Three bedrooms.', subdivision: 'Canyon Rim Village', seniorCommunityYn: null })).toBe(
      false,
    )
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

  it('walls the 55+ sale from a subject whose remarks only pitch to 55+ buyers (the review repro)', () => {
    // "ideal for 55+ living" used to make an ordinary Redmond home read as 55+,
    // which turned the wall off against the Waverly sale: the cma-1733 defect.
    const pitched = { publicRemarks: 'Single level home, ideal for 55+ living.', subdivision: 'Canyon Rim Village' }
    expect(subjectAgeRestricted(pitched, null)).toBe(false)
    expect(ageRestrictedMismatch({ subject: pitched, sale: waverly, saleInOwnPlat: false })).toBe(true)
    // And the same pitch on a comp does not wall an ordinary sale.
    expect(ageRestrictedMismatch({ subject: ordinarySubject, sale: { ...ordinaryComp, publicRemarks: 'Great for anyone 55+.' } })).toBe(
      false,
    )
  })

  it('walls a comp whose MLS flag is true, even with no remarks, from an ordinary subject', () => {
    const flagged = { publicRemarks: null, subdivision: 'Canyon Rim Village', seniorCommunityYn: true }
    expect(ageRestrictedMismatch({ subject: ordinarySubject, sale: flagged, saleInOwnPlat: false })).toBe(true)
  })

  it('treats a subject whose MLS flag is true as 55+', () => {
    const flaggedSubject = { publicRemarks: 'Updated single level home.', subdivision: 'Canyon Rim Village', seniorCommunityYn: true }
    expect(subjectAgeRestricted(flaggedSubject, null)).toBe(true)
    expect(ageRestrictedMismatch({ subject: flaggedSubject, sale: waverly, saleInOwnPlat: false })).toBe(false)
  })

  it('counts flagged sales in the plat-majority share', () => {
    const share = ownPlatAgeRestrictedShare([
      { publicRemarks: null, subdivision: 'Waverly', seniorCommunityYn: true },
      { publicRemarks: 'Single level.', subdivision: 'Waverly', seniorCommunityYn: true },
      { publicRemarks: 'Single level.', subdivision: 'Waverly', seniorCommunityYn: false },
    ])
    expect(share).toBeCloseTo(2 / 3, 5)
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
    const pinesAtSisters = { publicRemarks: 'Single level home in The Pines, a gated 55+ community.', subdivision: 'Pines At Sisters' }
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

describe('one read per sale per walk (second review of da8dce6, item B)', () => {
  const ordinary = { publicRemarks: 'Single level home on a quiet street.', subdivision: 'Canyon Rim Village', seniorCommunityYn: null }

  it('reads a sale once however many rungs grade it, and the subject once per walk', () => {
    const pool = Array.from({ length: 50 }, (_, i) => ({
      listingKey: `memo-walk-${i}`,
      publicRemarks: i % 5 === 0 ? 'Single level home in a gated 55+ community.' : 'Updated kitchen and a new roof.',
      subdivision: 'Canyon Rim Village',
      seniorCommunityYn: null,
    }))
    const subject = { ...ordinary }
    const before = ageRestrictionReads.count
    let walled = 0
    for (let rung = 0; rung < 10; rung++) {
      for (const sale of pool) {
        // A fresh row object on every rung, as the listings ladder builds one per row.
        if (ageRestrictedMismatch({ subject, sale: { ...sale }, saleInOwnPlat: false, ownPlatShare: null })) walled++
      }
    }
    expect(walled).toBe(10 * 10)
    // 50 sales by key, and the key-less subject by object: 51 reads for 500 grades.
    expect(ageRestrictionReads.count - before).toBe(51)
  })

  it('reads a record again when its fields change under the same key, so the memo is never stale', () => {
    const key = 'memo-change-1'
    expect(isAgeRestricted({ listingKey: key, publicRemarks: 'Updated kitchen.', subdivision: 'Canyon Rim Village' })).toBe(false)
    expect(isAgeRestricted({ listingKey: key, publicRemarks: 'In a gated 55+ community.', subdivision: 'Canyon Rim Village' })).toBe(true)
    expect(isAgeRestricted({ listingKey: key, publicRemarks: 'In a gated 55+ community.', subdivision: 'Canyon Rim Village', seniorCommunityYn: false })).toBe(true)
    expect(isAgeRestricted({ listingKey: key, publicRemarks: 'Updated kitchen.', subdivision: 'The Falls 55+' })).toBe(true)
  })

  it('compiles every pattern once, at module scope', () => {
    const src = readFileSync(path.join(process.cwd(), 'lib/pricing/age-restricted.ts'), 'utf8')
    const lines = src.split('\n').filter((l) => l.includes('new RegExp('))
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) expect(line, line).toMatch(/^(?:const \w+ = new RegExp\(|\s+re: new RegExp\()/)
  })
})

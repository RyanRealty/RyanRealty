/**
 * Trail hero photo credits — sourcing ladder per docs/CONTENT_ENGINE_SPEC.md §11b:
 * a real, correctly-licensed photo of the actual place from Wikimedia Commons,
 * always with photographer + license recognition. Every file below was verified
 * for correct subject and an acceptable license (CC0/PD, CC BY, or CC BY-SA — no
 * NC/ND). Files live in public/images/trails/<slug>.jpg (2000x1200, sourced
 * 2026-07-03). Trails without an entry fall back to the canonical Central Oregon
 * hero — we never mis-attribute a photo to a place it does not show.
 */

export type TrailHeroCredit = {
  image: string
  credit: string
  creditUrl: string
  source: string
  license: string
}

const IMG = '/images/trails'

export const TRAIL_HERO_CREDITS: Record<string, TrailHeroCredit> = {
  'pilot-butte': {
    image: `${IMG}/pilot-butte.jpg`,
    credit: 'Lyn Topinka, USGS (Public Domain)',
    creditUrl: 'https://commons.wikimedia.org/wiki/File:Pilot_Butte,_Bend,_Oregon.jpg',
    source: 'Wikimedia Commons',
    license: 'Public Domain',
  },
  'tumalo-falls': {
    image: `${IMG}/tumalo-falls.jpg`,
    credit: 'John Hutmacher, U.S. Forest Service (Public Domain)',
    creditUrl:
      'https://commons.wikimedia.org/wiki/File:Deschutes_National_Forest_Tumalo_Falls_(36904288776).jpg',
    source: 'Wikimedia Commons',
    license: 'Public Domain',
  },
  'south-sister-climber-trail': {
    image: `${IMG}/south-sister-climber-trail.jpg`,
    credit: 'Joe Peacock (CC BY-SA 4.0)',
    creditUrl: 'https://commons.wikimedia.org/wiki/File:South_Sister_from_Camp_Lake.jpg',
    source: 'Wikimedia Commons',
    license: 'CC BY-SA 4.0',
  },
  'green-lakes': {
    image: `${IMG}/green-lakes.jpg`,
    credit: 'U.S. Forest Service (Public Domain)',
    creditUrl:
      'https://commons.wikimedia.org/wiki/File:Three_Sisters_and_Green_Lakes-Deschutes_(23906472146).jpg',
    source: 'Wikimedia Commons',
    license: 'Public Domain',
  },
  'ray-atkeson-trail': {
    image: `${IMG}/ray-atkeson-trail.jpg`,
    credit: 'John Hutmacher, U.S. Forest Service (Public Domain)',
    creditUrl:
      'https://commons.wikimedia.org/wiki/File:Deschutes_National_Forest_South_Sister_Sparks_Lake_(36696215990).jpg',
    source: 'Wikimedia Commons',
    license: 'Public Domain',
  },
  'misery-ridge': {
    image: `${IMG}/misery-ridge.jpg`,
    credit: 'Tequask (CC BY-SA 4.0)',
    creditUrl: 'https://commons.wikimedia.org/wiki/File:Smith_Rock_Cliffs.jpg',
    source: 'Wikimedia Commons',
    license: 'CC BY-SA 4.0',
  },
  'smith-rock-river-trail': {
    image: `${IMG}/smith-rock-river-trail.jpg`,
    credit: 'Jordan Beard (CC BY-SA 4.0)',
    creditUrl: 'https://commons.wikimedia.org/wiki/File:Smith_Rock_at_sunset_2.jpg',
    source: 'Wikimedia Commons',
    license: 'CC BY-SA 4.0',
  },
  'steelhead-falls': {
    image: `${IMG}/steelhead-falls.jpg`,
    credit: 'Bob Wick, Bureau of Land Management (CC BY 2.0)',
    creditUrl:
      'https://commons.wikimedia.org/wiki/File:Steelhead_Falls_on_the_Deschutes_River_(21853061050).jpg',
    source: 'Wikimedia Commons',
    license: 'CC BY 2.0',
  },
  'benham-falls': {
    image: `${IMG}/benham-falls.jpg`,
    credit: 'Jocelyn Biro, U.S. Forest Service (Public Domain)',
    creditUrl:
      'https://commons.wikimedia.org/wiki/File:BENHAM_FALLS_FROM_TRAIL-DESCHUTES_(28771705505).jpg',
    source: 'Wikimedia Commons',
    license: 'Public Domain',
  },
  'tumalo-mountain': {
    image: `${IMG}/tumalo-mountain.jpg`,
    credit: 'Jsayre64 (CC BY-SA 3.0)',
    creditUrl: 'https://commons.wikimedia.org/wiki/File:Tumalo_Mtn_from_below_Mt_Bachelor.JPG',
    source: 'Wikimedia Commons',
    license: 'CC BY-SA 3.0',
  },
  'deschutes-river-trail-first-street': {
    image: `${IMG}/deschutes-river-trail-first-street.jpg`,
    credit: 'Bill Reynolds (CC BY 2.0)',
    creditUrl: 'https://commons.wikimedia.org/wiki/File:Bend_Oregon_(37520354866).jpg',
    source: 'Wikimedia Commons',
    license: 'CC BY 2.0',
  },
  'shevlin-park': {
    image: `${IMG}/shevlin-park.jpg`,
    credit: 'Rebecca Wilson (CC BY 2.0)',
    creditUrl: 'https://commons.wikimedia.org/wiki/File:Bridge_of_Tumalo_Creek_in_Shevlin_Park.jpg',
    source: 'Wikimedia Commons',
    license: 'CC BY 2.0',
  },
  'sawyer-park': {
    image: `${IMG}/sawyer-park.jpg`,
    credit: 'UpdateNerd (CC0 1.0)',
    creditUrl: 'https://commons.wikimedia.org/wiki/File:Sawyer_Park_-_water_under_bridge.jpg',
    source: 'Wikimedia Commons',
    license: 'CC0 1.0',
  },
  'peterson-ridge': {
    image: `${IMG}/peterson-ridge.jpg`,
    credit: 'Mike Thompson (CC BY-SA 3.0)',
    creditUrl: 'https://commons.wikimedia.org/wiki/File:South_Sister_Morning_Light_(42339688).jpeg',
    source: 'Wikimedia Commons',
    license: 'CC BY-SA 3.0',
  },
  'alder-springs': {
    image: `${IMG}/alder-springs.jpg`,
    credit: 'U.S. Forest Service (Public Domain)',
    creditUrl:
      'https://commons.wikimedia.org/wiki/File:LOWER_WHYCHUS_CREEK_CANYON-DESCHUTES_(23848626961).jpg',
    source: 'Wikimedia Commons',
    license: 'Public Domain',
  },
  'gray-butte': {
    image: `${IMG}/gray-butte.jpg`,
    credit: 'U.S. Forest Service (Public Domain)',
    creditUrl:
      'https://commons.wikimedia.org/wiki/File:Crooked_River_National_Grassland_in_Fall-Ochoco_(23907513916).jpg',
    source: 'Wikimedia Commons',
    license: 'Public Domain',
  },
}

/**
 * Venue hero photo credits — same sourcing ladder as event heroes
 * (docs/CONTENT_ENGINE_SPEC.md §11b): real venue photos from Wikimedia Commons
 * where they exist (Tower Theatre, the Old Mill amphitheater, McMenamins),
 * otherwise a licensed lifestyle photo, always with photographer recognition.
 * Files in public/images/venues/.
 */

export type VenueHeroCredit = {
  image: string
  credit: string
  creditUrl: string
  source: string
  license: string
}

export const VENUE_HERO_CREDITS: Record<string, VenueHeroCredit> = {
  'greenwood-playhouse': { image: '/images/venues/greenwood-playhouse.jpg', credit: 'stefano stacchini / Unsplash', creditUrl: 'https://unsplash.com/@stak59', source: 'Unsplash', license: 'Unsplash License' },
  'second-street-theater': { image: '/images/venues/second-street-theater.jpg', credit: 'Martin Martz / Unsplash', creditUrl: 'https://unsplash.com/@martz90', source: 'Unsplash', license: 'Unsplash License' },
  'volcanic-theatre-pub': { image: '/images/venues/volcanic-theatre-pub.jpg', credit: 'Nainoa Shizuru / Unsplash', creditUrl: 'https://unsplash.com/@nainoa', source: 'Unsplash', license: 'Unsplash License' },
  'midtown-ballroom': { image: '/images/venues/midtown-ballroom.jpg', credit: 'Nathan Fertig / Unsplash', creditUrl: 'https://unsplash.com/@nathanfertig', source: 'Unsplash', license: 'Unsplash License' },
  'silver-moon-brewing': { image: '/images/venues/silver-moon-brewing.jpg', credit: 'Quaid Lagan / Unsplash', creditUrl: 'https://unsplash.com/@freshseteyes', source: 'Unsplash', license: 'Unsplash License' },
  'worthy-brewing': { image: '/images/venues/worthy-brewing.jpg', credit: 'Samuel Regan-Asante / Unsplash', creditUrl: 'https://unsplash.com/@reganography', source: 'Unsplash', license: 'Unsplash License' },
  'rivers-place': { image: '/images/venues/rivers-place.jpg', credit: 'Anderson Schmig / Unsplash', creditUrl: 'https://unsplash.com/@schmig', source: 'Unsplash', license: 'Unsplash License' },
  'bunk-brew': { image: '/images/venues/bunk-brew.jpg', credit: 'Giorgio Trovato / Unsplash', creditUrl: 'https://unsplash.com/@giorgiotrovato', source: 'Unsplash', license: 'Unsplash License' },
  'the-commons-bend': { image: '/images/venues/the-commons-bend.jpg', credit: 'Daniel Sherman / Unsplash', creditUrl: 'https://unsplash.com/@sherman101', source: 'Unsplash', license: 'Unsplash License' },
  'high-desert-music-hall': { image: '/images/venues/high-desert-music-hall.jpg', credit: 'Nainoa Shizuru / Unsplash', creditUrl: 'https://unsplash.com/@nainoa', source: 'Unsplash', license: 'Unsplash License' },
  'general-duffys-waterhole': { image: '/images/venues/general-duffys-waterhole.jpg', credit: 'ArtHouse Studio / Pexels', creditUrl: 'https://www.pexels.com/@arthousestudio', source: 'Pexels', license: 'Pexels License' },
  'sunriver-resort-concerts': { image: '/images/venues/sunriver-resort-concerts.jpg', credit: 'Drew Walker / Unsplash', creditUrl: 'https://unsplash.com/@drewwalkerphoto', source: 'Unsplash', license: 'Unsplash License' },
  'tin-pan-theater': { image: '/images/venues/tin-pan-theater.jpg', credit: 'Jacob Mejicanos / Unsplash', creditUrl: 'https://unsplash.com/@jacobmejicanos', source: 'Unsplash', license: 'Unsplash License' },
  'open-space-event-studios': { image: '/images/venues/open-space-event-studios.jpg', credit: 'Fer Troulik / Unsplash', creditUrl: 'https://unsplash.com/@fertroulik', source: 'Unsplash', license: 'Unsplash License' },
  'sisters-movie-house': { image: '/images/venues/sisters-movie-house.jpg', credit: 'Jacob Mejicanos / Unsplash', creditUrl: 'https://unsplash.com/@jacobmejicanos', source: 'Unsplash', license: 'Unsplash License' },
  'tower-theatre': { image: '/images/venues/tower-theatre.jpg', credit: 'Another Believer / Wikimedia Commons', creditUrl: 'https://commons.wikimedia.org/wiki/File%3ATower_Theatre%2C_Bend%2C_Oregon_-_2012.JPG', source: 'Wikimedia Commons', license: 'CC BY-SA 3.0' },
  'hayden-homes-amphitheater': { image: '/images/venues/hayden-homes-amphitheater.jpg', credit: 'Beastes35 / Wikimedia Commons', creditUrl: 'https://commons.wikimedia.org/wiki/File%3AHHA-Brantley-Gilbert-Drone-2021-Matthew-Lasala-7.jpg', source: 'Wikimedia Commons', license: 'CC BY-SA 4.0' },
  'mcmenamins-old-st-francis': { image: '/images/venues/mcmenamins-old-st-francis.jpg', credit: 'Orygun / Wikimedia Commons', creditUrl: 'https://commons.wikimedia.org/wiki/File%3AMcMenamins_Pub_and_Brewery%2C_Bend%2C_Oregon.JPG', source: 'Wikimedia Commons', license: 'CC BY-SA 3.0' },
  'the-belfry': { image: '/images/venues/the-belfry.jpg', credit: 'Big Bag Films / Pexels', creditUrl: 'https://www.pexels.com/@bigbagfilms', source: 'Pexels', license: 'Pexels License' },
  'sunriver-stars': { image: '/images/venues/sunriver-stars.jpg', credit: 'Jacky. T. R. Chou / Pexels', creditUrl: 'https://www.pexels.com/@jacky-t-r-chou-1298475188', source: 'Pexels', license: 'Pexels License' },
}

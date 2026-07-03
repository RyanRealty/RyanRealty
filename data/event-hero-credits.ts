/**
 * Event hero photo credits.
 *
 * Each hero is a genuinely relevant, licensed photo (place-accurate where a real
 * venue photo exists on Wikimedia Commons, otherwise a licensed lifestyle photo
 * from Unsplash / Pexels) with photographer recognition rendered on the page
 * (docs/CONTENT_ENGINE_SPEC.md §11b). Files in public/images/events/. Events
 * without an entry fall back to the canonical Central Oregon lifestyle hero.
 */

export type EventHeroCredit = {
  image: string
  credit: string
  creditUrl: string
  source: string
  license: string
}

export const EVENT_HERO_CREDITS: Record<string, EventHeroCredit> = {
  'munch-and-music': { image: '/images/events/munch-and-music.jpg', credit: 'Gary Halvorson, Oregon State Archives / Wikimedia Commons', creditUrl: 'https://commons.wikimedia.org/wiki/File%3ADrake_Park%2C_Mirror_Pond%2C_Bend_-_DPLA_-_0ec86d7df8f155ccbacd5f866e29375d.jpg', source: 'Wikimedia Commons', license: 'CC BY 4.0' },
  'balloons-over-bend': { image: '/images/events/balloons-over-bend.jpg', credit: 'Raychel Sanner / Unsplash', creditUrl: 'https://unsplash.com/@raychelsnr', source: 'Unsplash', license: 'Unsplash License' },
  'sisters-outdoor-quilt-show': { image: '/images/events/sisters-outdoor-quilt-show.jpg', credit: 'Kha Ruxury / Pexels', creditUrl: 'https://www.pexels.com/@kha-ruxury-287153', source: 'Pexels', license: 'Pexels License' },
  'bend-oktoberfest': { image: '/images/events/bend-oktoberfest.jpg', credit: 'Bastian Riccardi / Pexels', creditUrl: 'https://www.pexels.com/@shutter-speed', source: 'Pexels', license: 'Pexels License' },
  'bendfilm-festival': { image: '/images/events/bendfilm-festival.jpg', credit: 'Christian Lue / Unsplash', creditUrl: 'https://unsplash.com/@christianlue', source: 'Unsplash', license: 'Unsplash License' },
  'deschutes-county-fair': { image: '/images/events/deschutes-county-fair.jpg', credit: 'Scotty Turner / Unsplash', creditUrl: 'https://unsplash.com/@thinkscotty', source: 'Unsplash', license: 'Unsplash License' },
  'sunriver-music-festival': { image: '/images/events/sunriver-music-festival.jpg', credit: 'Robert Katzki / Unsplash', creditUrl: 'https://unsplash.com/@ro_ka', source: 'Unsplash', license: 'Unsplash License' },
  'bend-summer-festival': { image: '/images/events/bend-summer-festival.jpg', credit: 'Charles Puaud / Unsplash', creditUrl: 'https://unsplash.com/@charlesp25', source: 'Unsplash', license: 'Unsplash License' },
  'sisters-rodeo': { image: '/images/events/sisters-rodeo.jpg', credit: '@coldbeer / Pexels', creditUrl: 'https://www.pexels.com/@coldbeer-277046249', source: 'Pexels', license: 'Pexels License' },
  'pole-pedal-paddle': { image: '/images/events/pole-pedal-paddle.jpg', credit: 'Matt Busse / Unsplash', creditUrl: 'https://unsplash.com/@prbusse', source: 'Unsplash', license: 'Unsplash License' },
  'cascade-lakes-relay': { image: '/images/events/cascade-lakes-relay.jpg', credit: 'Peter Thomas / Unsplash', creditUrl: 'https://unsplash.com/@lifeof_peter_', source: 'Unsplash', license: 'Unsplash License' },
  'bend-winterfest': { image: '/images/events/bend-winterfest.jpg', credit: 'Jamie B. / Wikimedia Commons', creditUrl: 'https://commons.wikimedia.org/wiki/File%3AOld_Mill_District%2C_Bend%2C_OR_2009.jpg', source: 'Wikimedia Commons', license: 'CC BY 2.0' },
  'bend-fall-festival': { image: '/images/events/bend-fall-festival.jpg', credit: 'Oleg Bersenev / Unsplash', creditUrl: 'https://unsplash.com/@olegbrsnv', source: 'Unsplash', license: 'Unsplash License' },
  'bend-farmers-market': { image: '/images/events/bend-farmers-market.jpg', credit: 'Shelley Pauls / Unsplash', creditUrl: 'https://unsplash.com/@shelleypauls', source: 'Unsplash', license: 'Unsplash License' },
  'nwx-farmers-market': { image: '/images/events/nwx-farmers-market.jpg', credit: 'Bovia & Co. Photography / Unsplash', creditUrl: 'https://unsplash.com/@boviaco', source: 'Unsplash', license: 'Unsplash License' },
  'redmond-farmers-market': { image: '/images/events/redmond-farmers-market.jpg', credit: 'Shelley Pauls / Unsplash', creditUrl: 'https://unsplash.com/@shelleypauls', source: 'Unsplash', license: 'Unsplash License' },
  'sisters-farmers-market': { image: '/images/events/sisters-farmers-market.jpg', credit: 'Daniel Spilka / Unsplash', creditUrl: 'https://unsplash.com/@dans91', source: 'Unsplash', license: 'Unsplash License' },
  'crop-farmers-market': { image: '/images/events/crop-farmers-market.jpg', credit: 'Shelley Pauls / Unsplash', creditUrl: 'https://unsplash.com/@shelleypauls', source: 'Unsplash', license: 'Unsplash License' },
  'first-friday-art-walk': { image: '/images/events/first-friday-art-walk.jpg', credit: 'Jessica Pamp / Unsplash', creditUrl: 'https://unsplash.com/@yessijes', source: 'Unsplash', license: 'Unsplash License' },
  'bend-venture-conference': { image: '/images/events/bend-venture-conference.jpg', credit: 'Marwen Larafa / Unsplash', creditUrl: 'https://unsplash.com/@marwen_larafa', source: 'Unsplash', license: 'Unsplash License' },
  'sunriver-art-fair': { image: '/images/events/sunriver-art-fair.jpg', credit: 'Zhen Yao / Unsplash', creditUrl: 'https://unsplash.com/@zhenyao_photo', source: 'Unsplash', license: 'Unsplash License' },
  'the-little-woody': { image: '/images/events/the-little-woody.jpg', credit: 'Maksym Kaharlytskyi / Unsplash', creditUrl: 'https://unsplash.com/@qwitka', source: 'Unsplash', license: 'Unsplash License' },
  'central-oregon-beer-week': { image: '/images/events/central-oregon-beer-week.jpg', credit: 'Jon Parry / Unsplash', creditUrl: 'https://unsplash.com/@zn35pjqq', source: 'Unsplash', license: 'Unsplash License' },
  'bend-4th-of-july-pet-parade': { image: '/images/events/bend-4th-of-july-pet-parade.jpg', credit: 'YUNAN WANG / Unsplash', creditUrl: 'https://unsplash.com/@eysmanpics', source: 'Unsplash', license: 'Unsplash License' },
  'sunriver-4th-of-july': { image: '/images/events/sunriver-4th-of-july.jpg', credit: 'Janay Peters / Unsplash', creditUrl: 'https://unsplash.com/@jpetersbydesign', source: 'Unsplash', license: 'Unsplash License' },
  'la-pine-frontier-days': { image: '/images/events/la-pine-frontier-days.jpg', credit: 'Ian MacDonald / Unsplash', creditUrl: 'https://unsplash.com/@imacdonald3', source: 'Unsplash', license: 'Unsplash License' },
  'downtown-bend-tree-lighting': { image: '/images/events/downtown-bend-tree-lighting.jpg', credit: '1.33X MotionPicture / Unsplash', creditUrl: 'https://unsplash.com/@133xmotionpicture', source: 'Unsplash', license: 'Unsplash License' },
  'sunriver-grand-illumination': { image: '/images/events/sunriver-grand-illumination.jpg', credit: 'Den Ho / Unsplash', creditUrl: 'https://unsplash.com/@ddennis_h', source: 'Unsplash', license: 'Unsplash License' },
  'winter-pridefest': { image: '/images/events/winter-pridefest.jpg', credit: 'Raphael Renter | @raphi_rawr / Unsplash', creditUrl: 'https://unsplash.com/@raphi_rawr', source: 'Unsplash', license: 'Unsplash License' },
  'bend-pride': { image: '/images/events/bend-pride.jpg', credit: 'Raphael Renter | @raphi_rawr / Unsplash', creditUrl: 'https://unsplash.com/@raphi_rawr', source: 'Unsplash', license: 'Unsplash License' },
  'sisters-harvest-faire': { image: '/images/events/sisters-harvest-faire.jpg', credit: 'Margo Evardson / Unsplash', creditUrl: 'https://unsplash.com/@stadinstudio', source: 'Unsplash', license: 'Unsplash License' },
  'crook-county-fair': { image: '/images/events/crook-county-fair.jpg', credit: 'Đào Thân / Pexels', creditUrl: 'https://www.pexels.com/@daothan', source: 'Pexels', license: 'Pexels License' },
  'jefferson-county-fair': { image: '/images/events/jefferson-county-fair.jpg', credit: 'Xavier McLaren / Unsplash', creditUrl: 'https://unsplash.com/@xavier_mclaren1', source: 'Unsplash', license: 'Unsplash License' },
  'airshow-of-the-cascades': { image: '/images/events/airshow-of-the-cascades.jpg', credit: 'Sebastian / Unsplash', creditUrl: 'https://unsplash.com/@gsebastian', source: 'Unsplash', license: 'Unsplash License' },
  'crooked-river-roundup': { image: '/images/events/crooked-river-roundup.jpg', credit: 'Gene Devine / Unsplash', creditUrl: 'https://unsplash.com/@devine_images', source: 'Unsplash', license: 'Unsplash License' },
  'dirty-half': { image: '/images/events/dirty-half.jpg', credit: 'Vincent Tavernier / Unsplash', creditUrl: 'https://unsplash.com/@vincent_tavernier', source: 'Unsplash', license: 'Unsplash License' },
  'happy-girls-run': { image: '/images/events/happy-girls-run.jpg', credit: 'Tong Su / Unsplash', creditUrl: 'https://unsplash.com/@tongsu', source: 'Unsplash', license: 'Unsplash License' },
  'i-like-pie': { image: '/images/events/i-like-pie.jpg', credit: 'Emma Simpson / Unsplash', creditUrl: 'https://unsplash.com/@esdesignisms', source: 'Unsplash', license: 'Unsplash License' },
  'cascade-gravel-grinder': { image: '/images/events/cascade-gravel-grinder.jpg', credit: 'Munbaik Cycling Clothing / Unsplash', creditUrl: 'https://unsplash.com/@munbaik_cycling', source: 'Unsplash', license: 'Unsplash License' },
  'bend-marathon': { image: '/images/events/bend-marathon.jpg', credit: 'Miguel A Amutio / Unsplash', creditUrl: 'https://unsplash.com/@amutiomi', source: 'Unsplash', license: 'Unsplash License' },
  'music-on-the-green': { image: '/images/events/music-on-the-green.jpg', credit: 'L N / Unsplash', creditUrl: 'https://unsplash.com/@younis67', source: 'Unsplash', license: 'Unsplash License' },
  'bend-roots-revival': { image: '/images/events/bend-roots-revival.jpg', credit: 'Lukas Eggers / Unsplash', creditUrl: 'https://unsplash.com/@beschtephotography', source: 'Unsplash', license: 'Unsplash License' },
  'sisters-folk-festival': { image: '/images/events/sisters-folk-festival.jpg', credit: 'Jefferson Santos / Unsplash', creditUrl: 'https://unsplash.com/@jefflssantos', source: 'Unsplash', license: 'Unsplash License' },
  'big-ponderoo': { image: '/images/events/big-ponderoo.jpg', credit: 'Lukas Eggers / Unsplash', creditUrl: 'https://unsplash.com/@beschtephotography', source: 'Unsplash', license: 'Unsplash License' },
  'bend-comedy-festival': { image: '/images/events/bend-comedy-festival.jpg', credit: 'Matt Botsford / Unsplash', creditUrl: 'https://unsplash.com/@mattbotsford', source: 'Unsplash', license: 'Unsplash License' },
  'ballet-bend': { image: '/images/events/ballet-bend.jpg', credit: 'Ahmad Odeh / Unsplash', creditUrl: 'https://unsplash.com/@aoddeh', source: 'Unsplash', license: 'Unsplash License' },
  'nutcracker-bend': { image: '/images/events/nutcracker-bend.jpg', credit: 'Michael Afonso / Unsplash', creditUrl: 'https://unsplash.com/@mafonso', source: 'Unsplash', license: 'Unsplash License' },
  'sunriver-stars-summer-play': { image: '/images/events/sunriver-stars-summer-play.jpg', credit: 'Carlo Pentimalli / Unsplash', creditUrl: 'https://unsplash.com/@cpenti', source: 'Unsplash', license: 'Unsplash License' },
}

/**
 * Architect headshots — Wikimedia Commons (CC-BY / CC-BY-SA / Public Domain).
 *
 * Every entry MUST carry an `author`, `source`, `license`, and `licenseUrl`
 * so the LP can render an attribution line beside the portrait.
 *
 * Maintenance:
 * - Resized to max 480px JPEG q85 via `sips -Z 480`.
 * - Stored at /public/lp/central-oregon-golf/img/architects/<slug>.jpg.
 * - Re-verify licenses on Commons annually — uploaders sometimes change terms.
 *
 * Skipped (no clean CC/PD portrait available as of 2026-05-22):
 * - david-mclay-kidd      — no infobox image on Wikipedia
 * - weiskopf-morrish      — only a signature image, no portrait
 * - john-fought           — no infobox image on Wikipedia
 * - cupp-fought           — no infobox image on Wikipedia (Robert E. Cupp)
 * - robert-muir-graves    — Wikipedia uses a Fair-use / non-free image
 */

export type ArchitectPhotoLicense = 'CC-BY' | 'CC-BY-SA' | 'PD'

export interface ArchitectPhoto {
  slug: string
  /** Web-served path under /public. */
  path: string
  /** Verbatim author / uploader string from the Commons file page. */
  author: string
  /** Commons file-page URL (canonical source of the license declaration). */
  source: string
  license: ArchitectPhotoLicense
  /** Deed URL for the specific license version. */
  licenseUrl: string
  /** Optional human-readable caption to render next to the image. */
  caption?: string
}

export const ARCHITECT_PHOTOS: Record<string, ArchitectPhoto> = {
  'jack-nicklaus': {
    slug: 'jack-nicklaus',
    path: '/lp/central-oregon-golf/img/architects/jack-nicklaus.jpg',
    author: 'Moody College of Communication (Flickr, Austin, USA)',
    source:
      'https://commons.wikimedia.org/wiki/File:Jack_Nicklaus_2019_Jenkins_Medal_Awards_(cropped).jpg',
    license: 'CC-BY-SA',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
    caption: 'Nicklaus in 2019',
  },
  'tom-fazio': {
    slug: 'tom-fazio',
    path: '/lp/central-oregon-golf/img/architects/tom-fazio.jpg',
    author: 'Cem0030 (Wikimedia Commons)',
    source:
      'https://commons.wikimedia.org/wiki/File:Tom_Fazio_at_Lake_Nona_Golf_%26_Country_Club_(cropped).jpg',
    license: 'CC-BY-SA',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    caption: 'Fazio in 2015',
  },
  'robert-trent-jones-jr': {
    slug: 'robert-trent-jones-jr',
    path: '/lp/central-oregon-golf/img/architects/robert-trent-jones-jr.jpg',
    author: 'Pgjansson (Wikimedia Commons)',
    source: 'https://commons.wikimedia.org/wiki/File:Robert_Trent_Jones_Jr.jpg',
    license: 'PD',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    caption: 'Jones in 2010',
  },
  'egan-baldock': {
    slug: 'egan-baldock',
    path: '/lp/central-oregon-golf/img/architects/egan-baldock.jpg',
    author: 'Unknown (published in Outing magazine, January 1905)',
    source: 'https://commons.wikimedia.org/wiki/File:Chandler_Egan.JPG',
    license: 'PD',
    licenseUrl: 'https://en.wikipedia.org/wiki/Public_domain',
    caption: 'H. Chandler Egan, circa 1904',
  },
}

export function architectPhotoFor(slug: string): ArchitectPhoto | undefined {
  return ARCHITECT_PHOTOS[slug]
}

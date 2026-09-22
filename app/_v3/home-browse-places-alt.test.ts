import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { homePlacePhotoAlt } from './HomeBrowsePlaces'

const PLACES = readFileSync(resolve('app/_v3/HomeBrowsePlaces.tsx'), 'utf8')

/** Live Home Browse places photographed doors, 2026-09-21. */
const PHOTO_CARDS = [
  {
    label: 'Bend new homes',
    photoSrc: '/images/blog/new-construction-guide-central-oregon.jpg',
    alt: 'Bend new homes',
  },
  {
    label: 'Bend',
    photoSrc:
      'https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/asset-library/photos/grok-imagine/imagine-place-city-bend.png',
    alt: 'Bend',
  },
  {
    label: 'La Pine',
    photoSrc:
      'https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/asset-library/photos/grok-imagine/imagine-place-city-la-pine.png',
    alt: 'La Pine',
  },
  {
    label: 'Redmond',
    photoSrc:
      'https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/asset-library/photos/grok-imagine/imagine-place-city-redmond.png',
    alt: 'Redmond',
  },
  {
    label: 'Sunriver',
    photoSrc:
      'https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/asset-library/photos/grok-imagine/imagine-place-city-sunriver.png',
    alt: 'Sunriver',
  },
  {
    label: 'Sisters',
    photoSrc:
      'https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/asset-library/photos/grok-imagine/imagine-place-city-sisters.png',
    alt: 'Sisters',
  },
  {
    label: 'Terrebonne',
    photoSrc:
      'https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/asset-library/photos/grok-imagine/imagine-place-city-terrebonne.png',
    alt: 'Terrebonne',
  },
  {
    label: 'Tetherow',
    photoSrc: '/lp/tetherow/img/tetherow-aerial-course.jpg',
    alt: 'Tetherow aerial',
  },
  {
    label: 'Broken Top',
    photoSrc: '/images/communities/broken-top.jpg',
    alt: 'Broken Top',
  },
  {
    label: 'Eagle Crest',
    photoSrc: '/lp/central-oregon-golf/img/eagle-crest-01.jpg',
    alt: 'Eagle Crest',
  },
] as const

describe('homePlacePhotoAlt', () => {
  it('names all 10 photographed Home Browse places doors', () => {
    expect(PHOTO_CARDS).toHaveLength(10)
    expect(PHOTO_CARDS.map((card) => homePlacePhotoAlt(card))).toEqual(
      PHOTO_CARDS.map((card) => card.alt),
    )
  })

  it('keeps Bend new homes and Tetherow aerial as the named examples', () => {
    expect(
      homePlacePhotoAlt({
        label: 'Bend new homes',
        photoSrc: '/images/blog/new-construction-guide-central-oregon.jpg',
      }),
    ).toBe('Bend new homes')
    expect(
      homePlacePhotoAlt({
        label: 'Tetherow',
        photoSrc: '/lp/tetherow/img/tetherow-aerial-course.jpg',
      }),
    ).toBe('Tetherow aerial')
  })

  it('returns empty only when the door has no photo or no place name', () => {
    expect(homePlacePhotoAlt({ label: 'Bend', photoSrc: '' })).toBe('')
    expect(homePlacePhotoAlt({ label: '  ', photoSrc: '/x.jpg' })).toBe('')
    expect(homePlacePhotoAlt({ label: 'Bend' })).toBe('')
  })
})

describe('HomeBrowsePlaces photo alts', () => {
  it('wires place stills through homePlacePhotoAlt, never alt=""', () => {
    expect(PLACES).toMatch(/alt=\{photoAlt\}/)
    expect(PLACES).toMatch(/homePlacePhotoAlt\(door\)/)
    expect(PLACES).not.toMatch(/<img\b[^>]*\balt=""/)
    expect(PLACES).not.toMatch(/<img\b[^>]*\balt=''/)
  })
})

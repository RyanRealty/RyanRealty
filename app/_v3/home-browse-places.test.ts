import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HOME_PLACE_CARD_MEDIA_RATIO, placeDoorPhotoSrc } from './home-browse-places'

const PLACES = readFileSync(resolve('app/_v3/HomeBrowsePlaces.tsx'), 'utf8')
const CSS = readFileSync(resolve('app/_v3/home-browse-places.css'), 'utf8')
const NEW_CON = readFileSync(resolve('app/_v3/home-new-construction.ts'), 'utf8')
const PAGE = readFileSync(resolve('app/page.tsx'), 'utf8')

describe('placeDoorPhotoSrc', () => {
  it('keeps a trimmed honest URL and drops blanks', () => {
    expect(placeDoorPhotoSrc(' /images/kb/bend.jpg ')).toBe('/images/kb/bend.jpg')
    expect(placeDoorPhotoSrc('')).toBeNull()
    expect(placeDoorPhotoSrc('   ')).toBeNull()
    expect(placeDoorPhotoSrc(undefined)).toBeNull()
    expect(placeDoorPhotoSrc(null)).toBeNull()
  })
})

describe('SITE-148 Browse places one card system', () => {
  it('locks every card to a 4:3 media plate, photo or reserved', () => {
    expect(HOME_PLACE_CARD_MEDIA_RATIO).toBe('4 / 3')
    expect(CSS).toMatch(/aspect-ratio:\s*4\s*\/\s*3/)
    expect(PLACES).toMatch(/home-browse-places__media/)
    expect(PLACES).toMatch(/home-browse-places__media--reserved/)
    expect(PLACES).toMatch(/placeDoorPhotoSrc\(door\.photoSrc\)/)
    expect(PLACES).not.toMatch(/\{door\.photoSrc\?\.trim\(\) \? \(/)
  })

  it('stretches carousel and grid cards to one height', () => {
    expect(CSS).toMatch(/\.home-browse-places \[data-slot='card'\][\s\S]*height:\s*100%/)
    expect(CSS).toMatch(/\.home-browse-places \[data-slot='card-footer'\][\s\S]*margin-top:\s*auto/)
    expect(CSS).toMatch(/\.home-browse-places__slide[\s\S]*align-items:\s*stretch/)
    expect(PLACES).toMatch(/md:basis-1\/2 lg:basis-1\/3/)
    expect(CSS).toMatch(/\.home-browse-places__link[\s\S]*width:\s*100%/)
    expect(CSS).toMatch(/\.home-browse-places__link[\s\S]*height:\s*100%/)
    expect(CSS).toMatch(/\.home-browse-places \[data-slot='card'\][\s\S]*width:\s*100%/)
    expect(CSS).toMatch(/\.home-browse-places__count-slot[\s\S]*min-height:/)
    expect(PLACES).toMatch(/home-browse-places__slide-inner/)
    expect(PLACES).toMatch(/home-browse-places__count-slot/)
    expect(CSS).toMatch(/padding-top:\s*75%/)
    expect(CSS).toMatch(/\.home-browse-places__media-name[\s\S]*position:\s*absolute/)
  })

  it('reserves navy text-only media, never an empty gray box', () => {
    expect(CSS).toMatch(/\.home-browse-places__media--reserved[\s\S]*background:\s*var\(--v3-navy\)/)
    expect(CSS).toMatch(/\.home-browse-places__media-name[\s\S]*font-family:\s*var\(--v3-font-display\)/)
    expect(CSS).not.toMatch(/background:\s*#/)
  })

  it('keeps catalog Card + Carousel + AnimatedNumber imports', () => {
    expect(PLACES).toMatch(/from '@\/components\/ui\/card'/)
    expect(PLACES).toMatch(/from '@\/components\/ui\/carousel'/)
    expect(PLACES).toMatch(/from '@\/components\/motion\/number'/)
  })

  it('does not drop a home-rail door that has no photo', () => {
    expect(PAGE).not.toMatch(/if \(!photoSrc\) return \[\]/)
    expect(PAGE).toMatch(/RESORT_DOORS\.map\(\(r\) =>/)
    expect(NEW_CON).toMatch(/preferPlaceHeroOrNull\(null, communityImage\(slugify\(name\)\)\)/)
    expect(NEW_CON).toMatch(/BEND_NEW_CON_STAGE_FALLBACK_POSTER/)
  })
})

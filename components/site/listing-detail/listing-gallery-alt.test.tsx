import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ListingHero } from './ListingHero'
import { listingGalleryFrameAlt } from '@/components/site/v3/listing-photo-alt'

const HERO = readFileSync(resolve('components/site/listing-detail/ListingHero.tsx'), 'utf8')
const LIGHTBOX = readFileSync(
  resolve('components/site/listing-detail/PhotoGalleryLightbox.tsx'),
  'utf8',
)

const ADDRESS = '2750 NE Great Horned Place'
const TOTAL = 54

function countEmptyAlts(html: string): number {
  const tags = html.match(/<img\b[^>]*>/gi) ?? []
  return tags.filter(
    (tag) => /alt\s*=\s*(""|'')/.test(tag) || !/\balt\s*=/.test(tag),
  ).length
}

describe('listing gallery frame alts', () => {
  it('routes every hero and lightbox still through listingGalleryFrameAlt', () => {
    expect(HERO).toMatch(/listingGalleryFrameAlt/)
    expect(HERO).not.toMatch(/alt=""/)
    expect(LIGHTBOX).toMatch(/listingGalleryFrameAlt/)
    expect(LIGHTBOX).not.toMatch(/p\.caption \?\?/)
  })

  it('SSRs address + ordinal on every filmstrip thumb (the 54 empty-alt frames)', () => {
    const photos = Array.from({ length: TOTAL }, (_, i) => ({
      url: `https://cdn.resize.sparkplatform.com/ore/1600x1200/true/demo-${i}.jpg`,
      caption: null,
      order: i,
    }))
    const html = renderToStaticMarkup(
      createElement(ListingHero, {
        photos,
        videos: [],
        addressLine: ADDRESS,
        lcpPriority: false,
      }),
    )
    expect(html).toContain('listing-strip__thumb')
    expect(countEmptyAlts(html)).toBe(0)
    expect(html).toContain(`alt="${listingGalleryFrameAlt({ addressLine: ADDRESS, ordinal: 1, total: TOTAL })}"`)
    expect(html).toContain(`alt="${listingGalleryFrameAlt({ addressLine: ADDRESS, ordinal: TOTAL, total: TOTAL })}"`)
    expect((html.match(/listing-strip__thumb/g) ?? []).length).toBe(TOTAL)
  })
})

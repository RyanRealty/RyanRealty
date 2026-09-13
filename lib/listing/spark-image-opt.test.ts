import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
}

/** Listing photo surfaces that used to send Spark plates through `/_next/image`. */
const SPARK_PHOTO_SURFACES = [
  'components/site/v3/SplitCardMedia.tsx',
  'components/ListingTile.tsx',
  'components/site/ListingCard.tsx',
  'components/site/VideoListingCard.tsx',
  'components/site/v3/V3ListingRow.tsx',
  'components/site/listing-detail/ListingHero.tsx',
  'components/site/listing-detail/PhotoGalleryLightbox.tsx',
] as const

describe('Spark listing photos bypass Vercel Image Optimization', () => {
  it('raises minimumCacheTTL and drops quality 90 from the allowlist', () => {
    const src = read('next.config.ts')
    expect(src).toMatch(/minimumCacheTTL:\s*2_?678_?400/)
    expect(src).not.toMatch(/qualities:\s*\[75,\s*90\]/)
    expect(src).not.toMatch(/quality=\{90\}/)
  })

  it.each(SPARK_PHOTO_SURFACES)(
    '%s does not wrap Spark listing photos in a bare next/image',
    (rel) => {
      const src = read(rel)
      const usesSafeWrapper = src.includes('SparkSafeImage')
      const usesRawImg = /<img[\s\S]{0,200}(?:listingRowPhotoSrc|photoUrl|preferListingMosaicPhotoUrl)/.test(
        src,
      )
      const bareImage = /<Image\b[\s\S]{0,400}(?:listingRowPhotoSrc|photoUrl|primaryPhoto|preferListingMosaicPhotoUrl)/.test(
        src,
      )
      const bareImageHasUnoptimized =
        /<Image\b[\s\S]{0,400}unoptimized[\s\S]{0,200}(?:listingRowPhotoSrc|photoUrl|primaryPhoto|preferListingMosaicPhotoUrl)|<Image\b[\s\S]{0,200}(?:listingRowPhotoSrc|photoUrl|primaryPhoto|preferListingMosaicPhotoUrl)[\s\S]{0,400}unoptimized/.test(
          src,
        )
      expect(usesSafeWrapper || usesRawImg || (bareImage && bareImageHasUnoptimized)).toBe(
        true,
      )
      if (bareImage) expect(bareImageHasUnoptimized).toBe(true)
    },
  )
})

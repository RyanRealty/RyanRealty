import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
}

/** Every module that imports next/image. Site-wide unoptimized covers them all. */
const NEXT_IMAGE_SURFACES = [
  'lib/listing/SparkSafeImage.tsx',
  'components/dashboard/DashboardShell.tsx',
  'components/site/golf/GolfCommunityCards.tsx',
  'app/account/page.tsx',
  'app/account/collections/page.tsx',
  'components/site/listing-detail/TextMattCTA.tsx',
  'components/site/SiteFooter.tsx',
  'components/site/HeroBlock.tsx',
  'components/site/primitives/Logo.tsx',
  'components/legal/MlsSourceBadge.tsx',
  'components/listing/ListingAttribution.tsx',
  'components/landing/LeadLandingPage.tsx',
  'app/blog/[slug]/page.tsx',
  'components/reports/SalesReportCard.tsx',
  'components/ListingTile.tsx',
  'app/admin/(protected)/site-pages/SiteLogoForm.tsx',
  'app/admin/(protected)/site-pages/TeamImageForm.tsx',
  'app/housing-market/reports/[slug]/page.tsx',
  'app/admin/(protected)/dscr/_components/DscrScreen.client.tsx',
  'app/admin/(protected)/listings/page.tsx',
  'app/cities/[slug]/types/[type]/_v3/PlaceTypeFilm.client.tsx',
  'app/admin/(protected)/approval-queue/_components/MediaPreview.tsx',
] as const

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

describe('Vercel Image Optimization is disabled site-wide', () => {
  it('sets images.unoptimized so no next/image goes through /_next/image (Matt 2026-09-13)', async () => {
    const src = read('next.config.ts')
    expect(src).toMatch(/images:\s*\{[\s\S]*?\bunoptimized:\s*true\b/)
    expect(src).not.toMatch(/\bunoptimized:\s*false\b/)

    const { default: nextConfig } = await import('../../next.config')
    expect(nextConfig.images?.unoptimized).toBe(true)
    expect(nextConfig.images?.loader).toBeUndefined()
    expect(nextConfig.images?.path).toBeUndefined()
  })

  it('does not force optimized /_next/image via unoptimized={false} or a custom loader', () => {
    const src = read('next.config.ts')
    expect(src).not.toMatch(/unoptimized=\{\s*false\s*\}/)
    expect(src).not.toMatch(/loader:\s*['"]custom['"]/)
    expect(src).not.toMatch(/\bloaderFile:/)

    for (const rel of NEXT_IMAGE_SURFACES) {
      expect(read(rel), rel).not.toMatch(/unoptimized=\{\s*false\s*\}/)
    }
  })

  it('keeps minimumCacheTTL and does not re-expand the quality allowlist', () => {
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

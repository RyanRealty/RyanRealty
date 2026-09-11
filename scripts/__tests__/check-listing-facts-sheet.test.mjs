import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const GATE = join(process.cwd(), 'scripts/check-listing-facts-sheet.mjs')

const SPECS = 'components/site/listing-detail/PropertySpecs.tsx'
const HERO = 'components/site/listing-detail/ListingHero.tsx'
const LIGHTBOX = 'components/site/listing-detail/PhotoGalleryLightbox.tsx'
const PAGE = 'app/listing/[listingKey]/page.tsx'
const ROW = 'lib/listing/row-photo.ts'
const MOSAIC = 'lib/listing/publish-listing-mosaic.ts'

const SPECS_OK = `export function PropertySpecs({ listing }) {
  return <>Bedrooms {listing.beds} Bathrooms {listing.baths} Living area {listing.sqft} Garage
  {publishListingHoa()} <Price value={hoa.monthly} exact /></>
}`
const HERO_OK = 'const live = preferListingMosaicPhotoUrl(src)'
const LIGHTBOX_OK = 'src={preferListingMosaicPhotoUrl(current.url)}'
const PAGE_OK = `LISTING_MOSAIC_LEAD_PHOTO_SIZE
LISTING_FIELD_LEAD_PHOTO_SIZE
preferListingMosaicPhotoUrl`
const ROW_OK = "export const LISTING_MOSAIC_LEAD_PHOTO_SIZE = '1600x1200'"
const MOSAIC_OK = 'export function preferListingMosaicPhotoUrl() {}'

function tree(files) {
  const dir = mkdtempSync(join(tmpdir(), 'facts-gate-'))
  for (const [path, body] of Object.entries(files)) {
    if (body == null) continue
    const full = join(dir, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, body)
  }
  cpSync(GATE, join(dir, 'gate.mjs'))
  return dir
}

function run(files) {
  const dir = tree(files)
  try {
    execFileSync('node', [join(dir, 'gate.mjs')], { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
    return { ok: true, out: '' }
  } catch (err) {
    return { ok: false, out: String(err.stdout ?? '') + String(err.stderr ?? '') }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const V3_ROW = 'components/site/v3/V3ListingRow.tsx'
const SPLIT_MEDIA = 'components/site/v3/SplitCardMedia.tsx'
const SPLIT_CARD = 'components/search/SplitListingCard.tsx'
const LISTING_CARD = 'components/site/ListingCard.tsx'
const VIDEO_CARD = 'components/site/VideoListingCard.tsx'

const SHIPPING = {
  [SPECS]: SPECS_OK,
  [HERO]: HERO_OK,
  [LIGHTBOX]: LIGHTBOX_OK,
  [PAGE]: PAGE_OK,
  [ROW]: ROW_OK,
  [MOSAIC]: MOSAIC_OK,
  [V3_ROW]: 'className="v3-lrow__photo-link" href={listing.href}',
  [SPLIT_MEDIA]: 'href?: string\nv3-lrow__photo-link',
  [SPLIT_CARD]: '<SplitCardMedia\n        href={href}',
  [LISTING_CARD]: '<Link href={listing.href}',
  [VIDEO_CARD]: 'href={listing.href}',
}

describe('ci:listing-facts-sheet', () => {
  it('passes on the shape that ships', () => {
    expect(run(SHIPPING).ok).toBe(true)
  })

  it('FAILS when PropertySpecs drops beds', () => {
    const r = run({ ...SHIPPING, [SPECS]: 'export function PropertySpecs() { return <p>type · lot</p> }' })
    expect(r.ok).toBe(false)
    expect(r.out).toMatch(/listing\.beds|Bedrooms/)
  })

  it('FAILS when MosaicStill skips preferListingMosaicPhotoUrl', () => {
    const r = run({ ...SHIPPING, [HERO]: 'src={src}' })
    expect(r.ok).toBe(false)
    expect(r.out).toMatch(/preferListingMosaicPhotoUrl/)
  })

  it('FAILS when the page never locks to 1600', () => {
    const r = run({
      ...SHIPPING,
      [PAGE]: 'LISTING_FIELD_LEAD_PHOTO_SIZE\npreferListingMosaicPhotoUrl',
    })
    expect(r.ok).toBe(false)
    expect(r.out).toMatch(/LISTING_MOSAIC_LEAD_PHOTO_SIZE/)
  })
})

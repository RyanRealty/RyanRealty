import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const SRC = readFileSync(join(ROOT, 'components/site/v3/V3Breadcrumb.tsx'), 'utf8')
const CSS = readFileSync(join(ROOT, 'components/site/v3/V3Breadcrumb.css'), 'utf8')
const UI = readFileSync(join(ROOT, 'components/ui/breadcrumb.tsx'), 'utf8')
const COLLAPSE = readFileSync(
  join(ROOT, 'components/site/v3/V3BreadcrumbCollapse.client.tsx'),
  'utf8',
)
const PAGE = readFileSync(join(ROOT, 'app/listing/[listingKey]/page.tsx'), 'utf8')
const LISTING_CSS = readFileSync(
  join(ROOT, 'components/site/listing-detail/listing-detail.css'),
  'utf8',
)

describe('V3Breadcrumb collapse + listing fold density', () => {
  it('imports the installed shadcn breadcrumb and collapses long trails', () => {
    expect(SRC).toMatch(/from '@\/components\/ui\/breadcrumb'/)
    expect(SRC).toContain('V3BreadcrumbCollapse')
    expect(SRC).toContain('rungs.length >= 3')
    expect(SRC).toContain('overlayCompact')
    expect(SRC).toContain('showFullOverlayPath')
    expect(SRC).not.toMatch(/overlayCompact \? null/)
    expect(SRC).toContain('overlay')
    expect(COLLAPSE).toMatch(/from '@\/components\/ui\/breadcrumb'/)
    expect(COLLAPSE).toContain('BreadcrumbEllipsis')
    expect(COLLAPSE).toMatch(/from '@\/components\/ui\/dropdown-menu'/)
    expect(UI).toContain('data-slot="breadcrumb"')
    expect(UI).toContain('BreadcrumbEllipsis')
  })

  it('keeps the trail one line and overlays listing crumbs on the mosaic', () => {
    expect(CSS).toMatch(/flex-wrap:\s*nowrap/)
    expect(CSS).toMatch(/\.v3\.v3-breadcrumb--overlay-compact[\s\S]{0,200}overflow-x:\s*auto/)
    expect(CSS).toContain('v3-breadcrumb--overlay')
    expect(SRC).toContain('v3-breadcrumb--collapsed')
    expect(CSS).toMatch(/\.v3\.v3-breadcrumb--below-nav\s*\{[^}]*padding-top:\s*var\(--v3-space-2xs\)/)
    expect(PAGE).toMatch(/<V3Breadcrumb trail=\{breadcrumbs\} tone="on-media" overlay \/>/)
    expect(PAGE).not.toMatch(/V3Chrome/)
  })

  it('paints the listing photo well navy and keeps thumbs at tap height', () => {
    expect(LISTING_CSS).toMatch(/\.listing-mosaic\s*\{[^}]*background:\s*var\(--v3-navy\)/)
    expect(LISTING_CSS).toMatch(/\.listing-frame__media\s*\{[^}]*background:\s*var\(--v3-navy\)/)
    expect(LISTING_CSS).toMatch(/--listing-strip-thumb:\s*2\.75rem/)
    expect(LISTING_CSS).toMatch(/--v3-mosaic-h:\s*min\(calc\(100dvh/)
    expect(LISTING_CSS).toMatch(/\.listing-strip\s*\{[^}]*background:\s*var\(--v3-navy\)/)
    expect(LISTING_CSS).toMatch(/\.listing-mosaic__slide img\s*\{[\s\S]*?object-fit:\s*contain/)
    expect(LISTING_CSS).not.toMatch(
      /\.listing-mosaic__slide img,\s*\n\.listing-mosaic__slide video[\s\S]{0,120}object-fit:\s*cover/,
    )
  })
})

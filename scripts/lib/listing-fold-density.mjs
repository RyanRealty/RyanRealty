/**
 * listing-fold-density.mjs — lock the listing fold + shared breadcrumb densify.
 *
 * Matt 2026-09-17 P0: cream around mosaic/thumbs and a wrapping Bend / … /
 * address band. Collapse + overlay + navy well are the house answer. A later
 * rebuild that puts md padding back on the crumb, unwraps the trail, or paints
 * the photo well cream is a loop defect — Tip Ready --ship and
 * `ci:listing-fold-density` refuse it.
 *
 * Not a new rubric. Source-scan of the sitewide primitive + listing hero CSS.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const LISTING_FOLD_DENSITY_GATE = 'ci:listing-fold-density'
export const LISTING_FOLD_DENSITY_SCRIPT = 'scripts/check-listing-fold-density.mjs'

export const FOLD_LOCK = Object.freeze({
  lockedAt: '2026-09-18',
  crumbCollapseAt: 3,
  crumbBelowNavPadToken: '--v3-space-2xs',
  crumbOverlayOnListing: true,
  overlayCompactOnListing: false,
  maxCrumbBandPx: 44,
  stripThumbRem: 2.75,
  mosaicWell: 'navy',
  stripWell: 'navy',
  mosaicHeightUsesViewport: true,
  shellPadTopToken: '--v3-space-xs',
  gate: LISTING_FOLD_DENSITY_GATE,
})

const PATHS = Object.freeze({
  breadcrumbTsx: 'components/site/v3/V3Breadcrumb.tsx',
  breadcrumbCss: 'components/site/v3/V3Breadcrumb.css',
  collapse: 'components/site/v3/V3BreadcrumbCollapse.client.tsx',
  page: 'app/listing/[listingKey]/page.tsx',
  listingCss: 'components/site/listing-detail/listing-detail.css',
  parity: 'design_system/ryan-realty/ui_kits/listing-detail/parity.json',
  cityPage: 'app/cities/[slug]/page.tsx',
  communityPage: 'app/communities/[slug]/page.tsx',
  neighborhoodPage: 'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
  subdivisionPage: 'app/subdivisions/[slug]/page.tsx',
  communityStage: 'app/communities/[slug]/_v3/CommunityStage.tsx',
  placeOpeningCss: 'components/place/place-opening.css',
})

const PLACE_TEMPLATE_PAGES = Object.freeze([
  PATHS.cityPage,
  PATHS.communityPage,
  PATHS.neighborhoodPage,
  PATHS.subdivisionPage,
])

const TALL_PAD_RE =
  /padding-top\s*:\s*(?:var\(--v3-space-(?:sm|md|lg|xl|2xl|3xl)\)|76px|4\.75rem|[1-9]\d*(?:\.\d+)?rem)/
const TALL_BLOCK_PAD_RE =
  /padding\s*:\s*(?:var\(--v3-space-(?:sm|md|lg|xl|2xl|3xl)\)|[1-9]\d*(?:\.\d+)?rem)/

function readRel(root, rel, override) {
  if (typeof override === 'string') return override
  const abs = join(root, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null
}

function cssBlocks(src, selector) {
  if (!src) return []
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g')
  return [...src.matchAll(re)].map((m) => m[1])
}

function cssBlock(src, selector) {
  return cssBlocks(src, selector)[0] ?? null
}

function hasNavyWell(src, selector) {
  const blocks = cssBlocks(src, selector)
  if (blocks.length === 0) return false
  const navy = blocks.some((b) => /background\s*:\s*var\(--v3-navy\)/.test(b))
  const cream = blocks.some((b) => /background\s*:\s*var\(--v3-cream\)/.test(b))
  return navy && !cream
}

export function breadcrumbFoldDensityProblems({ root = process.cwd(), files = {} } = {}) {
  const p = []
  const tsx = readRel(root, PATHS.breadcrumbTsx, files.breadcrumbTsx)
  const css = readRel(root, PATHS.breadcrumbCss, files.breadcrumbCss)
  const collapse = readRel(root, PATHS.collapse, files.collapse)

  if (tsx == null) {
    p.push(`${PATHS.breadcrumbTsx}: missing — shared crumb primitive is gone.`)
    return p
  }
  if (!/from '@\/components\/ui\/breadcrumb'/.test(tsx)) {
    p.push(`${PATHS.breadcrumbTsx}: must import shadcn Breadcrumb. Oversized house crumb is refuse.`)
  }
  if (!tsx.includes('V3BreadcrumbCollapse')) {
    p.push(`${PATHS.breadcrumbTsx}: collapse default is required (first / … / last).`)
  }
  if (!/rungs\.length\s*>=\s*3/.test(tsx)) {
    p.push(
      `${PATHS.breadcrumbTsx}: collapse must default at ${FOLD_LOCK.crumbCollapseAt}+ crumbs. A taller trail is an oversized crumb band.`,
    )
  }
  if (tsx.includes('overlayCompact')) {
    p.push(
      `${PATHS.breadcrumbTsx}: overlayCompact is refuse. One V3Breadcrumb behavior: first / … / current on place and listing.`,
    )
  }
  if (!/rungs\.slice\(\s*1\s*,\s*lastIndex\s*\)/.test(tsx)) {
    p.push(
      `${PATHS.breadcrumbTsx}: collapse must keep the first ancestor (first / … / current). Hiding Bend on listing overlay is refuse.`,
    )
  }
  if (!tsx.includes('overlay')) {
    p.push(`${PATHS.breadcrumbTsx}: overlay prop missing — listing trails cannot sit on the mosaic.`)
  }
  if (!tsx.includes('v3-breadcrumb--collapsed')) {
    p.push(`${PATHS.breadcrumbTsx}: collapsed class missing.`)
  }
  if (collapse == null) {
    p.push(`${PATHS.collapse}: missing — long trails have no disclosure.`)
  }

  if (css == null) {
    p.push(`${PATHS.breadcrumbCss}: missing.`)
    return p
  }
  if (!/flex-wrap:\s*nowrap/.test(css)) {
    p.push(`${PATHS.breadcrumbCss}: list must nowrap. Wrapping Bend / … / address is a tall crumb band.`)
  }
  const below = cssBlock(css, '.v3.v3-breadcrumb--below-nav')
  if (!below) {
    p.push(`${PATHS.breadcrumbCss}: .v3.v3-breadcrumb--below-nav missing.`)
  } else {
    if (!new RegExp(`padding-top:\\s*var\\(${FOLD_LOCK.crumbBelowNavPadToken}\\)`).test(below)) {
      p.push(
        `${PATHS.breadcrumbCss}: below-nav pad must be var(${FOLD_LOCK.crumbBelowNavPadToken}). md/lg/76px clearance is tall quiet.`,
      )
    }
    if (TALL_PAD_RE.test(below) || TALL_BLOCK_PAD_RE.test(below)) {
      p.push(`${PATHS.breadcrumbCss}: below-nav reintroduced tall quiet (sm+ / rem≥1 / 76px).`)
    }
  }
  const overlay = cssBlock(css, '.v3.v3-breadcrumb--overlay')
  if (!overlay) {
    p.push(`${PATHS.breadcrumbCss}: overlay modifier missing.`)
  } else if (TALL_PAD_RE.test(overlay)) {
    p.push(`${PATHS.breadcrumbCss}: overlay crumb must not grow a cream band (max ${FOLD_LOCK.maxCrumbBandPx}px tap).`)
  }
  if (!/linear-gradient\(/.test(css) || !/v3-breadcrumb--on-media\.v3-breadcrumb--overlay/.test(css)) {
    p.push(
      `${PATHS.breadcrumbCss}: overlay on-media crumb must be a gradient wash, not a solid navy/cream bar on the photograph.`,
    )
  }
  return p
}

export function listingHeroFoldDensityProblems({ root = process.cwd(), files = {} } = {}) {
  const p = []
  const page = readRel(root, PATHS.page, files.page)
  const css = readRel(root, PATHS.listingCss, files.listingCss)
  const parityRaw = readRel(root, PATHS.parity, files.parity)

  if (page == null) {
    p.push(`${PATHS.page}: missing.`)
  } else {
    if (!/<V3Breadcrumb trail=\{breadcrumbs\} tone="on-media" overlay \/>/.test(page)) {
      p.push(
        `${PATHS.page}: listing crumb must be tone="on-media" overlay — a flow crumb band burns cream above the mosaic.`,
      )
    }
    if (/<V3Quiet/.test(page) && page.indexOf('<V3Quiet') < page.indexOf('<ListingDetailShell')) {
      p.push(`${PATHS.page}: V3Quiet before the listing shell is tall quiet on the fold.`)
    }
    if (/\bV3Chrome\b/.test(page)) {
      p.push(`${PATHS.page}: do not remount V3Chrome on the listing route.`)
    }
  }

  if (css == null) {
    p.push(`${PATHS.listingCss}: missing.`)
  } else {
    for (const sel of ['.listing-mosaic', '.listing-mosaic__slide', '.listing-hero-bleed', '.listing-frame__media']) {
      if (!hasNavyWell(css, sel)) {
        p.push(`${PATHS.listingCss}: ${sel} well must be navy, not cream. Hero cream bloat is refuse.`)
      }
    }
    const strip = cssBlock(css, '.listing-strip')
    if (!strip) {
      p.push(`${PATHS.listingCss}: .listing-strip missing.`)
    } else {
      const thumb = strip.match(/--listing-strip-thumb:\s*([\d.]+)rem/)
      const h = strip.match(/--listing-strip-h:\s*([\d.]+)rem/)
      const thumbN = thumb ? Number(thumb[1]) : NaN
      const hN = h ? Number(h[1]) : NaN
      if (!(thumbN <= FOLD_LOCK.stripThumbRem) || !(hN <= FOLD_LOCK.stripThumbRem)) {
        p.push(
          `${PATHS.listingCss}: strip thumb/height locked at ${FOLD_LOCK.stripThumbRem}rem (tap). Taller thumbs are cream bloat.`,
        )
      }
      if (!/padding:\s*0/.test(strip) || TALL_BLOCK_PAD_RE.test(strip)) {
        p.push(`${PATHS.listingCss}: .listing-strip padding must stay 0. Extra cream around thumbs is refuse.`)
      }
      if (!/background\s*:\s*var\(--v3-navy\)/.test(strip) || /background\s*:\s*var\(--v3-cream\)/.test(strip)) {
        p.push(`${PATHS.listingCss}: .listing-strip well must be navy. A cream filmstrip under the mosaic is refuse.`)
      }
    }
    if (
      !/--v3-mosaic-h:\s*min\(calc\(100dvh/.test(css) ||
      !/--v3-carousel-h:\s*min\(62dvh/.test(css)
    ) {
      p.push(
        `${PATHS.listingCss}: listing mosaic/carousel height must use the viewport (100dvh / 62dvh), not the short 28.75rem token. A postage-stamp aerial in navy gutters is refuse.`,
      )
    }
    const slides = cssBlocks(css, '.listing-mosaic__slide')
    const slideHasZero = slides.some((b) => /padding:\s*0/.test(b))
    const slideHasTall = slides.some((b) => TALL_PAD_RE.test(b) || TALL_BLOCK_PAD_RE.test(b))
    if (!slideHasZero || slideHasTall) {
      p.push(`${PATHS.listingCss}: mosaic slide padding must stay 0. Extra cream around the photo is refuse.`)
    }
    const shell = cssBlock(css, '.listing-detail-shell')
    if (!shell || !new RegExp(`padding:\\s*var\\(${FOLD_LOCK.shellPadTopToken}\\)`).test(shell)) {
      p.push(
        `${PATHS.listingCss}: .listing-detail-shell top pad must be var(${FOLD_LOCK.shellPadTopToken}), not md/lg.`,
      )
    }
    if (/\.listing-hero-bleed\s*\{[^}]*padding-top\s*:\s*var\(--v3-space-(?:md|lg|xl)/.test(css)) {
      p.push(`${PATHS.listingCss}: listing-hero-bleed must not grow vertical cream.`)
    }
  }

  if (parityRaw == null) {
    p.push(`${PATHS.parity}: missing foldDensity contract.`)
  } else {
    let parity
    try {
      parity = JSON.parse(parityRaw)
    } catch {
      p.push(`${PATHS.parity}: invalid JSON.`)
      return p
    }
    const lock = parity?.foldDensity
    if (!lock || typeof lock !== 'object') {
      p.push(`${PATHS.parity}: foldDensity contract missing. Listing fold densify is not optional.`)
    } else {
      if (lock.gate !== FOLD_LOCK.gate) {
        p.push(`${PATHS.parity}: foldDensity.gate must be ${FOLD_LOCK.gate}.`)
      }
      if (lock.crumbCollapseAt !== FOLD_LOCK.crumbCollapseAt) {
        p.push(`${PATHS.parity}: foldDensity.crumbCollapseAt must stay ${FOLD_LOCK.crumbCollapseAt}.`)
      }
      if (lock.maxCrumbBandPx !== FOLD_LOCK.maxCrumbBandPx) {
        p.push(`${PATHS.parity}: foldDensity.maxCrumbBandPx must stay ${FOLD_LOCK.maxCrumbBandPx}.`)
      }
      if (lock.stripThumbRem !== FOLD_LOCK.stripThumbRem) {
        p.push(`${PATHS.parity}: foldDensity.stripThumbRem must stay ${FOLD_LOCK.stripThumbRem}.`)
      }
      if (lock.mosaicWell !== FOLD_LOCK.mosaicWell) {
        p.push(`${PATHS.parity}: foldDensity.mosaicWell must stay ${FOLD_LOCK.mosaicWell}.`)
      }
      if (lock.crumbOverlayOnListing !== true) {
        p.push(`${PATHS.parity}: foldDensity.crumbOverlayOnListing must stay true.`)
      }
      if (lock.overlayCompactOnListing !== false) {
        p.push(`${PATHS.parity}: foldDensity.overlayCompactOnListing must stay false — one crumb behavior.`)
      }
      if (lock.mosaicHeightUsesViewport !== true) {
        p.push(`${PATHS.parity}: foldDensity.mosaicHeightUsesViewport must stay true.`)
      }
      if (lock.stripWell !== FOLD_LOCK.stripWell) {
        p.push(`${PATHS.parity}: foldDensity.stripWell must stay ${FOLD_LOCK.stripWell}.`)
      }
    }
  }
  return p
}

/**
 * SITE-130 + Matt LOCK 2026-09-18: place hero/crumb whitespace after listing
 * densify. Overlay on the photograph. Copy pad is the 44px tap strip, not
 * xl/3xl cream. One V3Breadcrumb, one overlay contract, on every place grain.
 */
export function placeHeroFoldDensityProblems({ root = process.cwd(), files = {} } = {}) {
  const p = []
  for (const rel of PLACE_TEMPLATE_PAGES) {
    const key = rel
    const src = readRel(root, rel, files[key] ?? files[rel.split('/').at(-2) + 'Page'])
    if (src == null) {
      p.push(`${rel}: missing place template.`)
      continue
    }
    if (!src.includes('overlay={Boolean(stagePosterSrc)}')) {
      p.push(`${rel}: place crumb must overlay the photograph (overlay={Boolean(stagePosterSrc)}). A flow band is cream bloat.`)
    }
    if (!/tone=\{stagePosterSrc \? 'on-media' : 'surface'\}/.test(src)) {
      p.push(`${rel}: place crumb tone must follow the still (on-media overlay / surface when there is no photo).`)
    }
    if (!/<V3Breadcrumb/.test(src)) {
      p.push(`${rel}: must mount V3Breadcrumb — sitewide crumb is one component.`)
    }
    if (/heading=\{[^}]*Subdivisions in/.test(src) || /heading=\{[^}]*Neighborhoods in/.test(src)) {
      p.push(`${rel}: "Subdivisions in …" / "Neighborhoods in …" list heading is refuse. Name-only child cards.`)
    }
  }

  const stage = readRel(root, PATHS.communityStage, files.communityStage)
  if (stage == null) {
    p.push(`${PATHS.communityStage}: missing.`)
  } else if (!/overlay=\{Boolean\(props\.posterSrc\)\}/.test(stage)) {
    p.push(`${PATHS.communityStage}: Stage crumb must overlay the poster. Same V3Breadcrumb contract as the four place templates.`)
  }

  const css = readRel(root, PATHS.placeOpeningCss, files.placeOpeningCss)
  if (css == null) {
    p.push(`${PATHS.placeOpeningCss}: missing.`)
  } else {
    if (!/\.place-opening--media \.v3-breadcrumb \{[\s\S]*?position:\s*absolute/.test(css)) {
      p.push(`${PATHS.placeOpeningCss}: on-media crumb must sit on the photograph (position:absolute), not a cream band.`)
    }
    const mediaCopy = cssBlock(css, '.place-opening--media .place-opening__copy')
    if (!mediaCopy) {
      p.push(`${PATHS.placeOpeningCss}: .place-opening--media .place-opening__copy missing.`)
    } else if (
      /--v3-space-(?:xl|2xl|3xl)/.test(mediaCopy) ||
      TALL_PAD_RE.test(mediaCopy) ||
      TALL_BLOCK_PAD_RE.test(mediaCopy)
    ) {
      p.push(
        `${PATHS.placeOpeningCss}: media copy pad must clear the 44px overlay crumb (tap + 2xs), not xl/3xl cream.`,
      )
    }
    if (!/padding:\s*calc\(var\(--v3-tap\) \+ var\(--v3-space-2xs\)\)/.test(css)) {
      p.push(`${PATHS.placeOpeningCss}: media copy must use tap + 2xs after densify. Larger cream is refuse.`)
    }
  }
  return p
}

export function listingFoldDensityProblems(opts = {}) {
  const includeHero = opts.includeHero !== false
  const includePlace = opts.includePlace !== false
  const p = breadcrumbFoldDensityProblems(opts)
  if (includeHero) p.push(...listingHeroFoldDensityProblems(opts))
  if (includePlace) p.push(...placeHeroFoldDensityProblems(opts))
  return p
}

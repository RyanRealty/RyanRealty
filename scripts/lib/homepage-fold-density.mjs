/**
 * homepage-fold-density.mjs — lock SITE-125 so the first house-rail photos
 * peek onto the 1440×900 fold, not only the rail heading.
 *
 * Look rematch on 0c040ca14: #guides denser, peer Buy/Sell/Market, heading
 * bottom at y≈894 (in fold) but first card photos at y≈912 (12px under 900).
 * Wrapper `.home-rails` still carried --v3-space-xl (36px) on top of the
 * first-child sm pad. Heading-in-fold / photos-below is refuse.
 *
 * Source-scan, wired through ci:aeo-hub-guides (homepage guides gate).
 * Not a new rubric / taste-path field.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const HOMEPAGE_FOLD_DENSITY_GATE = 'ci:aeo-hub-guides'

export const HOME_FOLD_LOCK = Object.freeze({
  lockedAt: '2026-09-19',
  viewport: '1440x900',
  maxFirstPhotoTopPx: 880,
  railsWrapperPadTop: '0',
  firstRailPadTopToken: '--v3-space-2xs',
  firstRailHeadPadBottomToken: '--v3-space-2xs',
  stripPadToken: '--v3-space-2xs',
  stripHeadingSizeToken: '--v3-size-body-lg',
  stripDoorSizeToken: '--v3-size-body-sm',
  peerDoorColumns: 3,
  gate: HOMEPAGE_FOLD_DENSITY_GATE,
})

const PATHS = Object.freeze({
  railsCss: 'app/_v3/home-homes-rails.css',
  answersCss: 'components/site/v3/V3Answers.css',
  page: 'app/page.tsx',
  layout: 'app/layout.tsx',
})

const TALL_SPACE = '(?:sm|md|lg|xl|2xl|3xl)'

function readRel(root, rel, override) {
  if (typeof override === 'string') return override
  const abs = join(root, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null
}

function cssBlocks(src, selector) {
  if (!src) return []
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(?:^|[\\n,])\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g')
  return [...src.matchAll(re)].map((m) => m[1])
}

function lastCssBlock(src, selector) {
  const blocks = cssBlocks(src, selector)
  return blocks[blocks.length - 1] ?? null
}

export function homepageFoldDensityProblems({ root = process.cwd(), files = {} } = {}) {
  const p = []
  const rails = readRel(root, PATHS.railsCss, files.railsCss)
  const answers = readRel(root, PATHS.answersCss, files.answersCss)
  const page = readRel(root, PATHS.page, files.page)
  const layout = readRel(root, PATHS.layout, files.layout)

  if (page == null) {
    p.push(`${PATHS.page}: missing homepage.`)
  } else {
    if (!page.includes('id="guides"') || !page.includes('layout="strip"')) {
      p.push(`${PATHS.page}: #guides must stay V3Answers layout="strip" above the rails.`)
    }
    const guidesAt = page.indexOf('id="guides"')
    const railsAt = page.indexOf('<HomeHomesRails')
    if (guidesAt < 0 || railsAt < 0 || railsAt < guidesAt) {
      p.push(`${PATHS.page}: HomeHomesRails must follow #guides so house photos sit under the strip.`)
    }
    if (page.includes('V3PhoneDock')) {
      p.push(`${PATHS.page}: do not remount V3PhoneDock. Sticky Call/Text is refuse.`)
    }
  }

  if (layout != null && layout.includes('V3PhoneDock')) {
    p.push(`${PATHS.layout}: do not remount V3PhoneDock. Sticky Call/Text is refuse.`)
  }

  if (rails == null) {
    p.push(`${PATHS.railsCss}: missing.`)
  } else {
    if (!/\.home-rails \{\s*padding-top:\s*0;/.test(rails) && !/\.home-rails \{\s*padding-top:\s*var\(--v3-space-2xs\);/.test(rails)) {
      p.push(
        `${PATHS.railsCss}: .home-rails padding-top must stay 0 (or 2xs). Wrapper xl/sm stacked on the first rail is the heading-in-fold / photos-below miss.`,
      )
    }
    if (/\.home-rails \{\s*padding-top:\s*var\(--v3-space-(?:sm|md|lg|xl)/.test(rails)) {
      p.push(
        `${PATHS.railsCss}: .home-rails reintroduced tall quiet (sm+). Heading can stay in the 900 fold while first photos drop below.`,
      )
    }

    const first = lastCssBlock(rails, '.home-rails > .home-rail:first-child')
    if (!first) {
      p.push(`${PATHS.railsCss}: first-rail pad lock missing.`)
    } else if (!new RegExp(`padding-top:\\s*var\\(${HOME_FOLD_LOCK.firstRailPadTopToken}\\)`).test(first)) {
      p.push(
        `${PATHS.railsCss}: first rail padding-top must be var(${HOME_FOLD_LOCK.firstRailPadTopToken}). sm+ pushes photographs under the 900 fold.`,
      )
    }
    if (first && new RegExp(`padding-top:\\s*var\\(--v3-space-${TALL_SPACE}\\)`).test(first)) {
      p.push(`${PATHS.railsCss}: first rail reintroduced sm+ pad — heading-only fold.`)
    }

    if (
      !/\.home-rails > \.home-rail:first-child \.home-rail__head \{\s*padding-bottom:\s*var\(--v3-space-2xs\);/.test(
        rails,
      )
    ) {
      p.push(
        `${PATHS.railsCss}: first-rail head must tighten padding-bottom so card photos, not only the H2, enter the fold.`,
      )
    }
    if (
      /\.home-rails > \.home-rail:first-child \.home-rail__head \{\s*padding-bottom:\s*var\(--v3-space-(?:sm|md|lg|xl)/.test(
        rails,
      )
    ) {
      p.push(`${PATHS.railsCss}: first-rail head sm+ pad is the heading-in-fold / photos-below regression.`)
    }
  }

  if (answers == null) {
    p.push(`${PATHS.answersCss}: missing.`)
  } else {
    if (
      !/\.v3\.v3-answers\.v3-answers--strip \{[\s\S]*?padding:\s*var\(--v3-space-2xs\) var\(--v3-gutter\)/.test(
        answers,
      )
    ) {
      p.push(
        `${PATHS.answersCss}: strip pad must be var(--v3-space-2xs) on every side. xs/sm bottom is enough to drop photos under 900.`,
      )
    }
    if (
      /\.v3\.v3-answers\.v3-answers--strip \{[\s\S]{0,180}padding:[^;]*var\(--v3-space-(?:sm|md|lg|xl)/.test(
        answers,
      )
    ) {
      p.push(`${PATHS.answersCss}: strip reintroduced sm+ pad.`)
    }

    if (
      !/\.v3\.v3-answers\.v3-answers--strip \.v3-answers__strip-doors \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/.test(
        answers,
      )
    ) {
      p.push(`${PATHS.answersCss}: strip doors must stay 3 peer columns (Buy/Sell/Market).`)
    }
    if (
      !/\.v3\.v3-answers\.v3-answers--strip \.v3-answers__heading \{[\s\S]*?font-size: var\(--v3-size-body-lg\)/.test(
        answers,
      )
    ) {
      p.push(`${PATHS.answersCss}: strip heading must stay body-lg.`)
    }
    if (
      !/\.v3\.v3-answers\.v3-answers--strip \.v3-answers__door \{[\s\S]*?font-size: var\(--v3-size-body-sm\)/.test(
        answers,
      )
    ) {
      p.push(`${PATHS.answersCss}: strip door type must stay body-sm.`)
    }
    if (
      /\.v3\.v3-answers\.v3-answers--strip \.v3-answers__grid \{[\s\S]*?grid-template-columns: minmax\(0, 22rem\)/.test(
        answers,
      )
    ) {
      p.push(`${PATHS.answersCss}: do not restore the 22rem single door stack.`)
    }
  }

  return p
}

/**
 * homepage-fold-density.mjs — lock SITE-160 so a priced house card is in the
 * 1440×900 and 375 first viewport, not a 40px photo sliver under a Q&A strip.
 *
 * SITE-125 put #guides above the rails and the house left the fold. SITE-160
 * moves the strip below HomeHomesRails. Wrapper pad and first-rail 2xs still
 * bind so photos, not only the H2, enter the fold.
 *
 * THE SHELVES ARE LISTING DIALS (Matt 2026-09-24, SITE-195). HomeHomesRails no
 * longer stacks carousels in `.home-rails`; it stacks V3ListingDials in
 * `.home-shelves` (app/_v3/home-shelves.css). The lock moved with it and keeps
 * its point: the wrapper opens on a short pad, never lg or taller, and the
 * first shelf is a dial, whose photograph starts at the dial's own top beside
 * its readout. Measured on the dial build at 1440x900: the first shelf's
 * photograph top at y=518, inside maxFirstPhotoTopPx (880); at 375x812 the
 * first ask at y=693.
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
  /** The shelves wrapper's top pad: 0, 2xs, sm or md. lg and up is the photos-below miss. */
  shelvesPadTopTokens: Object.freeze(['0', '--v3-space-2xs', '--v3-space-sm', '--v3-space-md']),
  stripPadToken: '--v3-space-2xs',
  stripHeadingSizeToken: '--v3-size-body-lg',
  stripDoorSizeToken: '--v3-size-body-sm',
  peerDoorColumns: 3,
  gate: HOMEPAGE_FOLD_DENSITY_GATE,
})

const PATHS = Object.freeze({
  shelvesCss: 'app/_v3/home-shelves.css',
  shelves: 'app/_v3/HomeHomesRails.tsx',
  answersCss: 'components/site/v3/V3Answers.css',
  page: 'app/page.tsx',
  layout: 'app/layout.tsx',
})

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

export function homepageFoldDensityProblems({ root = process.cwd(), files = {} } = {}) {
  const p = []
  const shelvesCss = readRel(root, PATHS.shelvesCss, files.shelvesCss)
  const shelves = readRel(root, PATHS.shelves, files.shelves)
  const answers = readRel(root, PATHS.answersCss, files.answersCss)
  const page = readRel(root, PATHS.page, files.page)
  const layout = readRel(root, PATHS.layout, files.layout)

  if (page == null) {
    p.push(`${PATHS.page}: missing homepage.`)
  } else {
    if (!page.includes('id="guides"') || !page.includes('layout="strip"')) {
      p.push(`${PATHS.page}: #guides must stay V3Answers layout="strip" on the homepage.`)
    }
    const guidesAt = page.indexOf('id="guides"')
    const railsAt = page.indexOf('<HomeHomesRails')
    if (guidesAt < 0 || railsAt < 0 || guidesAt < railsAt) {
      p.push(`${PATHS.page}: HomeHomesRails must precede #guides so a priced card clears the fold.`)
    }
    if (page.includes('V3PhoneDock')) {
      p.push(`${PATHS.page}: do not remount V3PhoneDock. Sticky Call/Text is refuse.`)
    }
  }

  if (layout != null && layout.includes('V3PhoneDock')) {
    p.push(`${PATHS.layout}: do not remount V3PhoneDock. Sticky Call/Text is refuse.`)
  }

  if (shelves == null) {
    p.push(`${PATHS.shelves}: missing.`)
  } else if (!/<V3ListingDial/.test(shelves)) {
    p.push(
      `${PATHS.shelves}: each shelf must be a V3ListingDial (Matt 2026-09-24), whose photograph starts at the dial's top, so the first ask and photograph reach the fold.`,
    )
  }

  if (shelvesCss == null) {
    p.push(`${PATHS.shelvesCss}: missing.`)
  } else {
    // Every `.v3.home-shelves` rule that sets a top pad (the base rule and the
    // phone rule) is held, so a tall quiet cannot come back in either.
    const tops = cssBlocks(shelvesCss, '.v3.home-shelves')
      .map((block) => {
        const padTop = /padding-top:\s*([^;]+);/.exec(block)?.[1]
        const pad = /padding:\s*([^;]+);/.exec(block)?.[1]
        const top = (padTop ?? pad?.trim().split(/\s+(?![^(]*\))/)[0] ?? '').trim()
        return top ? (/^var\((--v3-space-[a-z0-9]+)\)$/.exec(top)?.[1] ?? top) : null
      })
      .filter((top) => top != null)
    if (tops.length === 0) {
      p.push(`${PATHS.shelvesCss}: shelves pad lock missing (.v3.home-shelves).`)
    }
    for (const top of tops) {
      if (!HOME_FOLD_LOCK.shelvesPadTopTokens.includes(top)) {
        p.push(
          `${PATHS.shelvesCss}: .home-shelves padding-top must stay 0, 2xs, sm or md (got ${top}). A taller quiet leaves the heading in the 900 fold and the photographs below it.`,
        )
      }
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

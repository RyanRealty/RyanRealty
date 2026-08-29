#!/usr/bin/env node
/**
 * Place-page opening count grain lock.
 *
 * THE RULE IS ABOUT THE GRAIN OF THE COUNT IN THE OPENING, not about which
 * component prints it. KbHero prefixes "{N} homes for sale " + `lead`, and a
 * sub-city page that continues with `in ${cityName}` attributes a finer-grain
 * count to the city. Founding case: /cities/bend/awbrey-butte → "63 homes for
 * sale in Bend" (fleet 97c68da5, 2026-08-16).
 *
 * TWO REGISTERS, ONE RULE (2026-08-26). A page that leaves KB stops importing
 * placeHeroLead, and a gate that only knew the KB spelling would have gone
 * quiet on it — the silent-loss class the migration recipe §5.2 names. So each
 * page carries either the KB descriptor (imports placeHeroLead and calls it) or
 * a `v3` descriptor naming the caption builder that decides the opening count's
 * grain, plus the same forbidden pattern. The v3 arm asserts the page uses that
 * builder AND that the builder itself names the place it counts rather than a
 * parent. app/zip/[zip] moved first, on 2026-08-26.
 *
 *   node scripts/check-place-hero-grain.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/kb/place-hero-lead.ts')
checks.push({
  label: 'placeHeroLead exists and forbids a coarser parent on a known count',
  ok:
    /export function placeHeroLead/.test(helper) &&
    helper.includes('never a coarser parent') &&
    helper.includes('return `in ${place}. ${knownSuffix}`'),
})

const pages = [
  {
    path: 'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
    label: 'neighborhood page opening count names the neighborhood, not the city',
    forbid: /lead=\{`in \$\{cityName\}/,
    // The v3 Field replaced KbHero here (2026-08-26). The count that opens the
    // frame is neighborhoodFaceFieldCaption's, and that builder interpolates
    // the neighborhood name itself.
    v3: {
      module: 'app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-face.ts',
      builder: 'neighborhoodFaceFieldCaption',
      names: 'in ${input.placeName}',
    },
  },
  {
    path: 'app/communities/[slug]/page.tsx',
    label: 'community page opening count names the community, not the city',
    forbid: /in \$\{cityName\}\. Live inventory/,
    // The v3 Field replaced KbHero here (2026-08-26). The count beside the
    // frame is communityFaceFieldCaption's, and that builder interpolates the
    // community's public name itself.
    v3: {
      module: 'app/communities/[slug]/_v3/community-face.ts',
      builder: 'communityFaceFieldCaption',
      names: 'in ${input.placeName}',
    },
  },
  {
    path: 'app/cities/[slug]/page.tsx',
    label: 'city page opening count names the city, not a coarser parent',
    // The v3 Field replaced KbHero here (2026-08-26). The count that opens the
    // page is cityFieldCaption's, and that builder interpolates the city name
    // itself, so the caption cannot hang the count on a coarser parent.
    v3: {
      module: 'app/cities/[slug]/_v3/city-face.ts',
      builder: 'cityFaceFieldCaption',
      names: 'in ${input.cityName}',
    },
  },
  {
    path: 'app/subdivisions/[slug]/page.tsx',
    label: 'plat page opening names the plat, not the parent city alone',
    // Stage then Field (2026-08-29). The H1 is `Homes for sale in ${displayName}`
    // and the Field caption interpolates the subdivision name, so the counted
    // set cannot read as the parent city's inventory.
    v3: {
      module: 'app/subdivisions/[slug]/_v3/subdivision-face.ts',
      builder: 'subdivisionFaceFieldCaption',
      names: 'in ${input.placeName}',
    },
  },
  {
    path: 'app/zip/[zip]/page.tsx',
    label: 'zip page opening names the ZIP, not the parent city',
    // The v3 Field replaced KbHero here. The count that opens the page is
    // zipFieldCaption's, and that builder interpolates the ZIP itself.
    v3: {
      module: 'app/zip/[zip]/_v3/zip-constants.ts',
      builder: 'zipFieldCaption',
      // The caption must name the place it counted. `in ${zip}` is the whole
      // rule at this grain: a caption that read `in ${cityName}` would hang a
      // ZIP count on the city, which is the founding defect one grain up.
      names: 'in ${zip}',
    },
  },
]

for (const page of pages) {
  const text = src(page.path)
  const forbidden = page.forbid ? page.forbid.test(text) : false
  let usesGrainedOpening =
    /from ['"]@\/lib\/kb\/place-hero-lead['"]/.test(text) && /placeHeroLead\(/.test(text)
  if (!usesGrainedOpening && page.v3) {
    const builderModule = src(page.v3.module)
    usesGrainedOpening =
      new RegExp(`\\b${page.v3.builder}\\b`).test(text) &&
      new RegExp(`export function ${page.v3.builder}\\b`).test(builderModule) &&
      builderModule.includes(page.v3.names)
  }
  checks.push({
    label: page.label,
    ok: usesGrainedOpening && !forbidden,
  })
}

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\nplace-hero-grain: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\nplace-hero-grain: ${checks.length}/${checks.length}`)

#!/usr/bin/env node
/**
 * Place-page hero count grain lock.
 *
 * KbHero prefixes "{N} homes for sale " + `lead`. A sub-city page that
 * continues with `in ${cityName}` attributes a finer-grain count to the city.
 * Founding case: /cities/bend/awbrey-butte → "63 homes for sale in Bend"
 * (fleet 97c68da5, 2026-08-16).
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
    label: 'neighborhood page uses placeHeroLead (not in ${cityName})',
    forbid: /lead=\{`in \$\{cityName\}/,
  },
  {
    path: 'app/communities/[slug]/page.tsx',
    label: 'community page uses placeHeroLead (not in ${cityName} when counted)',
    forbid: /in \$\{cityName\}\. Live inventory/,
  },
  {
    path: 'app/cities/[slug]/page.tsx',
    label: 'city page uses placeHeroLead',
  },
  {
    path: 'app/subdivisions/[slug]/page.tsx',
    label: 'subdivision page uses placeHeroLead',
  },
  {
    path: 'app/zip/[zip]/page.tsx',
    label: 'zip page uses placeHeroLead',
  },
]

for (const page of pages) {
  const text = src(page.path)
  const importsHelper = /from ['"]@\/lib\/kb\/place-hero-lead['"]/.test(text) && /placeHeroLead\(/.test(text)
  const forbidden = page.forbid ? page.forbid.test(text) : false
  checks.push({
    label: page.label,
    ok: importsHelper && !forbidden,
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

#!/usr/bin/env node
/**
 * Place HOA publish lock.
 *
 * Master assessment and registry annual estimate are different files. A place
 * page that prints HOA twice must run publishPlaceHoa so glance, FAQ, and
 * Dataset cannot disagree.
 * Founding case: /communities/tetherow Master HOA $1,464/yr vs FAQ $2,244
 * (fleet eab91ac8dfa9b833ade88640c6cce7d4).
 *
 *   node scripts/check-publish-place-hoa.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/publish-place-hoa.ts')
checks.push({
  label: 'publishPlaceHoa prefers master and otherwise the estimate floor',
  ok:
    /export function publishPlaceHoa/.test(helper) &&
    helper.includes("kind: 'master'") &&
    helper.includes('Math.min'),
})

const surfaces = [
  {
    path: 'app/communities/[slug]/page.tsx',
    label: 'community page gates glance + FAQ HOA through publishPlaceHoa',
  },
  {
    path: 'components/site/kb/KbResortOverview.tsx',
    label: 'KB resort glance gates Master HOA through publishPlaceHoa',
  },
  {
    path: 'app/communities/[slug]/_v3/place-knowledge.ts',
    label: 'place-knowledge Quiet gates HOA through publishPlaceHoa',
  },
  {
    path: 'app/communities/[slug]/_v3/community-opening.ts',
    label: 'community opening figures gate HOA through publishPlaceHoa',
  },
  {
    path: 'lib/site/market-faq.ts',
    label: 'buildMarketFaq publishes HOA through publishPlaceHoa',
  },
]

for (const surface of surfaces) {
  const text = src(surface.path)
  checks.push({
    label: surface.label,
    ok:
      /from ['"]@\/lib\/market\/publish-place-hoa['"]/.test(text) &&
      /publishPlaceHoa\(/.test(text),
  })
}

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-place-hoa: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-place-hoa: ${checks.length}/${checks.length}`)

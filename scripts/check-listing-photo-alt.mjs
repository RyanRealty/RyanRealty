#!/usr/bin/env node
/**
 * check-listing-photo-alt.mjs — CI gate: listing photos must carry descriptive alt text.
 *
 * AEO/SEO site audit (2026-09-07) found <Image>/<img> tags rendering live
 * listing photography with alt="" across the search surfaces. The photo is
 * how a property gets discovered in image search and cited by AI answer
 * engines — an empty alt string throws that away. The fix routes every one
 * of these through components/site/v3/listing-photo-alt.ts (or, for
 * V3Field's address-like `title` field, that value directly). This gate
 * holds the fix in place: none of the four files below may render a
 * listing-photo <Image>/<img> tag with an empty alt attribute again.
 *
 * Scope is deliberately narrow — the four files the audit named, not every
 * <Image>/<img> in the repo. A genuinely decorative image (e.g. the
 * aria-hidden poster in V3Stage.tsx) is out of scope and not scanned here;
 * this is a presence check on listing photography specifically, in the
 * style of check-ai-structured-data.mjs, not a general accessibility linter.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

const FILES = [
  'components/site/v3/V3ListingRow.tsx',
  'components/site/v3/SplitCardMedia.tsx',
  'components/site/v3/V3Field.tsx',
  'app/_v3/HomeFeaturedCommunity.client.tsx',
]

const EMPTY_ALT = /alt\s*=\s*(""|'')/

/** Find the end of a JSX opening tag starting at `start`: the first `>` that
 *  is not part of an arrow function (`=>`) inside an attribute expression. */
function findTagEnd(src, start) {
  for (let i = start + 1; i < src.length; i++) {
    if (src[i] === '>' && src[i - 1] !== '=') return i
  }
  return -1
}

const errors = []

for (const file of FILES) {
  const abs = join(ROOT, file)
  if (!existsSync(abs)) {
    errors.push(`${file}: file not found.`)
    continue
  }
  const src = readFileSync(abs, 'utf8')
  const tagRe = /<(Image|img)\b/g
  let match
  while ((match = tagRe.exec(src))) {
    const start = match.index
    const end = findTagEnd(src, start)
    if (end === -1) continue
    const tag = src.slice(start, end + 1)
    if (EMPTY_ALT.test(tag)) {
      const line = src.slice(0, start).split('\n').length
      errors.push(`${file}:${line}: <${match[1]}> renders a listing photo with alt="".`)
    }
    tagRe.lastIndex = end + 1
  }
}

if (errors.length > 0) {
  console.error('\nListing-photo alt-text gate FAILED:\n')
  for (const e of errors) console.error(`  - ${e}`)
  console.error(
    '\nEvery listing photo must carry descriptive alt text — the address/city\n' +
      '(listingPhotoAlt in components/site/v3/listing-photo-alt.ts) or the item\'s\n' +
      'title. Empty alt kills image-search and AI answer-engine discoverability for\n' +
      'that listing. See scripts/check-listing-photo-alt.mjs.\n',
  )
  process.exit(1)
}

console.log(`OK — ${FILES.length} files scanned, no listing photo renders alt="".`)

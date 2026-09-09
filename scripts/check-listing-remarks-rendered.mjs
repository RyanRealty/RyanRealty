#!/usr/bin/env node
/**
 * check-listing-remarks-rendered.mjs — the listing page renders the remarks it reads.
 *
 * CLAUDE.md §2: MLS remarks are shown as written. Matt, 2026-09-09, asked and
 * answered: "mls descriptions must come back."
 *
 * WHY THIS GATE EXISTS. The remarks did not disappear because anyone decided to
 * drop them. `getListingDetail` kept selecting `public_remarks` and mapping it to
 * `publicRemarks`; the twelve-section rebuild (7c40065e) dropped the renderer's
 * import; the remainder contract then asserted the renderer's absence; and the
 * orphan sweep (545e4e50) deleted the component and, as a cascade, the paragraph
 * joiner. Every step was locally reasonable. The result was a page that carried
 * the listing agent's words into the payload and showed the visitor none of them
 * — verified live on 2026-09-09, where `document.body.innerText` did not contain
 * the listing's own opening phrase and the only text node holding it was inside a
 * script tag.
 *
 * That shape — the read alive, the render gone — is what this gate refuses. It is
 * a mechanical check because a comment could not have caught it (memory
 * feedback_gates_not_prose): the rebuild's own contract test was the thing that
 * locked the absence in.
 *
 * THE RULE, in three parts:
 *   1. If the DAL still maps remarks (`publicRemarks:` in getListingDetail), the
 *      listing route must pass them to a rendered component (`publicRemarks={`
 *      inside JSX on the page).
 *   2. The renderer must exist and must go through `publishListingRemarks`, whose
 *      whole job is that Spark inserts a blank line mid-sentence and a naive
 *      split leaves a truncated first paragraph. Rendering the raw string is a
 *      different defect wearing the same green tick.
 *   3. The renderer must not summarise, rewrite or hard-truncate: no `.slice(`,
 *      no `substring(`, no ellipsis literal in the component. A clamp that
 *      reveals the rest (CSS + a control) is fine and is what ships.
 *
 * Usage: node scripts/check-listing-remarks-rendered.mjs
 * Wired as ci:listing-remarks-rendered in the ci:gates chain.
 */

import { readFileSync, existsSync } from 'node:fs'

const DAL = 'lib/data/listings/getListingDetail.ts'
const PAGE = 'app/listing/[listingKey]/page.tsx'
const RENDERER = 'components/site/listing-detail/DescriptionBlock.tsx'
const JOINER = 'lib/listing/publish-listing-remarks.ts'

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null)

const failures = []

const dal = read(DAL)
if (dal == null) {
  failures.push(`${DAL}: missing — the gate cannot tell whether the remarks are read.`)
}

const page = read(PAGE)
if (page == null) {
  failures.push(`${PAGE}: missing — the listing route moved; repoint this gate.`)
}

// (1) The read and the render travel together.
const dalReadsRemarks = dal != null && /publicRemarks\s*:/.test(dal)
if (dalReadsRemarks && page != null) {
  const passesRemarks = /publicRemarks=\{/.test(page)
  if (!passesRemarks) {
    failures.push(
      `${PAGE}: ${DAL} still maps publicRemarks, but the page never passes it to a component ` +
        `(no \`publicRemarks={\`). That is the exact shape of the 2026-09-09 defect: the listing ` +
        `agent's words reach the payload and the visitor sees none of them. CLAUDE.md §2 — MLS ` +
        `remarks are shown as written.`,
    )
  }
}

// (2) The renderer exists and goes through the joiner.
const renderer = read(RENDERER)
if (dalReadsRemarks) {
  if (renderer == null) {
    failures.push(
      `${RENDERER}: missing. The listing route reads remarks and has no renderer for them.`,
    )
  } else if (!/publishListingRemarks/.test(renderer)) {
    failures.push(
      `${RENDERER}: does not use publishListingRemarks. Spark inserts a blank line mid-sentence; ` +
        `splitting on it without the joiner ships a truncated first paragraph.`,
    )
  }
  if (!existsSync(JOINER)) {
    failures.push(`${JOINER}: missing — the paragraph joiner the renderer depends on.`)
  }
}

// (3) As written: nothing summarised, rewritten or hard-truncated.
if (renderer != null) {
  const mutilations = [
    [/\.slice\(/, '.slice( — cuts the remarks'],
    [/\.substring\(/, '.substring( — cuts the remarks'],
    [/\.substr\(/, '.substr( — cuts the remarks'],
    [/['"`]…['"`]/, 'an ellipsis literal — truncation with a bow on it'],
    [/\.\.\.['"`]/, 'a literal "..." — truncation with a bow on it'],
  ]
  for (const [re, why] of mutilations) {
    if (re.test(renderer)) {
      failures.push(
        `${RENDERER}: contains ${why}. The remarks are shown as written (CLAUDE.md §2); ` +
          `clamp them with CSS and reveal the rest with a control instead.`,
      )
    }
  }
}

if (failures.length > 0) {
  console.error('ci:listing-remarks-rendered FAILED\n')
  for (const f of failures) console.error(`  ✗ ${f}\n`)
  process.exit(1)
}

console.log(
  'ci:listing-remarks-rendered — OK: the listing route renders the remarks it reads, ' +
    'through the paragraph joiner, uncut.',
)

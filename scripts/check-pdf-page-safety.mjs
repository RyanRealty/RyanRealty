#!/usr/bin/env node
/**
 * check-pdf-page-safety.mjs (ci:pdf-page-safety) — THE PAGE CONTRACT, statically.
 *
 * Every document Ryan Realty sends a human as a PDF — CMA, BPO, market report,
 * net sheet, flyer — obeys one page box: lib/pdf/page-contract.ts. Content may
 * not enter a header, a footer, or a margin, and it may never be silently
 * clipped away.
 *
 * The authoritative checks measure real output and cannot run here: they need a
 * browser (`lib/pdf/*.int.test.ts`, `npm run test:int`) or the finished PDF
 * bytes (`assertPdfPageSafety`, which every send path calls). This gate is the
 * fast structural one — it runs on every commit with no browser and no secrets,
 * and it fails the two constructs that produced every bleed we have shipped:
 *
 *   1. A paged container that CLIPS. `overflow: hidden` (or a max-height) on a
 *      sheet element deletes whatever does not fit. The rows are absent from
 *      the PDF with no error, so no downstream check can see them. A delivered
 *      CMA lost part of a comparable's stat line this way.
 *
 *   2. Bands reserved with PADDING on a box that fragments across sheets. CSS
 *      padding applies once at the top of a box and once at the bottom, so the
 *      first sheet gets a top margin, the last gets a bottom margin, and every
 *      interior sheet gets neither. A 5-sheet BPO printed body text 1.5pt from
 *      the paper edge on sheets 3, 4 and 5.
 *
 * A renderer that needs an exception documents it with the marker below, on the
 * line above the rule. Exceptions are visible in the diff and countable here;
 * silence is not an exception.
 */
import { readFileSync } from 'node:fs'
import { walkFiles } from './lib/walk.mjs'

const ALLOW = 'page-contract-exempt'

const SELF = new Set([
  'lib/pdf/page-contract.ts',
  'lib/pdf/assert-page-safety.ts',
  'lib/pdf/assert-page-fit.ts',
  'scripts/check-pdf-page-safety.mjs',
])

/** Modules that render a document destined for paper or a PDF attachment. */
function isDocumentRenderer(file, src) {
  if (SELF.has(file)) return false
  if (!/\.tsx?$/.test(file)) return false
  if (/\.test\.tsx?$/.test(file)) return false
  // An HTML document renderer declares sheets and prints them.
  const paged = /@page\b|@media\s+print|page-break-after|break-after:\s*page/.test(src)
  // A react-pdf document declares <Page>.
  const reactPdf = /from '@react-pdf\/renderer'/.test(src)
  return paged || reactPdf
}

/** Strip CSS comments so a rule quoted in prose is not read as a rule. */
const stripComments = (s) => s.replace(/\/\*[^]*?\*\//g, '')

/**
 * Selectors that model a physical sheet. A rule on one of these is what the
 * printer honours, so these are the ones that must not clip or self-pad.
 */
const SHEET_SELECTOR = /(^|[\s,>])\.(page|sheet|doc-page)\b/

function rulesFor(src) {
  const css = stripComments(src)
  const out = []
  // Rule bodies: `<selector> { <decls> }` with no nested braces. Good enough
  // for the flat declaration blocks these stylesheets use, and it never has to
  // parse an at-rule body because those contain their own nested rules.
  const re = /([^{}();]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(css))) {
    const selector = m[1].trim()
    if (!selector || selector.startsWith('@')) continue
    out.push({
      selector,
      body: m[2],
      line: css.slice(0, m.index).split('\n').length,
    })
  }
  return out
}

const failures = []
const files = [...walkFiles('lib'), ...walkFiles('app'), ...walkFiles('components')]

for (const file of files) {
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  if (!isDocumentRenderer(file, src)) continue

  const lines = src.split('\n')
  const exempt = (line) => (lines[line - 2] ?? '').includes(ALLOW) || (lines[line - 1] ?? '').includes(ALLOW)

  for (const rule of rulesFor(src)) {
    if (!SHEET_SELECTOR.test(rule.selector)) continue
    if (exempt(rule.line)) continue

    // 1. Clipping. A sheet that hides its overflow destroys content.
    if (/overflow(-y)?\s*:\s*(hidden|clip)/.test(rule.body)) {
      failures.push({
        file,
        line: rule.line,
        selector: rule.selector,
        why: 'sheet container clips its overflow — content that does not fit is deleted from the PDF with no error',
      })
    }
    if (/max-height\s*:/.test(rule.body)) {
      failures.push({
        file,
        line: rule.line,
        selector: rule.selector,
        why: 'sheet container caps its height — the excess is clipped away instead of paginating',
      })
    }
  }

  // 2. Bands reserved with padding on a fragmenting box. Only meaningful for
  // documents that flow: a renderer whose sheets each map 1:1 to a sheet may
  // legitimately pad, because its box never fragments.
  const css = stripComments(src)
  const flows = /break-after:\s*page|page-break-after:\s*always/.test(css)
  // The bands are reserved either by an inline @page rule with a real margin,
  // or by pulling in the shared contract, which emits exactly that. A renderer
  // composes its stylesheet at runtime, so the literal @page text is often in
  // page-contract.ts rather than in the file being read.
  const declaresPageMargin =
    /@page[^{]*\{[^}]*margin\s*:\s*(?!0[;\s}])/.test(css) || /pageContractCss\s*\(/.test(css)

  if (flows && !declaresPageMargin) {
    for (const rule of rulesFor(src)) {
      if (!SHEET_SELECTOR.test(rule.selector)) continue
      if (exempt(rule.line)) continue
      if (!/padding\s*:/.test(rule.body)) continue
      // Screen-only padding never reaches paper. Measure the offset on the same
      // string the rule was found in, or the slice lands in the wrong place.
      const at = css.indexOf(rule.body)
      const inScreenOnly = at > 0 && /@media\s+screen[^{]*\{[^}]*$/.test(css.slice(Math.max(0, at - 400), at))
      if (inScreenOnly) continue
      failures.push({
        file,
        line: rule.line,
        selector: rule.selector,
        why:
          'sheet padding reserves the header/footer bands, but this document fragments across sheets — ' +
          'padding lands only on the first and last sheet, leaving interior sheets with no margin. ' +
          'Reserve the bands with @page { margin } from lib/pdf/page-contract.ts instead.',
      })
    }
  }
}

console.log('PDF page-safety gate (ci:pdf-page-safety)')
console.log('========================================')

if (failures.length) {
  console.error(`\n${failures.length} page-contract violation(s):\n`)
  for (const f of failures) {
    console.error(`  ✗ ${f.file}:${f.line}  {${f.selector}}`)
    console.error(`      ${f.why}\n`)
  }
  console.error('THE PAGE CONTRACT: lib/pdf/page-contract.ts')
  console.error(`Deliberate exception: put "${ALLOW}" in a comment on the line above the rule.`)
  console.error('Rendered proof: npm run test:int -- lib/pdf lib/cma/page-safety lib/bpo/page-safety\n')
  process.exit(1)
}

console.log('✓ no sheet container clips its overflow')
console.log('✓ no fragmenting document reserves its bands with padding')
process.exit(0)

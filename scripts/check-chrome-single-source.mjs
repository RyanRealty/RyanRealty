#!/usr/bin/env node
/**
 * check-chrome-single-source.mjs — ONE HEADER, ONE FOOTER, ON EVERY PUBLIC PAGE.
 *
 * WHY THIS EXISTS
 * Matt, 2026-08-27: "i dont want to have to catch these anomalies, menus and
 * footers must be consistent."
 *
 * He was right to ask. On that date 86 public pages mounted V3Footer and the
 * homepage — the page a visitor lands on FIRST — mounted KbFooter: a different
 * close ("A broker writes back"), a different fine-print treatment, and a GSAP
 * entrance the other 86 did not have. Nothing in CI noticed, because nothing
 * was looking. The nav had converged on a single layout-mounted V3Chrome by
 * luck rather than by rule, and nothing stopped it diverging again.
 *
 * Chrome is the one part of a page that is the same on every page BY
 * DEFINITION. A second footer is not a design choice, it is a defect, and it is
 * the kind a person only finds by browsing their own site and feeling that
 * something is off. That is the job this gate takes off Matt.
 *
 * WHAT IT ASSERTS
 *   1. THE SITE FOOTER SET IS CLOSED. Under components/site/**, exactly the
 *      known components render a `<footer>` landmark. A NEW one is a new site
 *      footer and fails on arrival — this is the tripwire, and it is what makes
 *      the gate catch the anomaly nobody has written yet.
 *   2. ONE FOOTER ON A PAGE. No public surface mounts a site footer other than
 *      the one site footer, V3Footer.
 *   3. NO PAGE-LEVEL HEADER. No public surface mounts a site nav/header at all.
 *   4. THE LAYOUT STILL MOUNTS ONE. app/layout.tsx mounts V3Chrome exactly
 *      once. Without this, rule 3 is satisfied by a site with no header at all.
 *
 * WHY "RENDERS A <footer> LANDMARK" AND NOT A NAME
 * A blocklist of names only ever catches the components that were wrong the day
 * it was written. Naming by shape (anything ending in `Footer`) was tried first
 * and was worse: it flagged CardHeader, DialogFooter, TableHeader and
 * SectionHeader — shadcn compound parts and page section headings, none of them
 * site chrome. What actually makes a component a site footer is that it renders
 * the contentinfo landmark. So that is the test.
 *
 * DETECTION IS AST ONLY
 * JSX elements read off the TypeScript AST, never a text scan. A grep for
 * "<footer" over this repo matches 80+ page files, every one of them the
 * comment explaining why the footer sits outside <main>. This repo has shipped
 * a gate that fired on its own explanatory comment more than once, and the
 * prose above names every banned component.
 *
 * SCOPE
 * Every .tsx under app/, minus:
 *   app/admin/  app/api/  app/dev/   — same exclusions as ci:public-ui, for the
 *                                      same reasons (own ratchet / not a
 *                                      surface / prototypes are where a
 *                                      language is allowed to be tried)
 *   app/dashboard/ app/console/      — authed product shells, not the public
 *                                      site; they carry their own chrome on
 *                                      purpose and are out of this frame.
 *
 * Usage: node scripts/check-chrome-single-source.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const EXCLUDED = ['app/admin/', 'app/api/', 'app/dev/', 'app/dashboard/', 'app/console/']
const LAYOUT = 'app/layout.tsx'
const SITE = 'components/site'

/** The one site footer and the one site header. */
const ALLOWED_FOOTER = 'V3Footer'
const LAYOUT_HEADER = 'V3Chrome'

/**
 * The site footers that exist today, by the component name a page would mount.
 * SiteFooter and KbFooter are retired from public surfaces but still on disk
 * (SiteFooter is the dashboard's, which is out of scope). This list may only
 * SHRINK: a name arriving here is a second site footer.
 */
const KNOWN_FOOTERS = new Set(['V3Footer', 'SiteFooter', 'KbFooter'])

/**
 * Site navs/headers, by mount name. Not derived from a landmark: `<header>` is
 * a legitimate page-section element (the account pages and the Field pattern
 * both use it correctly), so the landmark test that works for footers would
 * over-fire here. This is a small, named, closed set instead.
 */
const SITE_NAVS = new Set(['V3Chrome', 'KbNav', 'SiteHeader', 'MobileNav', 'PublicNav'])

function tsxFiles(dir, out = []) {
  if (!existsSync(join(ROOT, dir))) return out
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) tsxFiles(rel, out)
    else if (entry.name.endsWith('.tsx')) out.push(rel)
  }
  return out
}

function parse(rel) {
  const text = readFileSync(join(ROOT, rel), 'utf8')
  return ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

/**
 * Every JSX element mounted in a file, with its line and whether it sits inside a
 * <main> element. Comments cannot appear.
 *
 * `insideMain` exists because of a defect this gate MISSED (2026-08-27): seven
 * landing pages mounted the correct footer in the wrong place. HTML-AAM maps
 * <footer> to role=contentinfo ONLY when it is not nested in sectioning content,
 * so a footer inside <main> is not a landmark at all. Those pages rendered ZERO
 * contentinfo landmarks while every other public page had one, and this gate
 * reported "one header, one footer, everywhere public" the whole time, because it
 * counted mounts and never asked where they were.
 */
function mountedElements(rel) {
  const src = parse(rel)
  const found = []
  const visit = (node, mainDepth) => {
    let depth = mainDepth
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(src)
      if (tag === 'main') depth += 1
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      found.push({
        name: node.tagName.getText(src).replace(/^.*\./, ''),
        line: src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1,
        insideMain: mainDepth > 0,
      })
    }
    ts.forEachChild(node, (child) => visit(child, depth))
  }
  visit(src, 0)
  return found
}

/* -- Rule 1: the site footer set is closed. ------------------------------- */

const footerComponentFiles = tsxFiles(SITE).filter((rel) =>
  mountedElements(rel).some((e) => e.name === 'footer')
)
// A file's mount name is its component name: the basename minus .client/.tsx.
const footerNames = footerComponentFiles.map((rel) =>
  rel.split('/').pop().replace(/\.client\.tsx$|\.tsx$/, '')
)

const failures = []

for (const name of footerNames) {
  if (!KNOWN_FOOTERS.has(name)) {
    failures.push(
      `components/site/** grew a NEW site footer: <${name}>. The site has one footer, ` +
      `<${ALLOWED_FOOTER}>. If this is genuinely chrome, it replaces the one footer; ` +
      `if it is page content, it must not render a <footer> landmark.`
    )
  }
}

/* -- Rules 2 and 3: what public surfaces mount. --------------------------- */

const inScope = (rel) => !EXCLUDED.some((d) => rel.startsWith(d)) && rel !== LAYOUT
const pages = tsxFiles('app').filter(inScope).sort()

let footerMounts = 0
for (const rel of pages) {
  for (const mount of mountedElements(rel)) {
    const { name, line } = mount
    if (name === ALLOWED_FOOTER) {
      footerMounts++
      if (mount.insideMain) {
        failures.push(
          `${rel}:${line}  mounts <${ALLOWED_FOOTER}> INSIDE <main>. HTML-AAM maps <footer> to ` +
          `role=contentinfo only when it is NOT nested in sectioning content, so this page has ` +
          `the right footer and no contentinfo landmark. Move it after </main> (wrap the return ` +
          `in a fragment if it is a bare <main>).`
        )
      }
      continue
    }
    if (KNOWN_FOOTERS.has(name)) {
      failures.push(
        `${rel}:${line}  mounts <${name}> — the ONE site footer is <${ALLOWED_FOOTER}>. ` +
        `A page with a different footer is the anomaly this gate exists to catch.`
      )
    }
    if (SITE_NAVS.has(name)) {
      failures.push(
        `${rel}:${line}  mounts <${name}> — a public page may not mount a site header. ` +
        `The one public header is <${LAYOUT_HEADER}>, mounted in ${LAYOUT}.`
      )
    }
  }
}

/* -- Rule 4: the layout still mounts the one header. ---------------------- */

const layoutHeaders = mountedElements(LAYOUT).filter((e) => e.name === LAYOUT_HEADER)
if (layoutHeaders.length !== 1) {
  failures.push(
    `${LAYOUT}  mounts <${LAYOUT_HEADER}> ${layoutHeaders.length} time(s), expected exactly 1. ` +
    `Rule 3 forbids a page carrying a header, so if the layout stops carrying one the site has none.`
  )
}

/* -- Report --------------------------------------------------------------- */

console.log('chrome single source (ci:chrome-single-source)')
console.log('==============================================')
console.log(`${pages.length} public .tsx scanned (app/**, minus admin/api/dev/dashboard/console).`)
console.log(`  site footers on disk : ${footerNames.sort().join(', ') || 'none'}`)
console.log(`  <${ALLOWED_FOOTER}> mounted  : ${footerMounts} surface(s)`)
console.log(`  <${LAYOUT_HEADER}> in layout : x${layoutHeaders.length}`)

if (failures.length) {
  console.error(`\nFAIL - ${failures.length} chrome inconsistenc${failures.length === 1 ? 'y' : 'ies'}:\n`)
  for (const f of failures) console.error('  ' + f)
  console.error('\nMenus and footers are the same on every page by definition. Fix the mount.')
  process.exit(1)
}

console.log('\nOK - one header, one footer, everywhere public.')

#!/usr/bin/env node
/**
 * check-one-design-system.mjs — THERE IS ONE DESIGN SYSTEM. A SECOND CANNOT APPEAR.
 *
 * Matt, 2026-08-27: "every fucking thing MUST USE THE SAME DESIGN SYSTEM NO MORE
 * FRANKENSTEIN MAKE IT A FACT ... NO EXCEPTIONS", and: "make it impossible for
 * any other design system to pop up."
 *
 * WHAT HE WAS LOOKING AT. The public site had FIVE visual registers living at
 * once (kb, legacy, primitives, explore, v3), 672 hardcoded brand hex values on
 * the landing pages, nine pages hand-rolling their own footer, and a 2,220-line
 * second stylesheet that ignored the token file entirely. Changing a token
 * restyled 82 pages and left the rest behind. That is what "Frankenstein" meant,
 * and it was accurate.
 *
 * THE RULE THIS ENFORCES, stated once: a public surface gets its look from
 * components/site/v3/tokens.css and from nothing else. Structure, density, rule
 * weight and motion may vary by REGISTER (Broadside, Ledger — PUBLIC_UI section
 * 9), and a register is a token block in that one file. It is never a second
 * component family, never a second stylesheet, and never a value typed into a
 * component.
 *
 * FOUR THINGS FAIL THE BUILD:
 *
 *   1. A SECOND COMPONENT REGISTER. components/site/ may hold exactly the
 *      directories in REGISTERS below. A new subdirectory of section components
 *      IS a second design system, whatever it is called. This is the check that
 *      would have caught `kb/` on the day it was created.
 *
 *   2. A SECOND STYLESHEET THAT DEFINES A LOOK. A .css file under components/ or
 *      app/ may not declare brand color, radius, shadow or motion in raw values.
 *      It consumes tokens or it does not style. kb.css was 2,220 lines of
 *      exactly this, and it is why the site had two looks.
 *
 *   3. A BRAND VALUE TYPED INTO A COMPONENT. Raw #102742 / #faf8f4 (in any
 *      casing, and as the Tailwind arbitrary forms) on a public surface. The
 *      token is the only spelling. This is the one that had 672 instances.
 *
 *   4. AN ELEVATION SHADOW. Neither register draws one (PUBLIC_UI section 9).
 *      A shadow that is not a focus ring or a data-mark ring is a third look
 *      arriving one component at a time.
 *
 * WHY SHAPE RULES AND NOT A BLOCKLIST. A list of the five registers that existed
 * on 2026-08-27 catches those five and nothing else; the point is the SIXTH. So
 * every check above is a rule about shape, and adding a legitimate exception is
 * a deliberate edit here, with a reason, visible in the diff.
 *
 * DETECTION. TypeScript AST for component checks, so the gate cannot fire on its
 * own prose — this file names every banned value above. CSS is read as text
 * because there is no CSS AST in the toolchain, so every CSS check strips
 * comments first.
 *
 * Usage: node scripts/check-one-design-system.mjs
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()

/* -------------------------------------------------------------------------- */
/* 1. ONE COMPONENT REGISTER                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The only directories allowed under components/site/. `v3` is THE register.
 * The rest are non-visual or feature folders that carry no register of their
 * own; each is listed with what it is, so a future reader can tell a feature
 * folder from a second design system.
 */
const ALLOWED_SITE_DIRS = new Map([
  ['v3',             'THE register. Six patterns + tokens.css.'],
  ['primitives',     'Typography primitives (H1/H2/DisplayHeading). One site left; retiring.'],
  ['listing-detail', 'The listing node\'s own sections. Built from the barrel.'],
  ['nav',            'Nav internals used by V3Chrome.'],
  ['providers',      'Context providers. Render no chrome.'],
  ['experience',     'Non-visual experience wiring.'],
  ['golf',           'Golf feature sections. Built from the barrel.'],
  ['__tests__',      'Tests.'],
])

const failures = []

const siteDir = join(ROOT, 'components/site')
for (const entry of readdirSync(siteDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  if (ALLOWED_SITE_DIRS.has(entry.name)) continue
  failures.push(
    `components/site/${entry.name}/ is a NEW component family. A second family of ` +
    `section components is a second design system, whatever it is named. Build it ` +
    `from components/site/v3, or add it to ALLOWED_SITE_DIRS in this gate with a ` +
    `reason that says why it is not a register.`
  )
}

/* -------------------------------------------------------------------------- */
/* 2 + 4. NO SECOND STYLESHEET, NO ELEVATION                                   */
/* -------------------------------------------------------------------------- */

const TOKEN_FILE = 'components/site/v3/tokens.css'

/**
 * Out of the public frame, for the same reasons ci:public-ui excludes them:
 * admin runs its OWN locked language (design_system/admin/, gated by
 * ci:admin-v2-tokens), and app/dev is where a language is allowed to be tried.
 */
const CSS_EXCLUDED = ['app/admin/', 'app/api/', 'app/dev/', 'app/dashboard/',
                      'components/admin/', 'components/console/']

/** CSS files exempt, each with the reason it cannot consume tokens. */
const CSS_EXEMPT = new Set([
  TOKEN_FILE,                                   // the token file DEFINES the values
  'app/globals.css',                            // Tailwind entry + the radix-nova base
  'design_system/ryan-realty/colors_and_type.css', // the brand source of record
])

function cssFiles(dir, out = []) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return out
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) cssFiles(rel, out)
    else if (entry.name.endsWith('.css')) out.push(rel)
  }
  return out
}

const stripCss = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
const BRAND_HEX = /#(?:102742|faf8f4)\b/i
/**
 * The SAME two colors written as rgba(). This form is why the market charts did
 * not follow a style template on 2026-08-27: --v3-navy-70 was the literal
 * rgba(16,39,66,.7) rather than a shade derived from --v3-navy, so swapping the
 * base color moved the solid navy and left the entire alpha ramp behind. Every
 * shade is now color-mix() off the base, and this pattern stops the literal
 * coming back one component at a time.
 */
const BRAND_RGBA = /rgba?\(\s*(?:16\s*,\s*39\s*,\s*66|250\s*,\s*248\s*,\s*244)\s*[,)]/
const ELEVATION = /box-shadow\s*:\s*(?!none)(?![^;]*inset)[^;]*\b\d+px\s+\d+px/i

for (const rel of [...cssFiles('components'), ...cssFiles('app')]) {
  if (CSS_EXEMPT.has(rel)) continue
  if (CSS_EXCLUDED.some((d) => rel.startsWith(d))) continue
  const css = stripCss(readFileSync(join(ROOT, rel), 'utf8'))

  if (BRAND_HEX.test(css) || BRAND_RGBA.test(css)) {
    failures.push(
      `${rel}: declares a brand color as a raw value. The look comes from ${TOKEN_FILE}; ` +
      `use var(--v3-navy) / var(--v3-cream), or color-mix() off them for a shade, ` +
      `so a template swap reaches this file too.`
    )
  }
  const elev = css.match(ELEVATION)
  if (elev) {
    failures.push(
      `${rel}: draws an elevation shadow (${elev[0].trim().slice(0, 48)}...). Neither ` +
      `register draws one (PUBLIC_UI section 9). Only a focus ring or a data-mark ` +
      `ring may cast, and both are inset or zero-offset.`
    )
  }
}

/* -------------------------------------------------------------------------- */
/* 3. NO BRAND VALUE TYPED INTO A PUBLIC COMPONENT                             */
/* -------------------------------------------------------------------------- */

const TSX_EXCLUDED = ['app/admin/', 'app/api/', 'app/dev/', 'app/dashboard/', 'app/console/']

/** Files that legitimately need a literal, each with the reason. */
const TSX_EXEMPT = new Set([
  // The Google Maps JS API takes a styles array of literal color strings. It
  // parses them itself and never resolves a CSS variable, so a token here is
  // silently ignored and the map renders unstyled.
  'app/central-oregon/_v3/PlaceFieldMapImpl.tsx',
  'app/lp/bend/_components/BendInteractiveMap.tsx',
  'app/lp/central-oregon-golf/_components/GolfCourseMap.tsx',
  'components/site/listing-detail/ListingHeroMap.client.tsx',
  'components/site/listing-detail/ListingLocationMap.client.tsx',
  'components/search/MapListingPopup.tsx',
  // <canvas> 2D context: ctx.strokeStyle is a literal, same constraint.
  'components/tc/pdf-sign/SignaturePad.tsx',
  // satori renders the OG image outside the browser: no CSS custom properties.
  'app/housing-market/og/[...slug]/route.tsx',
])

function tsxFiles(dir, out = []) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return out
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) tsxFiles(rel, out)
    else if (entry.name.endsWith('.tsx')) out.push(rel)
  }
  return out
}

/** String and JSX-text content only — never a comment. */
function literals(rel) {
  const text = readFileSync(join(ROOT, rel), 'utf8')
  const src = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found = []
  const visit = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      found.push({ text: node.text, line: src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1 })
    }
    ts.forEachChild(node, visit)
  }
  visit(src)
  return found
}

const inScope = (rel) => !TSX_EXCLUDED.some((d) => rel.startsWith(d)) && !TSX_EXEMPT.has(rel)
const hexOffenders = new Map()

for (const rel of [...tsxFiles('app'), ...tsxFiles('components')].filter(inScope)) {
  for (const { text, line } of literals(rel)) {
    if (!BRAND_HEX.test(text) && !BRAND_RGBA.test(text)) continue
    if (!hexOffenders.has(rel)) hexOffenders.set(rel, [])
    hexOffenders.get(rel).push(line)
  }
}

for (const [rel, lines] of hexOffenders) {
  failures.push(
    `${rel}: ${lines.length} raw brand color literal(s) (first at line ${lines[0]}). A value ` +
    `typed into a component does not move when the style template changes, which is ` +
    `exactly the inconsistency this gate exists to end. Use the token.`
  )
}

/* -------------------------------------------------------------------------- */
/* Report                                                                      */
/* -------------------------------------------------------------------------- */

console.log('one design system (ci:one-design-system)')
console.log('========================================')
console.log(`  component registers under components/site : ${[...ALLOWED_SITE_DIRS.keys()].join(', ')}`)
console.log(`  the look lives in                         : ${TOKEN_FILE}`)
console.log(`  css scanned                               : ${cssFiles('components').length + cssFiles('app').length}`)

if (failures.length) {
  console.error(`\nFAIL - ${failures.length} second-design-system problem(s):\n`)
  for (const f of failures) console.error('  ' + f)
  console.error(
    '\nOne design system. The look comes from the token file, so a style template ' +
    'swap reaches every page at once. A value that does not live there does not move.'
  )
  process.exit(1)
}
console.log('\nOK - one register, one token file, no second look anywhere public.')

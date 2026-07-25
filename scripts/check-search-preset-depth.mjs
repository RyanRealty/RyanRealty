#!/usr/bin/env node
/**
 * check-search-preset-depth.mjs — ci:search-preset-depth (W3.2).
 *
 * The decision: the 3-segment {city}/{area}/{preset} search-matrix pages are
 * EMITTED to the sitemap (lib/seo/getSearchMatrixEntries.ts), so they must also
 * RENDER destination-page depth — editorial intro, preset-scoped FAQ + FAQPage
 * JSON-LD, cross-links — instead of a bare listing grid. Before W3.2,
 * `isPresetDepthPage` carried a `!subdivision` conjunct, so every emitted
 * 3-segment URL shipped thin.
 *
 * Re-opening that hole is one deleted character, and the symptom (thin indexed
 * pages) is invisible in code review and in the browser unless you happen to
 * load a 3-segment URL. Hence a gate.
 *
 * But the DANGEROUS half of this change is data accuracy, not SEO. On a
 * 3-segment page `totalCount` is scoped to the AREA. The depth copy therefore
 * has to name the AREA, while the city-level market-pulse stats stay labeled as
 * city-wide. Both directions are a CLAUDE.md §0 violation:
 *
 *   - naming the CITY next to an area-scoped count  → true number, wrong place
 *   - naming the AREA next to city-wide pulse stats → city median presented as
 *     the subdivision's own median (a per-segment median does not exist)
 *
 * So this gate pins BOTH, structurally (AST — a comment or string mention can
 * never satisfy it; docs: reference_code_inspecting_gates_use_ast):
 *
 *   PAGE (app/search/[...slug]/page.tsx)
 *     1. `isPresetDepthPage` does NOT contain a `!subdivision` conjunct.
 *     2. `buildPresetFaq(...)` is called with the 5th (area-scope) argument,
 *        and it is not a literal null/undefined — otherwise the copy silently
 *        reverts to city-naming on area pages.
 *     3. `getAdjacentPriceBandLinks(...)` is called with its 3rd (area) argument
 *        so neighbor price bands stay inside the subdivision.
 *
 *   COPY (lib/site/preset-faq.ts)
 *     4. buildPresetFaq resolves a `place` binding.
 *     5. NO segment-level sentence (a template containing "right now")
 *        references `city` — those are the count sentences.
 *     6. At least two such sentences reference `place` (they are actually
 *        place-scoped, not just city-free).
 *     7. The city-wide context sentences ("as a whole" / "Across all of" /
 *        "City-wide") DO still reference `city` — the over-correction guard.
 *     8. `faqTitle` is built from `place`.
 *
 * Exit: 0 = 3-segment depth renders and is §0-scoped. 1 = otherwise.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const PAGE_FILE = 'app/search/[...slug]/page.tsx'
const COPY_FILE = 'lib/site/preset-faq.ts'
const problems = []

function parse(rel) {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) {
    problems.push(`${rel}: file not found`)
    return null
  }
  const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(rel, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, kind)
}

/** Every CallExpression whose callee is `name` (bare or member call). */
function callsTo(sf, name) {
  const out = []
  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const c = n.expression
      if ((ts.isIdentifier(c) && c.text === name) || (ts.isPropertyAccessExpression(c) && c.name.text === name)) {
        out.push(n)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

/** The initializer of `const <name> = ...`, or null. */
function declInit(sf, name) {
  let found = null
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && n.initializer) {
      found = n.initializer
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return found
}

/** The FunctionDeclaration named `name`, or null. */
function funcDecl(sf, name) {
  let found = null
  const visit = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) found = n
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return found
}

/** True if `!<ident>` appears anywhere inside `node`. */
function hasNegatedIdentifier(node, ident) {
  let found = false
  const visit = (n) => {
    if (
      ts.isPrefixUnaryExpression(n) &&
      n.operator === ts.SyntaxKind.ExclamationToken &&
      ts.isIdentifier(n.operand) &&
      n.operand.text === ident
    ) {
      found = true
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

/** Identifier names referenced anywhere inside `node`. */
function identifiersIn(node) {
  const names = new Set()
  const visit = (n) => {
    if (ts.isIdentifier(n)) names.add(n.text)
    ts.forEachChild(n, visit)
  }
  visit(node)
  return names
}

/** Every TemplateExpression / NoSubstitutionTemplateLiteral inside `node`. */
function templatesIn(node) {
  const out = []
  const visit = (n) => {
    if (ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n)
    ts.forEachChild(n, visit)
  }
  visit(node)
  return out
}

/** True if `decl` declares a variable named `name` in its body. */
function declaresBinding(decl, name) {
  let found = false
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) found = true
    ts.forEachChild(n, visit)
  }
  visit(decl)
  return found
}

/**
 * True if `target` is DERIVED (transitively) from `seed` inside `decl`.
 *
 * Declaring a binding called `place` is not enough — an adversarial edit that
 * kept the name but re-pointed it (`const place = city`) left every `${place}`
 * reference intact and silently reverted area pages to city-naming while the
 * name-only assertion stayed green. This traces the assignment graph instead.
 */
function derivesFrom(decl, target, seed) {
  const derived = new Set([seed])
  // Fixed-point: re-walk until no new binding joins the derived set, so order
  // of declaration inside the function body does not matter.
  for (let pass = 0; pass < 8; pass++) {
    const before = derived.size
    const visit = (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
        for (const id of identifiersIn(n.initializer)) {
          if (derived.has(id)) {
            derived.add(n.name.text)
            break
          }
        }
      }
      ts.forEachChild(n, visit)
    }
    visit(decl)
    if (derived.size === before) break
  }
  return derived.has(target)
}

// ── PAGE ────────────────────────────────────────────────────────────────────
const page = parse(PAGE_FILE)
if (page) {
  // 1. depth is not withheld from 3-segment pages
  const depthInit = declInit(page, 'isPresetDepthPage')
  if (!depthInit) {
    problems.push(`${PAGE_FILE}: no \`isPresetDepthPage\` declaration found (W3.2 depth gating is missing)`)
  } else if (hasNegatedIdentifier(depthInit, 'subdivision')) {
    problems.push(
      `${PAGE_FILE}: \`isPresetDepthPage\` excludes subdivision pages (\`!subdivision\`). ` +
        `The 3-segment {city}/{area}/{preset} URLs are emitted to the sitemap, so they must render depth, not a bare grid (W3.2).`,
    )
  }

  // 2. the area scope is threaded into the copy builder
  const faqCalls = callsTo(page, 'buildPresetFaq')
  if (faqCalls.length === 0) {
    problems.push(`${PAGE_FILE}: buildPresetFaq(...) is never called — no preset depth renders`)
  }
  for (const call of faqCalls) {
    const arg = call.arguments[4]
    if (!arg) {
      problems.push(
        `${PAGE_FILE}: buildPresetFaq(...) called without the 5th area-scope argument. ` +
          `On a 3-segment page totalCount is AREA-scoped, so the copy would name the city beside an area count (CLAUDE.md §0).`,
      )
    } else if (
      arg.kind === ts.SyntaxKind.NullKeyword ||
      (ts.isIdentifier(arg) && arg.text === 'undefined')
    ) {
      problems.push(
        `${PAGE_FILE}: buildPresetFaq(...) passes a literal ${arg.getText()} as the area scope — ` +
          `area pages would silently fall back to city-naming (CLAUDE.md §0).`,
      )
    }
  }

  // 3. neighbor price bands stay inside the subdivision
  const bandCalls = callsTo(page, 'getAdjacentPriceBandLinks')
  if (bandCalls.length === 0) {
    problems.push(`${PAGE_FILE}: getAdjacentPriceBandLinks(...) is never called`)
  }
  for (const call of bandCalls) {
    if (!call.arguments[2]) {
      problems.push(
        `${PAGE_FILE}: getAdjacentPriceBandLinks(...) called without its 3rd \`area\` argument — ` +
          `neighbor price bands would drop the subdivision segment and jump to the whole city (W3.2).`,
      )
    }
  }
}

// ── COPY ────────────────────────────────────────────────────────────────────
const copy = parse(COPY_FILE)
if (copy) {
  const fn = funcDecl(copy, 'buildPresetFaq')
  if (!fn) {
    problems.push(`${COPY_FILE}: no \`buildPresetFaq\` function declaration found`)
  } else {
    // 4. the resolved place binding exists AND actually comes from the area param
    if (!declaresBinding(fn, 'place')) {
      problems.push(
        `${COPY_FILE}: buildPresetFaq does not resolve a \`place\` binding. ` +
          `Segment-level copy must name the area it counts, not the city (CLAUDE.md §0).`,
      )
    } else if (!derivesFrom(fn, 'place', 'areaLabel')) {
      problems.push(
        `${COPY_FILE}: \`place\` is not derived from the \`areaLabel\` parameter. ` +
          `A \`place\` that does not trace back to the area scope renders city names beside area-scoped counts ` +
          `while every \${place} reference still looks correct (CLAUDE.md §0).`,
      )
    }

    const templates = templatesIn(fn)
    let placeScopedCount = 0
    let cityLabeledContext = 0

    for (const tpl of templates) {
      const text = tpl.getText()
      const idents = identifiersIn(tpl)

      // 5 + 6. count sentences ("right now") are place-scoped, never city-scoped
      if (text.includes('right now')) {
        if (idents.has('city')) {
          problems.push(
            `${COPY_FILE}: a segment-level count sentence references \`city\`: ${text.slice(0, 90)}… ` +
              `On a 3-segment page the count is AREA-scoped — naming the city puts a true number beside the wrong place (CLAUDE.md §0).`,
          )
        }
        if (idents.has('place')) placeScopedCount++
      }

      // 7. over-correction guard: city-wide stats must stay labeled city-wide
      if (text.includes('as a whole') || text.includes('Across all of') || text.includes('City-wide')) {
        if (!idents.has('city')) {
          problems.push(
            `${COPY_FILE}: a city-wide context sentence no longer references \`city\`: ${text.slice(0, 90)}… ` +
              `Market-pulse stats are city-level; labeling them with the area would present a city median as the subdivision's own (CLAUDE.md §0).`,
          )
        } else {
          cityLabeledContext++
        }
      }
    }

    if (placeScopedCount < 2) {
      problems.push(
        `${COPY_FILE}: expected at least 2 place-scoped count sentences referencing \`place\`, found ${placeScopedCount}. ` +
          `The intro and the count FAQ must both name the place the count covers (W3.2).`,
      )
    }
    if (cityLabeledContext < 1) {
      problems.push(
        `${COPY_FILE}: no city-wide-labeled context sentence found. ` +
          `City pulse stats must be explicitly labeled as city-wide on area pages (CLAUDE.md §0).`,
      )
    }

    // 8. the FAQ heading follows the same scope
    let faqTitleOk = false
    const visitTitle = (n) => {
      if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === 'faqTitle') {
        if (identifiersIn(n.initializer).has('place')) faqTitleOk = true
      }
      ts.forEachChild(n, visitTitle)
    }
    visitTitle(fn)
    if (!faqTitleOk) {
      problems.push(
        `${COPY_FILE}: \`faqTitle\` is not built from \`place\` — the FAQ heading would name the city on an area page (W3.2).`,
      )
    }
  }
}

// ── report ──────────────────────────────────────────────────────────────────
console.log('Search preset depth gate (ci:search-preset-depth)')
console.log('=================================================')
if (problems.length) {
  console.error('\nProblems:')
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(
    `\n\x1b[31m✗ ci:search-preset-depth: ${problems.length} problem(s). ` +
      `3-segment {city}/{area}/{preset} pages must render depth AND name the place their count actually covers.\x1b[0m`,
  )
  process.exit(1)
}
console.log('✓ 3-segment preset pages render depth; segment copy is area-scoped and city context stays labeled city-wide.')
process.exit(0)

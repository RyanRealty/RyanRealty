#!/usr/bin/env node
/**
 * check-chart-sample-window.mjs — ci:chart-sample-window (§0).
 *
 * A sample size drawn beside a figure is a claim: "this is how many rows that
 * number came from." A rank chart carrying the wrong one is worse than a rank
 * chart carrying none, because it tells the reader a cross-row comparison is
 * safe when it is not.
 *
 * WHAT THIS GATE EXISTS BECAUSE OF. An earlier attempt at the same defect drew
 * `market_pulse_live.sold_count_30d` beside `median_days_to_pending`. The
 * median is computed over closings in the last NINETY days that carry a
 * list-to-pending measurement; the count is a THIRTY-day closing count. Live
 * 2026-08-19: Culver 1 vs 5 · Powell Butte 3 vs 15 · Black Butte Ranch 2 vs 9 ·
 * Sunriver 5 vs 30 · Bend 163 vs 490 · Redmond 31 vs 149. Every row understated
 * its own sample three- to fivefold, and the "small sample" flag then fired on
 * rows that sat at or above the cache's own publication floor.
 *
 * The same trap is one column over: `price_reduction_share` divides by actives
 * PLUS coming-soon PLUS active-under-contract, while `active_count` counts only
 * actives and coming soon. Bend's published 6.65% is 32 of 481; the row
 * publishes 471.
 *
 * THE RULE. A count may be drawn beside a figure only when it is THE population
 * THAT figure was computed over. When the true population is not published,
 * nothing is drawn (CLAUDE.md §0 rule 7) and the card's trace states the window
 * and the floor instead.
 *
 * MECHANISM. AST (typescript compiler) over every source file that builds a
 * V3Chart range row. For each object literal carrying `sample:`, the gate walks
 * out to the enclosing top-level builder — one builder is one figure — and
 * requires:
 *   1. the builder references a FIGURE registered below;
 *   2. that figure has a published population (not `null`);
 *   3. every identifier inside the `sample` initializer is that population
 *      token — a bare literal, a different window's count, or another figure's
 *      population all fail;
 *   4. a dumbbell row (`baseValue`) also carries `baseN`, so half a pair is
 *      never disclosed as if it were the whole;
 *   5. the builder sets `sampleKey`, which names what the n counted.
 * It also asserts the atom's own runtime refusal is still in place, so the
 * enforcement cannot be deleted from under the registry.
 *
 * Exit 0 = no chart draws a count from a window its figure did not use.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SCAN_ROOTS = ['app', 'components', 'lib']
const ATOM = 'components/site/v3/V3Chart.tsx'

/**
 * The population contract, one row per figure a range chart draws.
 *
 * key    an identifier that names the FIGURE (a DB column, an RPC output
 *        field, or the mapped property a builder reads it through).
 * value  the ONE identifier that names the rows that figure was computed
 *        over, or `null` when no such count is published — in which case no
 *        sample may be drawn at all.
 *
 * Every entry below was checked against the shipped SQL on 2026-08-19, not
 * against a migration file: `refresh_market_pulse`, `city_year_pricing`,
 * `city_quarter_sale_to_ask`, `compute_and_cache_period_stats`, and the
 * `neighborhood_year_pricing_mv` definition. Adding a row here means opening
 * the function that writes the figure and confirming the count comes off the
 * same rows with no further filter.
 */
const POPULATION = {
  // market_pulse_live. actives / (closings in 180 days / 6). The row publishes
  // the actives and closing counts for 30 and 90 days — never the 180-day
  // denominator. Half a ratio is not the ratio's population.
  months_of_supply: null,
  // market_pulse_live. Median over closings in the last 90 days carrying a
  // list-to-pending value, withheld under five of them. That count is not a
  // column; sold_count_90d is a superset of it, sold_count_30d another window.
  median_days_to_pending: null,
  // market_pulse_live. Denominator includes active-under-contract; the
  // published active_count does not.
  price_reduction_share: null,

  // city_quarter_sale_to_ask: count(*) and percentile_cont over the same
  // grouped rows, sale_to_original filtered in the WHERE, no FILTER on the
  // percentile. The count IS the median's population, per side of the pair.
  currentMedian: 'currentClosings',
  priorMedian: 'priorClosings',

  // city_year_pricing and neighborhood_year_pricing_mv: count(*) and the
  // close-price percentile over the same group, no FILTER. (median_ppsf and
  // median_days_to_offer in city_year_pricing DO carry FILTERs, so `closings`
  // is not their population — they are absent from this registry on purpose.)
  medianClose: 'closings',

  // market_stats_cache: sold_count is COUNT(*) over the closed_sales CTE and
  // median_sale_price is percentile_cont over the same CTE. The writer's own
  // methodology stamp calls sold_count that row's sample_size.
  medianSalePrice: 'soldCount',

  // Bend district public inventory: the median is taken over the listings with
  // a usable price, which rollupNeighborhoodPublicInventory counts separately
  // from activeCount precisely so this gate has a true population to point at.
  medianListPrice: 'pricedCount',
}

const problems = []

function walk(dir, out) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name)
    if (rel.includes('node_modules') || rel.includes('.next')) continue
    if (statSync(join(ROOT, rel)).isDirectory()) {
      walk(rel, out)
      continue
    }
    if (!/\.(ts|tsx)$/.test(name)) continue
    // Tests render fixtures into a string, never to a visitor. The atom's own
    // locks deliberately build samples with no data source behind them, and
    // holding a fixture to the population registry would say a chart is wrong
    // when nothing is published at all. Every file that DOES reach a page is
    // still scanned — proven by feeding this gate the wrong count in each of
    // the four real chart-data modules.
    if (/\.test\.tsx?$|__tests__/.test(rel)) continue
    out.push(rel)
  }
  return out
}

/** Every identifier and property name mentioned inside a node. */
function tokensIn(node) {
  const found = new Set()
  const visit = (n) => {
    if (ts.isIdentifier(n)) found.add(n.text)
    else if (ts.isStringLiteral(n)) found.add(n.text)
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

/** The outermost function-like ancestor — one builder, one figure. */
function enclosingBuilder(node) {
  let best = null
  for (let p = node.parent; p; p = p.parent) {
    if (
      ts.isFunctionDeclaration(p) ||
      ts.isFunctionExpression(p) ||
      ts.isArrowFunction(p) ||
      ts.isMethodDeclaration(p)
    ) {
      best = p
    }
  }
  return best
}

function builderName(fn, src) {
  if (fn && ts.isFunctionDeclaration(fn) && fn.name) return fn.name.text
  let p = fn?.parent
  while (p) {
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text
    p = p.parent
  }
  return '(anonymous builder)'
}

function propNamed(objectLiteral, name) {
  for (const prop of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null
    if (key === name) return prop
  }
  return null
}

function scanFile(rel) {
  const src = readFileSync(join(ROOT, rel), 'utf8')
  if (!/\bsample\s*:/.test(src)) return
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1

  const visit = (node) => {
    ts.forEachChild(node, visit)
    if (!ts.isObjectLiteralExpression(node)) return
    const sample = propNamed(node, 'sample')
    if (!sample) return
    // A V3Chart RANGE ROW, not any object that happens to hold a `sample`
    // property (lib/newsletter and the FSBO/expired processors each carry an
    // unrelated one). The row shape is what identifies it: tick + value.
    const isRangeRow = propNamed(node, 'tick') != null && propNamed(node, 'value') != null
    if (!isRangeRow) return

    const at = `${rel}:${line(sample)}`
    // The registry can only read a count it can see. A sample built by a helper
    // call, or folded in behind a spread, is a population claim this gate cannot
    // check — and silently skipping it would let any wrong count through by
    // changing shape. Refuse the shape instead (CLAUDE.md §6: a gate that
    // cannot fail is not a gate).
    const init = sample.initializer
    if (!ts.isObjectLiteralExpression(init)) {
      problems.push(
        `${at}: this range row's \`sample\` is not an object literal, so the population it ` +
          `claims cannot be read here. Write \`sample: { n: <the count> }\` inline in the ` +
          `builder that computes the figure.`,
      )
      return
    }
    if (!propNamed(init, 'n')) {
      problems.push(
        `${at}: this range row's \`sample\` has no literal \`n:\` property — a spread or a ` +
          `computed key hides which count is being drawn. Name the count inline.`,
      )
      return
    }

    const fn = enclosingBuilder(sample)
    if (!fn) {
      problems.push(`${at}: a chart sample sits outside any function, so this gate cannot tell which figure it belongs to.`)
      return
    }
    const name = builderName(fn, src)
    const fnTokens = tokensIn(fn)

    // 5. The n must be named.
    if (!fnTokens.has('sampleKey')) {
      problems.push(
        `${at}: ${name} draws a sample but never sets \`sampleKey\`. A bare n names no ` +
          `population — say what it counted, in the same builder.`,
      )
    }

    // 4. Half a dumbbell is not a disclosure.
    if (propNamed(node, 'baseValue') && !propNamed(init, 'baseN')) {
      problems.push(
        `${at}: ${name} builds a dumbbell row (it sets \`baseValue\`) but its sample has no ` +
          `\`baseN\`. The prior figure then shows a value with no sample beside it while the ` +
          `current one shows both, which reads as if the pair rests on one count.`,
      )
    }

    // 1–2. Which figure is this builder about, and is its population published?
    const figures = Object.keys(POPULATION).filter((f) => fnTokens.has(f))
    if (figures.length === 0) {
      problems.push(
        `${at}: ${name} draws a sample, but references no figure this gate knows. Add the ` +
          `figure to POPULATION in ${'scripts/check-chart-sample-window.mjs'} — after opening ` +
          `the SQL that writes it and confirming which count comes off the same rows.`,
      )
      return
    }
    const withheld = figures.filter((f) => POPULATION[f] === null)
    if (withheld.length > 0) {
      problems.push(
        `${at}: ${name} draws a sample beside ${withheld.join(', ')}, whose population is NOT ` +
          `published. Every count on that row is from a different window or a different filter, ` +
          `so drawing one overstates how sturdy the figure is. Draw nothing and let the card's ` +
          `trace state the window and the floor (CLAUDE.md §0 rule 7).`,
      )
      return
    }

    // 3. The counts inside the sample must be the registered populations.
    const allowed = new Set(figures.map((f) => POPULATION[f]))
    const foreign = new Set(
      Object.values(POPULATION).filter((p) => p != null && !allowed.has(p)),
    )
    const sampleTokens = tokensIn(init)
    const cited = [...sampleTokens].filter((t) => allowed.has(t))
    if (cited.length === 0) {
      problems.push(
        `${at}: ${name}'s sample cites none of [${[...allowed].join(', ')}] — the population(s) ` +
          `${figures.join(', ')} was computed over. A count that is not that population is a ` +
          `claim about a different set of rows.`,
      )
    }
    for (const t of sampleTokens) {
      if (foreign.has(t)) {
        problems.push(
          `${at}: ${name}'s sample cites \`${t}\`, which is another figure's population, not ` +
            `${figures.join(', ')}'s.`,
        )
      }
    }
  }
  visit(sf)
}

/** The registry only binds while the atom still refuses an unnamed count. */
function checkAtomRefusal() {
  if (!existsSync(join(ROOT, ATOM))) {
    problems.push(
      `${ATOM} is missing, so nothing enforces that a drawn sample is named at runtime. ` +
        `Repoint this gate at the replacement atom and re-express the refusal there.`,
    )
    return
  }
  const atom = readFileSync(join(ROOT, ATOM), 'utf8').replace(/\s+/g, ' ')
  if (!/sample.*but the chart has no `sampleKey`/.test(atom) || !/throw new Error\(/.test(atom)) {
    problems.push(
      `${ATOM}: the runtime refusal for a sample with no sampleKey is gone. The atom must ` +
        `still throw, so a surface cannot draw an unnamed count by skipping this gate's files.`,
    )
  }
  if (!/sampleN/.test(atom)) {
    problems.push(`${ATOM}: no sampleN plumbing — the sample is no longer drawn by the atom.`)
  }
}

const files = []
for (const top of SCAN_ROOTS) if (existsSync(join(ROOT, top))) walk(top, files)
for (const rel of files) scanFile(rel)
checkAtomRefusal()

console.log('Chart sample windows (ci:chart-sample-window)')
console.log('=============================================')
console.log(`  scanned ${files.length} source files · ${Object.keys(POPULATION).length} registered figures`)
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:chart-sample-window: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ Every drawn sample is the population its figure was computed over.')
process.exit(0)

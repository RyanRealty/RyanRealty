/**
 * PATTERN 11: CENSUS. One place, counted several true ways, on one sheet.
 *
 * WHY AN ELEVENTH PATTERN (site queue SITE-116 round 3, 2026-09-16). The
 * community page prints several inventory figures that are all correct and
 * all different, because each one counts a different population over a
 * different window: the Atlas key counts every property type inside the
 * recorded boundary ("25 for sale · 4 pending"), the homes list counts every
 * active listing the MLS files under the community's names inside its map
 * frame ("26 homes on this map"), and the alerts figure counts detached
 * houses that came on in the last thirty days ("1 house"). The separate
 * evaluator read them as three totals for one place and marked the page
 * BLOCKING: "a visitor cannot tell which number is actually Tetherow".
 *
 * §0 rule 5 forbids the easy fix. The numbers are not changed to agree; each
 * one is right about what it counts. What was missing is the sentence that
 * says so, in one place, in one vocabulary. This sheet is that sentence as a
 * table: one row per figure, the figure in the display face, and three
 * scope cells beside it — WHAT is counted, WHERE, and WHEN — so a reader sees
 * that "every property type inside the boundary, right now" and "detached
 * houses whose membership is Tetherow, in the last thirty days" are two
 * questions with two answers, not one question with a bug.
 *
 * THE FORM IS A TABLE, on purpose. TASTE.md lists it among the house forms a
 * data section may take when no catalog job fits, and a comparison of like
 * columns across unlike rows is exactly what a table is for. It is not a KPI
 * grid: no cell is a number without its sentence, and the three scope columns
 * are the point rather than decoration. On a phone the columns stack inside
 * each row with their labels, so nothing is lost at 375.
 *
 * WHAT IT OWES (§0). Every row arrives PREFORMATTED and SOURCED: the figure
 * as a string the caller formatted, and a trace naming the read, the filter
 * and the window. The disclosure at the foot prints every row's trace, so the
 * table can be audited line by line. This primitive never derives a number
 * from another; it prints what it is handed, or nothing.
 *
 * Barrel law honored here:
 *  - Imports only ./atoms, ./tokens.css, next/link and @/lib/utils.
 *  - No 'use client'. Pure server component: no state, no effects, no hooks.
 *  - Every color, size, rule and duration comes from ./tokens.css.
 *  - A row's door is `--v3-tap` tall (WCAG 2.5.8).
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3Eyebrow, V3Heading, V3Lede, V3SourceDisclosure, V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3Census.css'

/** One figure on the sheet, with the three words that scope it. */
export type V3CensusRow = {
  /** Stable React key. */
  key: string
  /** The figure, formatted by the caller: "25", "1,204". */
  figure: string
  /** What the figure counts, as the noun after it: "for sale", "houses sold". */
  noun: string
  /** WHAT is counted: "Every property type" / "Detached houses only". */
  what: string
  /** WHERE: "inside the recorded boundary" / "filed under Tetherow's MLS names". */
  where: string
  /** WHEN: "right now" / "in the last 30 days". */
  when: string
  /** The section on this page where the figure lives, as an in-page door. */
  href?: string
  /** The door's visible words. Required when `href` is set. */
  hrefLabel?: string
  /** The §0 trace for THIS figure: read, filter, window. */
  source: string
}

export type V3CensusProps = {
  id: string
  /** The uppercase context line. */
  eyebrow?: string
  /** The section's visible title and its accessible name. */
  heading: string
  /** One plain sentence: why these figures differ. */
  lede?: string
  rows: readonly V3CensusRow[]
  /** The three column heads, in the reader's words. Defaults: What · Where · When. */
  columns?: { what: string; where: string; when: string }
  /** Names the source for the disclosure's compact clause. */
  sourceName?: string | null
  /** The as-of stamp for the compact clause, already formatted by the caller. */
  asOf?: string | null
  className?: string
}

function trimmed(value: string | null | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

/**
 * Drops what cannot render honestly. A row with no figure or no noun is not a
 * count; a row missing a scope cell would print a column with a hole in it,
 * which is the ambiguity this sheet exists to end. A door needs both halves.
 */
export function censusRows(rows: readonly V3CensusRow[]): V3CensusRow[] {
  const seen = new Set<string>()
  const out: V3CensusRow[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const key = trimmed(row.key)
    const figure = trimmed(row.figure)
    const noun = trimmed(row.noun)
    const what = trimmed(row.what)
    const where = trimmed(row.where)
    const when = trimmed(row.when)
    const source = trimmed(row.source)
    if (!key || !figure || !noun || !what || !where || !when || !source) continue
    if (seen.has(key)) continue
    seen.add(key)
    const href = trimmed(row.href)
    const hrefLabel = trimmed(row.hrefLabel)
    out.push({
      key,
      figure,
      noun,
      what,
      where,
      when,
      source,
      ...(href && hrefLabel ? { href, hrefLabel } : {}),
    })
  }
  return out
}

const DEFAULT_COLUMNS = { what: 'What', where: 'Where', when: 'When' }

export function V3Census({
  id,
  eyebrow,
  heading,
  lede,
  rows,
  columns = DEFAULT_COLUMNS,
  sourceName,
  asOf,
  className,
}: V3CensusProps) {
  const sheet = censusRows(rows)
  // One figure is not a census. A sheet exists to reconcile counts that
  // differ; with fewer than two there is nothing to reconcile, and a heading
  // over a single row would be a KPI tile wearing a table.
  if (sheet.length < 2) return null
  const title = trimmed(heading)
  if (!title) return null

  const headingId = `${id}-heading`
  const contextLine = trimmed(eyebrow)
  const claim = trimmed(lede)
  const trace = sheet.map((row) => `${row.figure} ${row.noun}: ${row.source}`).join(' ')
  const stamp = trimmed(asOf ?? undefined)
  const fullTrace = stamp ? `${trace} · updated ${stamp}` : trace

  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'v3-census', className)} aria-labelledby={headingId}>
      <div className="v3-census__head">
        {contextLine ? <V3Eyebrow>{contextLine}</V3Eyebrow> : null}
        <V3Heading level={2} id={headingId} className="v3-census__heading">
          {title}
        </V3Heading>
        {claim ? <V3Lede className="v3-census__lede">{claim}</V3Lede> : null}
      </div>

      <table className="v3-census__table">
        <thead className="v3-census__thead">
          <tr>
            <th scope="col" className="v3-census__th v3-census__th--figure">
              Count
            </th>
            <th scope="col" className="v3-census__th">
              {columns.what}
            </th>
            <th scope="col" className="v3-census__th">
              {columns.where}
            </th>
            <th scope="col" className="v3-census__th">
              {columns.when}
            </th>
            <th scope="col" className="v3-census__th v3-census__th--door">
              <span className="v3-census__sr">On this page</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sheet.map((row) => (
            <tr key={row.key} className="v3-census__row">
              <th scope="row" className="v3-census__figure-cell">
                <span className="v3-census__figure">{row.figure}</span>
                <span className="v3-census__noun">{row.noun}</span>
              </th>
              <td className="v3-census__cell" data-label={columns.what}>
                {row.what}
              </td>
              <td className="v3-census__cell" data-label={columns.where}>
                {row.where}
              </td>
              <td className="v3-census__cell" data-label={columns.when}>
                {row.when}
              </td>
              <td className="v3-census__cell v3-census__cell--door">
                {row.href && row.hrefLabel ? (
                  <Link className="v3-census__door" href={row.href}>
                    {row.hrefLabel}
                  </Link>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <V3SourceDisclosure source={fullTrace} sourceName={sourceName} className="v3-census__source" />
    </section>
  )
}

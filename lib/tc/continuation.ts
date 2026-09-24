/**
 * Text that does not fit a form's lined section continues on an addendum, the
 * way SkySlope Forms does it. Pure.
 *
 * Matt 2026-09-24: "If the text exceeds the character count, it will, by
 * default, automatically queue up a whole new addendum. It'll say 'continuing
 * from' and the form name, and then it will continue." His calls: the addendum
 * is the one the form itself names (the OR 2026 set attaches the 2.2 General
 * Addendum, the OREF set its 002 Addendum to Sale Agreement); it goes in the
 * same packet right after the form, signed by the same parties; it takes the
 * next addendum number on the file.
 *
 * SkySlope's markers, read off 24 of our own filed documents (OREF 001, 003,
 * 022A and the OR 2.5, across nine files):
 *   - where the source text runs out, inline:
 *       "(Continued: Addendum to Real Estate Agreement, paragraph 1)"
 *   - the addendum paragraph that carries the rest:
 *       "1. (From: Residential Real Estate Sale Agreement - 001 OREF, Page 9, additionalProvisionsGlobal)..."
 *   - an addendum that itself overflows continues as "paragraph 1.2".
 * Ours are the same, with two fixes: the marker names the addendum's number
 * (there can be several on a file), and the source is named by the section's
 * printed title, not SkySlope's internal field key.
 */
import { helveticaWidth, layoutAreaText, type AreaLayout, type LineSpace } from './text-areas'

export type ContinuationForm = { library: 'OREF' | 'OR'; formNumber: '002' | '2.2'; title: string }

const OREF_002: ContinuationForm = { library: 'OREF', formNumber: '002', title: 'Addendum' }
const OR_22: ContinuationForm = { library: 'OR', formNumber: '2.2', title: 'General Addendum' }

/** The addendum a form names for more room: its own set's general addendum. */
export function continuationFormFor(library: string | null | undefined): ContinuationForm {
  return (library ?? '').toUpperCase() === 'OR' ? OR_22 : OREF_002
}

/**
 * A section's title from a line's field name, when the printed page gives
 * none (lib/tc/area-reference.ts reads the page first): "28 ADDITIONAL
 * PROVISIONS describe" is "Additional Provisions". A field named "Text7.0" or
 * "311" says nothing, so there is no title.
 */
export function sectionName(label: string | null | undefined): string | null {
  const raw = (label ?? '').replace(/^[\s\d.]+/, '').replace(/[\s._\d]+$/, '').replace(/\b(describe|insert|if any|below|here)\b.*$/i, '').replace(/[^A-Za-z0-9 &'/-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (raw.length < 4 || /^text(\s*\d.*)?$/i.test(raw) || !/[a-z]{3}/i.test(raw)) return null
  const titled = raw
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && /^(and|or|of|the|to|a|an|as|for|in|on)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
  return titled.slice(0, 60)
}

/** The inline marker where the source text stops. */
export function continuedMarker(form: ContinuationForm, addendumNumber: number, paragraph: string): string {
  return `(Continued: ${form.title} No. ${addendumNumber}, paragraph ${paragraph})`
}

/** The opening of the addendum paragraph that carries the rest. */
export function fromLead(paragraph: string, source: { formName: string; page: number; section: string | null }): string {
  return `${paragraph}. (From: ${source.formName}, Page ${source.page}${source.section ? `, ${source.section}` : ''}) ...`
}

/**
 * Lay a source section's text so that, when it does not fit, its last line
 * ends with the marker and everything after it is the overflow.
 */
export function layoutWithMarker(text: string, space: readonly LineSpace[], size: number, marker: string): AreaLayout {
  const plain = layoutAreaText(text, space, size)
  if (!plain.overflow || !space.length) return plain
  const last = space.length - 1
  const markerW = helveticaWidth(` ${marker}`, size)
  const room = space[last].widthPts - markerW
  if (room < 24) {
    // No room beside the marker: the marker takes the last line alone.
    const r = layoutAreaText(text, space.slice(0, last), size)
    return { lines: [...r.lines, marker], size, overflow: r.overflow || plain.overflow }
  }
  const r = layoutAreaText(text, space.map((s, i) => (i === last ? { widthPts: room } : s)), size)
  const lines = r.lines.slice()
  lines[last] = lines[last] ? `${lines[last]} ${marker}` : marker
  return { lines, size, overflow: r.overflow }
}

export type SourceOverflow = {
  /** The source section (document id + area key), to put its marker back. */
  key: string
  formName: string
  page: number
  section: string | null
  text: string
}

export type ContinuationPage = { addendumNumber: number; lines: string[] }

export type ContinuationPlan = {
  pages: ContinuationPage[]
  /** Per source section: the addendum number and paragraph its text continues at. */
  starts: Record<string, { addendumNumber: number; paragraph: string }>
}

const lastUsed = (lines: readonly string[]) => {
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i]) return i + 1
  return 0
}

/**
 * The addendum pages for one document's overflows, in order: paragraph 1, 2 ...
 * one per source section, each starting on a new line. A paragraph that runs
 * past a page's last line ends with its own marker and goes on as 1.2, 1.3 on
 * the next addendum, which takes the next number.
 */
export function planContinuationPages(
  overflows: readonly SourceOverflow[],
  opts: { form: ContinuationForm; firstNumber: number; body: readonly LineSpace[]; size: number; maxPages?: number },
): ContinuationPlan {
  const { form, body, size } = opts
  const maxPages = opts.maxPages ?? 20
  const pages: ContinuationPage[] = []
  const starts: ContinuationPlan['starts'] = {}
  let page: string[] = []
  let used = 0
  const newPage = () => {
    if (page.length) pages.push({ addendumNumber: opts.firstNumber + pages.length, lines: page })
    page = body.map(() => '')
    used = 0
  }
  newPage()

  overflows.forEach((o, i) => {
    const id = `${i + 1}`
    let part = 1
    let text = o.text
    // A paragraph never starts on the last line alone: it would carry nothing.
    if (used >= body.length - 1) newPage()
    starts[o.key] = { addendumNumber: opts.firstNumber + pages.length, paragraph: id }
    for (;;) {
      const paragraph = part === 1 ? id : `${id}.${part}`
      const lead = fromLead(paragraph, o)
      const space = body.slice(used)
      const fit = layoutAreaText(`${lead}${text}`, space, size)
      if (!fit.overflow) {
        fit.lines.forEach((l, k) => (page[used + k] = l))
        used += lastUsed(fit.lines)
        return
      }
      if (pages.length + 1 >= maxPages) throw new Error(`continuation would need more than ${maxPages} addendum pages`)
      const nextPart = `${id}.${part + 1}`
      const split = layoutWithMarker(`${lead}${text}`, space, size, continuedMarker(form, opts.firstNumber + pages.length + 1, nextPart))
      split.lines.forEach((l, k) => (page[used + k] = l))
      newPage()
      text = split.overflow
      part++
    }
  })
  if (used > 0) pages.push({ addendumNumber: opts.firstNumber + pages.length, lines: page })
  return { pages, starts }
}

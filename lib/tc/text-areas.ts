/**
 * A lined section of a form is one text box. Pure; runs in the browser (the
 * composer's live preview) and on the server (the saved layout), with the same
 * font metrics the sealer draws with, so what the broker sees is what prints.
 *
 * Matt 2026-09-24: "when there's a multi-part form, it will automatically
 * include a text box that aligns the lines of text so it fits on each line. It
 * won't just be multiple text boxes for that section. If the text exceeds the
 * character count, it will, by default, automatically queue up a whole new
 * addendum." The forms store such a section as one AcroForm widget per
 * printed line (OREF 002 body Text7.0 ... Text7.18.1, OR 2.2 body, OREF 001
 * Additional Provisions). This finds those runs, lays text onto them line by
 * line, and returns what does not fit (lib/tc/continuation.ts carries it onto
 * a continuation addendum).
 */
import { HELVETICA_CHARS, HELVETICA_KERN, HELVETICA_WIDTHS } from './helvetica-metrics'
import { wrapTextToWidth } from './lined-signature-fields'

/** A field on a page, as fractions of the page, top-left origin (lib/tc/signing.ts). */
export type LineBox = { page: number; x: number; y: number; w: number; h: number }

export type TextArea<T extends LineBox = LineBox> = {
  /** Stable for the same form: page and the first line's position. */
  key: string
  page: number
  lines: T[]
}

// ── the font the sealer draws with (pdf-lib Helvetica, WinAnsi) ────────────
// Measured from lib/tc/helvetica-metrics.ts, generated from the font data
// pdf-lib draws with, so the browser does not load all fourteen standard fonts.

type Metrics = { width: Map<string, number>; kern: Map<string, number> }
let metrics: Metrics | null = null
function helvetica(): Metrics {
  if (metrics) return metrics
  const width = new Map<string, number>()
  Array.from(HELVETICA_CHARS).forEach((ch, i) => width.set(ch, HELVETICA_WIDTHS[i]))
  const kern = new Map<string, number>()
  for (const [left, rights, amounts] of HELVETICA_KERN) {
    Array.from(rights).forEach((right, i) => kern.set(left + right, amounts[i]))
  }
  return (metrics = { width, kern })
}

/** Text the sealer can draw: every character WinAnsi cannot encode becomes "?". */
export function pdfSafeText(s: string): string {
  const { width } = helvetica()
  let out = ''
  for (const ch of s.replace(/\r\n?/g, '\n')) out += ch === '\n' || width.has(ch) ? ch : '?'
  return out
}

/**
 * Width in points of `text` at `size`, exactly as pdf-lib's widthOfTextAtSize
 * (glyph widths plus kerning). A character the font cannot encode is measured
 * as the "?" the sealer prints in its place.
 */
export function helveticaWidth(text: string, size: number): number {
  const { width, kern } = helvetica()
  const chars = Array.from(text).map((ch) => (width.has(ch) ? ch : '?'))
  let total = 0
  for (let i = 0; i < chars.length; i++) {
    total += (width.get(chars[i]) ?? 250) + (kern.get(chars[i] + (chars[i + 1] ?? '')) ?? 0)
  }
  return (total * size) / 1000
}

/** The sealer's type size for a box this tall (points): lib/tc/seal-pdf.ts drawFieldValue. */
export function textSizeForBox(heightPts: number): number {
  return Math.max(7, Math.min(11, heightPts * 0.72))
}

/** The sealer's usable width for a box this wide (points): 2 pt padding each side. */
export const usableWidth = (widthPts: number) => Math.max(8, widthPts - 4)

/** The smallest type a typed value is printed in (points). */
export const MIN_BOX_TEXT_PT = 6

/**
 * A typed value in its box, as the sealer prints it: wrapped at the box's
 * width, at the largest size (from the box's own size down to 6 pt) at which
 * every line fits its height. `fits` false means even 6 pt runs past the box:
 * the editors refuse that, and the sealer still prints every word.
 */
export function fitTextToBox(text: string, widthPts: number, heightPts: number): { size: number; lines: string[]; fits: boolean } {
  const width = usableWidth(widthPts)
  const room = Math.max(1, heightPts - 1)
  // The lines as they print: a character the font cannot draw is its "?".
  const safe = pdfSafeText(text)
  for (let size = textSizeForBox(heightPts); ; size = Math.round((size - 0.5) * 10) / 10) {
    const lines = wrapTextToWidth(safe, width, (s) => helveticaWidth(s, size))
    const fits = lines.length <= 1 || lines.length * (size + 1.2) <= room + 1e-6
    if (fits || size - 0.5 < MIN_BOX_TEXT_PT) return { size, lines, fits }
  }
}

// ── finding a lined section ────────────────────────────────────────────────

const LINE_H_MAX = 0.022
const LINE_W_MIN = 0.25
/** Body lines are wide; only the first (after a printed label) and last (before a note) may be short. */
const BODY_W_MIN = 0.45
const PITCH_MIN = 0.008
const PITCH_MAX = 0.026
const EDGE = 0.03
/** A section is evenly ruled: every line the same height, the same distance apart. */
const HEIGHT_TOL = 0.004
const PITCH_TOL = 0.005

/**
 * Lines a person or a fact owns, never a paragraph: names, addresses, dates,
 * signatures. Matched on the form's own field name when it has one ("Buyer_4",
 * "Print_5", "Dated_3" count; "_" and digits are not letters). A party word
 * marks a fact line only in a short name: "8 SELLER CONTRIBUTIONS other
 * describe" is a paragraph.
 */
const FACT_LINE = /(?<![a-z])(address|phone|e-?mail|fax|print(ed)?|initials?|sign(ed|ature)?|dated?|licen[sc]e)(?![a-z])/i
const FACT_WORD = /(?<![a-z])(buyers?|sellers?|agents?|brokers?|firms?|names?|time|price|number|no\.)(?![a-z])|\$/i
function isFactLabel(label: string | null | undefined): boolean {
  if (!label) return false
  if (FACT_LINE.test(label)) return true
  const words = label.replace(/[_\d.#]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  return words.length <= 3 && FACT_WORD.test(label)
}

export type AreaCandidate = LineBox & { type?: string; label?: string | null; recipientId?: string | null }

/**
 * Runs of stacked printed lines on one page that read as one section: each
 * line below the last at a line's pitch, the right edges aligned (a first line
 * after a printed label starts further right) or the left edges aligned (a
 * last line may stop short), every line the same height and the same distance
 * apart, no line after the first starting further right or behind a printed
 * label of its own, two lines or more.
 */
export function findTextAreas<T extends AreaCandidate>(
  fields: readonly T[],
  /** Whether a line's printed row has its own label left of the box (lib/tc/area-reference.ts lineHasLabel). */
  labelled: (line: T) => boolean = () => false,
): Array<TextArea<T>> {
  const candidates = fields
    .filter((f) => (f.type ?? 'text') === 'text' && !f.recipientId && f.h <= LINE_H_MAX && f.w >= LINE_W_MIN && !isFactLabel(f.label))
    .slice()
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
  const areas: Array<TextArea<T>> = []
  let run: T[] = []
  const flush = () => {
    // Every line but the first and the last is a full body line.
    const body = run.slice(1, -1)
    if (run.length >= 2 && body.every((l) => l.w >= BODY_W_MIN) && run.some((l) => l.w >= BODY_W_MIN)) {
      const first = run[0]
      areas.push({ key: `p${first.page}:${first.y.toFixed(3)}`, page: first.page, lines: run })
    }
    run = []
  }
  for (const f of candidates) {
    const prev = run[run.length - 1]
    if (!prev) {
      run = [f]
      continue
    }
    const pitch = f.y - prev.y
    const sameRow = Math.abs(pitch) < PITCH_MIN
    const rightAligned = Math.abs(f.x + f.w - (prev.x + prev.w)) <= EDGE
    const leftAligned = Math.abs(f.x - prev.x) <= EDGE
    // A signature block alternates tall and short rows; a section does not.
    const even = Math.abs(f.h - prev.h) <= HEIGHT_TOL && (run.length < 2 || Math.abs(pitch - (run[1].y - run[0].y)) <= PITCH_TOL)
    // Only a section's first line follows a printed label: a line that starts
    // further right, or has words of its own before it, is the next field.
    const continues = f.x <= prev.x + EDGE && !labelled(f)
    // A second box on the same printed row (two names side by side) ends the run.
    if (!sameRow && f.page === prev.page && pitch >= PITCH_MIN && pitch <= PITCH_MAX && (rightAligned || leftAligned) && even && continues) {
      run.push(f)
      continue
    }
    flush()
    run = sameRow ? [] : [f]
  }
  flush()
  return areas
}

// ── laying text onto the lines ─────────────────────────────────────────────

export type LineSpace = { widthPts: number }

export type AreaLayout = {
  /** One string per line, '' for an empty line. */
  lines: string[]
  /** The type size every line is drawn at (the smallest box in the section). */
  size: number
  /** What did not fit, ready to continue elsewhere; '' when everything fits. */
  overflow: string
}

/**
 * Lay `text` onto the lines in order: words wrap at each line's own width, a
 * blank line in the text starts a new printed line, a word longer than a line
 * is split. Whatever is left after the last line is the overflow.
 */
export function layoutAreaText(text: string, space: readonly LineSpace[], size: number): AreaLayout {
  const lines = space.map(() => '')
  const measure = (s: string) => helveticaWidth(s, size)
  const paragraphs = pdfSafeText(text).split('\n').map((p) => p.replace(/[ \t]+/g, ' ').trim())
  // Trailing empty paragraphs carry nothing.
  while (paragraphs.length && !paragraphs[paragraphs.length - 1]) paragraphs.pop()

  let li = 0
  const fits = (s: string) => li < space.length && measure(s) <= usableWidth(space[li].widthPts)
  for (let pi = 0; pi < paragraphs.length; pi++) {
    if (li >= space.length) return { lines, size, overflow: paragraphs.slice(pi).join('\n') }
    const words = paragraphs[pi] ? paragraphs[pi].split(' ') : []
    let cur = ''
    for (let wi = 0; wi < words.length; wi++) {
      let word = words[wi]
      const next = cur ? `${cur} ${word}` : word
      if (fits(next)) {
        cur = next
        continue
      }
      if (cur) {
        lines[li++] = cur
        cur = ''
      }
      // A word too long for a whole line is split across lines.
      while (li < space.length && !fits(word)) {
        let chunk = ''
        for (const ch of word) {
          if (fits(chunk + ch)) chunk += ch
          else break
        }
        if (!chunk) break
        lines[li++] = chunk
        word = word.slice(chunk.length)
      }
      if (li >= space.length) {
        const rest = [word, ...words.slice(wi + 1)].filter(Boolean).join(' ')
        return { lines, size, overflow: [rest, ...paragraphs.slice(pi + 1)].join('\n').replace(/^\n+/, '') }
      }
      cur = word
    }
    // The paragraph ends: its last line is written and the next paragraph starts a new line.
    lines[li++] = cur
  }
  return { lines, size, overflow: '' }
}

/** The line widths and the one type size for an area on a page of this size (points). */
export function areaSpace(lines: ReadonlyArray<{ w: number; h: number }>, pageWidthPts: number, pageHeightPts: number): { space: LineSpace[]; size: number } {
  const space = lines.map((l) => ({ widthPts: l.w * pageWidthPts }))
  const size = Math.min(...lines.map((l) => textSizeForBox(l.h * pageHeightPts)))
  return { space, size: Number.isFinite(size) ? size : 9 }
}

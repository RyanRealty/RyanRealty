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
import { Encodings, Font, FontNames } from '@pdf-lib/standard-fonts'

/** A field on a page, as fractions of the page, top-left origin (lib/tc/signing.ts). */
export type LineBox = { page: number; x: number; y: number; w: number; h: number }

export type TextArea<T extends LineBox = LineBox> = {
  /** Stable for the same form: page and the first line's position. */
  key: string
  page: number
  lines: T[]
}

// ── the font the sealer draws with (pdf-lib Helvetica, WinAnsi) ────────────

let helvetica: ReturnType<typeof Font.load> | null = null
const font = () => (helvetica ??= Font.load(FontNames.Helvetica))
const winAnsi = Encodings.WinAnsi

/** Text the sealer can draw: every character WinAnsi cannot encode becomes "?". */
export function pdfSafeText(s: string): string {
  let out = ''
  for (const ch of s.replace(/\r\n?/g, '\n')) {
    const cp = ch.codePointAt(0) ?? 63
    out += ch === '\n' || winAnsi.canEncodeUnicodeCodePoint(cp) ? ch : '?'
  }
  return out
}

/** Width in points of `text` at `size`, exactly as pdf-lib's widthOfTextAtSize (glyph widths plus kerning). */
export function helveticaWidth(text: string, size: number): number {
  const f = font()
  const names = Array.from(text).map((ch) => winAnsi.encodeUnicodeCodePoint(ch.codePointAt(0) ?? 63).name)
  let total = 0
  for (let i = 0; i < names.length; i++) {
    total += (f.getWidthOfGlyph(names[i]) || 250) + (f.getXAxisKerningForPair(names[i], names[i + 1]) || 0)
  }
  return (total * size) / 1000
}

/** The sealer's type size for a box this tall (points): lib/tc/seal-pdf.ts drawFieldValue. */
export function textSizeForBox(heightPts: number): number {
  return Math.max(7, Math.min(11, heightPts * 0.72))
}

/** The sealer's usable width for a box this wide (points): 2 pt padding each side. */
export const usableWidth = (widthPts: number) => Math.max(8, widthPts - 4)

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

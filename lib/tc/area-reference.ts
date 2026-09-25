/**
 * Where a lined section sits on its printed form, read off the page itself:
 * the numbered heading it falls under and the form's printed line numbers.
 * Pure.
 *
 * The forms' own field names cannot say this. OREF 001 (01/2026) still names
 * its section 10 line "8 ADDITIONAL FINANCING PROVISIONS" and hangs "28
 * ADDITIONAL PROVISIONS" on the second line of section 29; most lines are just
 * "Text72". The printed page is the record, so the continuation addendum
 * cites it: "(From: Residential Real Estate Sale Agreement - 001 OREF, Page 9,
 * Section 29 Additional Provisions, lines 349-352) ...".
 */

/** A run of text on a page, as fractions of the page, y at the baseline from the top. */
export type TextRun = { str: string; x: number; y: number; w: number }

export type PageMarks = {
  /** The printed line numbers down the margin, at their baselines. */
  lineNumbers: Array<{ n: number; y: number }>
  /** Numbered headings ("29. ADDITIONAL PROVISIONS:"), at their baselines. */
  headings: Array<{ number: string; title: string; y: number }>
  /** Every printed row with words on it: its baseline and where its words start (blanks and the margin number aside). */
  rows: Array<{ y: number; x: number }>
}

export type AreaReference = {
  /** The heading's number: "29", "2.2". */
  number: string | null
  /** The heading as printed, title-cased when the form prints it in capitals. */
  heading: string | null
  /** The printed lines the section's boxes sit on: "349-352". */
  lines: string | null
}

const SAME_ROW = 0.003
/** A margin line number sits left of the text with a clear gap (about 6 pt). */
const MARGIN_X = 0.08
const MARGIN_GAP = 0.009
const SMALL = /^(and|or|of|the|to|a|an|as|at|by|for|in|on|with|from)$/i
const HEADING = /^(\d{1,3}(?:\.\d{1,3})*)\.\s*([^.:]{2,90}?)\s*[.:](?:\s|$)/

/** The printed rows of a page, left to right, with the margin line number split off. */
function rowsOf(runs: readonly TextRun[]): Array<{ y: number; lineNumber: number | null; text: string; wordsX: number | null }> {
  const sorted = runs.filter((r) => r.str.trim()).slice().sort((a, b) => a.y - b.y || a.x - b.x)
  const rows: TextRun[][] = []
  for (const r of sorted) {
    const row = rows[rows.length - 1]
    if (row && Math.abs(row[0].y - r.y) <= SAME_ROW) row.push(r)
    else rows.push([r])
  }
  return rows.map((row) => {
    const items = row.slice().sort((a, b) => a.x - b.x)
    let lineNumber: number | null = null
    const first = items[0]
    const next = items[1]
    if (/^\d{1,4}$/.test(first.str.trim()) && first.x < MARGIN_X && (!next || next.x - (first.x + first.w) >= MARGIN_GAP)) {
      lineNumber = Number(first.str.trim())
      items.shift()
    }
    // Runs that touch join as one word; a gap is a space.
    let text = ''
    let end = -1
    for (const it of items) {
      if (text && it.x - end > 0.002 && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' '
      text += it.str
      end = it.x + it.w
    }
    // Where the row's words start: a run of blanks ("______") is a line to write
    // on, and a bare number (a line number set further in) is not a label.
    const words = items.find((it) => /[^\s_\d]/.test(it.str))
    return { y: first.y, lineNumber, text: text.replace(/\s+/g, ' ').trim(), wordsX: words ? words.x : null }
  })
}

/** A heading's title as it should read: capitals title-cased, anything else as printed. */
function headingTitle(raw: string): string | null {
  const t = raw.replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/').trim()
  const words = t.split(' ')
  if (words.length > 8 || !/^[A-Z]/.test(t)) return null
  // A heading reads as a title: every word capitalized but the small ones.
  if (!words.every((w) => SMALL.test(w) || /^[A-Z0-9(“"]/.test(w))) return null
  if (/[a-z]/.test(t)) return t
  return words.map((w, i) => (i > 0 && SMALL.test(w) ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase().replace(/([/-])([a-z])/g, (_, s: string, c: string) => s + c.toUpperCase()))).join(' ')
}

/** The line numbers and numbered headings printed on one page. */
export function pageMarks(runs: readonly TextRun[]): PageMarks {
  const marks: PageMarks = { lineNumbers: [], headings: [], rows: [] }
  for (const row of rowsOf(runs)) {
    if (row.lineNumber != null) marks.lineNumbers.push({ n: row.lineNumber, y: row.y })
    if (row.wordsX != null) marks.rows.push({ y: row.y, x: row.wordsX })
    const m = HEADING.exec(row.text)
    const title = m ? headingTitle(m[2]) : null
    if (m && title) marks.headings.push({ number: m[1], title, y: row.y })
  }
  return marks
}

/** A box sits on the printed row whose baseline falls in its lower part. */
const onRow = (y: number, box: { y: number; h: number }) => y >= box.y + box.h * 0.2 && y <= box.y + box.h + 0.006

/**
 * The box's printed row carries its own words to the left of it ("Seller(s)",
 * "(c) Other Identifying Information"): it is a field of its own, not the next
 * line of the paragraph above.
 */
export function lineHasLabel(marks: PageMarks | null | undefined, box: { x: number; y: number; h: number }): boolean {
  return !!marks?.rows.some((r) => onRow(r.y, box) && r.x < box.x - 0.005)
}

/** How many pages back a section's heading may be printed (a section can run onto the next page). */
const HEADING_LOOKBACK = 2

/**
 * Where an area sits: the printed lines its boxes cover, and the nearest
 * numbered heading at or above its first line (on its page or the page
 * before). `marks[i]` is page i + 1.
 */
export function areaReference(marks: ReadonlyArray<PageMarks | null | undefined>, area: { page: number; lines: ReadonlyArray<{ y: number; h: number }> }): AreaReference {
  const onPage = marks[area.page - 1]
  // A box sits on its printed line: the line's baseline falls in the box's lower part.
  const nums = new Set<number>()
  for (const ln of onPage?.lineNumbers ?? []) {
    if (area.lines.some((l) => onRow(ln.y, l))) nums.add(ln.n)
  }
  const sorted = [...nums].sort((a, b) => a - b)
  const lines = sorted.length ? (sorted[0] === sorted[sorted.length - 1] ? String(sorted[0]) : `${sorted[0]}-${sorted[sorted.length - 1]}`) : null

  const first = area.lines[0]
  const limit = first ? first.y + first.h + 0.006 : 1
  for (let p = area.page; p >= Math.max(1, area.page - HEADING_LOOKBACK + 1); p--) {
    const hs = (marks[p - 1]?.headings ?? []).filter((h) => p < area.page || h.y <= limit)
    const h = hs.sort((a, b) => b.y - a.y)[0]
    if (h) return { number: h.number, heading: h.title, lines }
  }
  return { number: null, heading: null, lines }
}

/** The reference an addendum paragraph cites: "Section 29 Additional Provisions, lines 349-352". */
export function referenceLabel(ref: AreaReference, fallbackTitle?: string | null): string | null {
  const head = ref.heading ? (ref.number ? `Section ${ref.number} ${ref.heading}` : ref.heading) : (fallbackTitle ?? null)
  const lines = ref.lines ? (ref.lines.includes('-') ? `lines ${ref.lines}` : `line ${ref.lines}`) : null
  return [head, lines].filter(Boolean).join(', ') || null
}

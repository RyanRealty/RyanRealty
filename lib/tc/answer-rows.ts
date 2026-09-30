/**
 * Checkbox rows that answer one printed question, read from the page: the
 * 020's "A. Do you have legal authority to sell the Property? [] Yes [] No
 * [] Unknown", "Seller [] is [] is not occupying the Property", "court
 * appointed (select only one) [] receiver [] personal representative ...".
 * Each becomes a group the signer answers with one box. A row of options that
 * does not say "only one" ("subject to any of the following? [] First right
 * of refusal [] Option ...") stays free.
 *
 * Pure: the geometry comes from the blank's AcroForm widgets, the words from
 * its page text (lib/tc/pdf-page-text.ts readPdfTextRuns).
 */
import { joinRuns, printedRow, type PageTextRun } from './lined-signature-fields'
import type { MappedField } from './skyslope-field-map'

/** The word printed just right of an answer box. */
const ANSWER = /^(yes|no|unknown|n\/?a)\*?[.,:]?$/i
/** A row that says so: "(select only one)", "check one". */
const ONE_OF = /\b(select|check|choose|mark)\s+(only\s+)?one\b/i
const SAME_ROW = 0.004
const MAX_PROMPT = 120
/** Answer boxes of one question sit closer than this (page width fraction); the 020 spaces them 0.05 to 0.08 apart. */
const ANSWER_PITCH = 0.12

/**
 * The words printed right after a box, up to the next gap in the line. Page text can split a word into pieces ("U" "nknown", "Ye" "s"): pieces
 * that touch are one word.
 */
function wordAfter(box: MappedField, line: readonly PageTextRun[]): string {
  const sorted = line.filter((r) => r.str.length).slice().sort((a, b) => a.x - b.x)
  const start = sorted.findIndex((r) => r.str.trim() && r.x >= box.x + box.w - 0.005 && r.x <= box.x + box.w + 0.03)
  if (start < 0) return ''
  let word = sorted[start]!.str
  let end = sorted[start]!.x + sorted[start]!.w
  for (const r of sorted.slice(start + 1)) {
    if (!r.str.trim() || r.x - end > WORD_GAP) break
    word += r.str
    end = r.x + r.w
  }
  return word.trim()
}

/** Pieces of one word sit this close (page width fraction). */
const WORD_GAP = 0.002

const isAnswer = (words: string) => ANSWER.test(words.split(/\s+/)[0] ?? '')

/** The question a row answers: its words left of the first box, without the dot leaders or the line number. */
function questionOf(first: MappedField, line: readonly PageTextRun[], runs: readonly PageTextRun[]): string {
  const left = (rs: readonly PageTextRun[], before: number) => joinRuns(rs.filter((r) => r.x + r.w <= before + 0.01))
  const clean = (s: string) =>
    s
      .replace(/[.\u2026]{3,}.*$/, '')
      .replace(/_{2,}/g, ' ')
      .replace(/^\s*\d{1,3}\s+/, '')
      // The last answer word of a question to the left on the same line.
      .replace(/^((yes|no|unknown|n\/a)\*?\s+)+/i, '')
      .replace(/\s+/g, ' ')
      .trim()
  let text = clean(left(line, first.x))
  // A question printed over two lines: its second line carries on in lower
  // case ("recent boundary changes?"). An item of its own ("b. Is the water
  // source ...", "(2) Has a back flow valve ...") does not.
  if (/^[a-z]/.test(text) && !/^[a-z][.)]\s/.test(text) && line[0]) {
    const above = runs.filter((r) => r.y < line[0]!.y - 0.003 && r.y > line[0]!.y - 0.03)
    const prevY = Math.max(...above.map((r) => r.y))
    const prev = above.filter((r) => Math.abs(r.y - prevY) < 0.003)
    if (prev.length) text = `${clean(left(prev, 1))} ${text}`.trim()
  }
  return text.length > MAX_PROMPT ? `${text.slice(0, MAX_PROMPT - 1).trimEnd()}\u2026` : text
}

export type AnswerRowOptions = {
  /** The form says to answer every question: a Yes/No row takes exactly one box, not at most one. */
  answerEveryQuestion?: boolean
}

/**
 * Group each row of checkboxes that answers one question. The rule is
 * "exactly one" where the form says every question is answered, otherwise
 * "at most one" (two answers to one question is never right; a skipped
 * question is the broker's call). A box already in a group keeps it.
 */
export function groupAnswerRows(
  map: readonly MappedField[],
  pages: ReadonlyArray<readonly PageTextRun[]>,
  options: AnswerRowOptions = {},
): MappedField[] {
  const out = map.map((f) => ({ ...f }))
  const boxes = out
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.type === 'checkbox' && !f.group)
    .sort((a, b) => a.f.page - b.f.page || a.f.y - b.f.y || a.f.x - b.f.x)
  const rows: Array<typeof boxes> = []
  for (const b of boxes) {
    const row = rows[rows.length - 1]
    const head = row?.[0]
    if (row && head && head.f.page === b.f.page && Math.abs(head.f.y - b.f.y) < SAME_ROW) row.push(b)
    else rows.push([b])
  }
  for (const row of rows) {
    if (row.length < 2) continue
    row.sort((a, b) => a.f.x - b.f.x)
    const first = row[0]!.f
    const runs = pages[first.page - 1] ?? []
    const line = printedRow(first, runs)
    if (!line.length) continue
    const words = row.map(({ f }) => wordAfter(f, line))
    const put = (members: typeof row, exactly: boolean, after: number) => {
      const head = members[0]!.f
      const group = { key: `p${head.page}:${head.y.toFixed(3)}:${head.x.toFixed(3)}`, min: exactly ? 1 : null, max: 1 }
      const prompt = questionOf(head, line.filter((r) => r.x >= after), runs) || undefined
      for (const { f, i } of members) out[i] = { ...f, group, ...(prompt ? { prompt } : {}) }
    }
    // Answer boxes sit together at the end of the line; a line may also carry
    // option boxes of its own ("[] water rights or [] other irrigation rights
    // ...? [] Yes [] No [] Unknown"), or two questions side by side.
    const clusters: Array<typeof row> = []
    for (const b of row) {
      const cur = clusters[clusters.length - 1]
      const prev = cur?.[cur.length - 1]
      if (cur && prev && b.f.x - prev.f.x <= ANSWER_PITCH) cur.push(b)
      else clusters.push([b])
    }
    let answered = false
    let after = 0
    for (const c of clusters) {
      const cw = c.map(({ f }) => wordAfter(f, line))
      if (c.length >= 2 && cw.every(isAnswer)) {
        const yesNo = cw.some((w) => /^yes/i.test(w)) && cw.some((w) => /^no\b/i.test(w))
        put(c, options.answerEveryQuestion === true && yesNo, after)
        answered = true
        // The next question on the line starts after this one's answers.
        const last = c[c.length - 1]!.f
        after = last.x + last.w
      }
    }
    if (answered) continue
    const w0 = words[0]!.toLowerCase()
    const negation = row.length === 2 && !!w0 && words[1]!.toLowerCase().startsWith(`${w0} not`)
    const saysOne = ONE_OF.test(joinRuns(line))
    if (negation) put(row, options.answerEveryQuestion === true, 0)
    else if (saysOne) put(row, false, 0)
  }
  return out
}

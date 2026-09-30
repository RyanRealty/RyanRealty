/**
 * OREF blanks draw signature / date / print-name as ordinary AcroForm Text
 * widgets on the printed lines. Promote those widgets in place so the
 * overlay sits on the line — do not dump a second stack on top of it.
 *
 * Long language (document lists, contingency clauses) stays in the stacked
 * underline widgets and wraps from one printed line to the next.
 */
import { deriveSignerRole, type MappedField, type SignerRole } from './skyslope-field-map'

const SIG_H_MIN = 0.019
const SIG_H_MAX = 0.03
const SIG_W_MIN = 0.35
const SIG_X_MAX = 0.28
const SIG_BOX_W_MIN = 0.2
const SIG_BOX_H_MIN = 0.018

function isSignatureLine(f: MappedField): boolean {
  return f.type === 'text' && f.w >= SIG_W_MIN && f.h >= SIG_H_MIN && f.h <= SIG_H_MAX && f.x <= SIG_X_MAX
}

function isDateLine(f: MappedField): boolean {
  if (f.type !== 'text') return false
  if (f.x < 0.55 || f.w < 0.12 || f.w > 0.3 || f.h > 0.024) return false
  return /date|time/i.test(`${f.label ?? ''} ${f.dataRef ?? ''}`) || f.x >= 0.65
}

function isPrintLine(f: MappedField): boolean {
  return f.type === 'text' && f.w >= SIG_W_MIN && f.h <= 0.02 && /^print/i.test(f.label ?? f.dataRef ?? '')
}

function roleForLine(f: MappedField): SignerRole {
  return deriveSignerRole(f.dataRef ?? undefined, f.label ?? undefined)
}

function nameOf(f: MappedField): string {
  return `${f.label ?? ''} ${f.dataRef ?? ''}`.trim()
}

/** Legal paragraphs named “by signing below” are not signature widgets. */
export function isImplausibleSignatureWidget(f: MappedField): boolean {
  if (f.type !== 'signature') return false
  const name = nameOf(f)
  if (name.length > 60) return true
  if (/\bsigning below\b/i.test(name)) return true
  if (f.w < SIG_BOX_W_MIN || f.h < SIG_BOX_H_MIN) return true
  return false
}

export function demoteImplausibleSignatureFields(map: readonly MappedField[]): MappedField[] {
  return map.map((f) =>
    isImplausibleSignatureWidget(f) ? { ...f, type: 'text' as const, signerRole: null, optional: true } : { ...f },
  )
}

export function wrapTextToWidth(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const raw = text.replace(/\s+/g, ' ').trim()
  if (!raw) return []
  if (maxWidth <= 0) return [raw]
  const words = raw.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word
    if (measure(next) <= maxWidth) {
      cur = next
      continue
    }
    if (cur) lines.push(cur)
    if (measure(word) <= maxWidth) {
      cur = word
      continue
    }
    let chunk = ''
    for (const ch of word) {
      const trial = chunk + ch
      if (measure(trial) <= maxWidth) chunk = trial
      else {
        if (chunk) lines.push(chunk)
        chunk = ch
      }
    }
    cur = chunk
  }
  if (cur) lines.push(cur)
  return lines
}

/** Text on a page, top-left fractions (lib/tc/pdf-page-text.ts readPdfTextRuns). */
export type PageTextRun = { str: string; x: number; y: number; w: number }

/** A signature line whose widget name does not say who signs it ("Text8"). */
export function isUnnamedSignatureLine(f: MappedField): boolean {
  return isSignatureLine(f) && !roleForLine(f) && !f.signerRole
}

function isPrintRowCandidate(f: MappedField): boolean {
  return f.type === 'text' && f.w >= SIG_W_MIN && f.h <= 0.02 && /^(text[\d.]*)?$/i.test((f.label ?? f.dataRef ?? '').trim())
}

export function hasUnnamedSignatureLines(map: readonly MappedField[]): boolean {
  return map.some(isUnnamedSignatureLine)
}

/** The words printed on a line's row, to its left ("26 Buyer"). */
function rowLabel(f: MappedField, runs: readonly PageTextRun[]): string {
  return runs
    .filter((r) => r.y >= f.y - 0.004 && r.y <= f.y + f.h + 0.008 && r.x + r.w <= f.x + 0.015 && r.x >= f.x - 0.25)
    .sort((a, b) => a.x - b.x)
    .map((r) => r.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Who signs each unnamed signature line, from the word printed beside it on
 * the page: "Buyer", "Seller", "Buyer's Agent". The nth line of a role is for
 * the nth signer of that role, so a second buyer gets the second Buyer line.
 * A page whose text cannot be read (a font with no Unicode map prints
 * "Buyer" as "R A = ? 4") names nobody, and those lines stay for the broker
 * to assign.
 */
export function labelSignatureRowsFromPage(map: readonly MappedField[], pages: ReadonlyArray<readonly PageTextRun[]>): MappedField[] {
  const out = map.map((f) => {
    if (!isUnnamedSignatureLine(f)) {
      // The line under a signature line, printed "Print": the signer's name.
      if (isPrintRowCandidate(f) && /\bprint/i.test(rowLabel(f, pages[f.page - 1] ?? []))) return { ...f, label: 'Print name' }
      return { ...f }
    }
    const label = rowLabel(f, pages[f.page - 1] ?? [])
    const role = label ? deriveSignerRole(undefined, label) : null
    return role ? { ...f, label: `${label.replace(/^\d+\s*/, '')} signature`, signerRole: role } : { ...f }
  })
  const seen = new Map<string, number>()
  const lines = out
    .map((f, i) => ({ f, i, role: f.signerRole ?? roleForLine(f) }))
    .filter(({ f, role }) => isSignatureLine(f) && role)
    .sort((a, b) => a.f.page - b.f.page || a.f.y - b.f.y || a.f.x - b.f.x)
  for (const { i, role } of lines) {
    const n = seen.get(role!) ?? 0
    seen.set(role!, n + 1)
    out[i] = { ...out[i]!, signerIndex: n }
  }
  return out
}

/** Promote printed signature / date / print-name lines. Leaves other widgets alone. */
export function promoteLinedFormFields(map: readonly MappedField[]): MappedField[] {
  const out = map.map((f) => ({ ...f }))
  const sigIdx = out.map((f, i) => (isSignatureLine(f) ? i : -1)).filter((i) => i >= 0)
  const seen = new Set<string>()
  for (const i of sigIdx) {
    const sig = out[i]!
    const role = roleForLine(sig)
    const key = role ?? `line:${sig.page}:${sig.y}`
    const first = !seen.has(key)
    if (role) seen.add(key)
    out[i] = { ...sig, type: 'signature', signerRole: role ?? sig.signerRole, optional: !first }
    const index = sig.signerIndex != null ? { signerIndex: sig.signerIndex } : {}
    const date = out.find(
      (f) =>
        isDateLine(f) &&
        f.page === sig.page &&
        Math.abs(f.y - sig.y) < 0.02 &&
        f.x > sig.x,
    )
    if (date) {
      const di = out.indexOf(date)
      out[di] = {
        ...date,
        type: 'date_signed',
        signerRole: role ?? date.signerRole,
        optional: !first,
        ...index,
      }
    }
    const print = out.find(
      (f) =>
        isPrintLine(f) &&
        f.page === sig.page &&
        f.y > sig.y &&
        f.y - sig.y < 0.035 &&
        Math.abs(f.x - sig.x) < 0.05,
    )
    if (print) {
      const pi = out.indexOf(print)
      out[pi] = {
        ...print,
        type: 'full_name',
        signerRole: role ?? print.signerRole,
        optional: true,
        ...index,
      }
    }
  }
  return out
}

function isInitialsBox(f: MappedField): boolean {
  if (f.type !== 'text' && f.type !== 'initials') return false
  return f.w >= 0.03 && f.w <= 0.08 && f.h >= 0.012 && f.h <= 0.022
}

/**
 * Footer initial rows (OREF 060): a line of small boxes, buyers on the left,
 * sellers on the right. First box per side is required; extras stay optional.
 */
/**
 * Which principals actually sign this form. A listing packet has no buyer, so
 * splitting an initials row buyer-left / seller-right invents a signer nobody
 * on the envelope can be, and every one of those boxes lands required and
 * unassigned — which blocks the send outright.
 */
export function promoteInitialsBoxes(
  map: readonly MappedField[],
  principals: readonly SignerRole[] = ['buyer', 'seller'],
): MappedField[] {
  const signing = principals.filter((r): r is Exclude<SignerRole, null> => r === 'buyer' || r === 'seller')
  const out = map.map((f) => ({ ...f }))
  const boxes = out
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => isInitialsBox(f))
  const groups = new Map<string, { f: MappedField; i: number }[]>()
  for (const b of boxes) {
    const key = `${b.f.page}:${Math.round(b.f.y * 200)}`
    const arr = groups.get(key) ?? []
    arr.push(b)
    groups.set(key, arr)
  }
  for (const group of groups.values()) {
    if (group.length < 4) continue
    group.sort((a, b) => a.f.x - b.f.x)
    const mid = (group[0]!.f.x + group[group.length - 1]!.f.x) / 2
    const left = group.filter((g) => g.f.x < mid)
    const right = group.filter((g) => g.f.x >= mid)
    const assign = (cluster: { f: MappedField; i: number }[], role: SignerRole) => {
      cluster.forEach((g, idx) => {
        out[g.i] = { ...g.f, type: 'initials', signerRole: role, optional: idx > 0 }
      })
    }
    // One principal on the form means the whole row is theirs, both clusters.
    const leftRole = signing.length > 1 ? signing[0]! : (signing[0] ?? null)
    const rightRole = signing.length > 1 ? signing[1]! : (signing[0] ?? null)
    assign(left, leftRole)
    assign(right, rightRole)
  }
  return out
}

/** Consecutive printed underlines (059 document list, 060 other-language). */
export function stackedUnderlineRuns(map: readonly MappedField[]): MappedField[][] {
  const candidates = map
    .filter((f) => f.type === 'text' && f.w >= 0.5 && f.h <= 0.018 && f.x <= 0.15)
    .slice()
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
  const runs: MappedField[][] = []
  let cur: MappedField[] = []
  for (const f of candidates) {
    const prev = cur[cur.length - 1]
    if (!prev) {
      cur = [f]
      continue
    }
    const same =
      prev.page === f.page &&
      Math.abs(prev.x - f.x) < 0.03 &&
      Math.abs(prev.w - f.w) < 0.05 &&
      f.y > prev.y &&
      f.y - prev.y < 0.025
    if (same) cur.push(f)
    else {
      if (cur.length >= 3) runs.push(cur)
      cur = [f]
    }
  }
  if (cur.length >= 3) runs.push(cur)
  return runs
}

/** Put a long clause on consecutive printed lines instead of overflowing one box. */
export function fillStackedUnderlineRun(
  run: readonly MappedField[],
  text: string,
  measure: (s: string) => number,
  maxWidth: number,
): { field: MappedField; text: string }[] {
  const lines = wrapTextToWidth(text, maxWidth, measure)
  return run.map((field, i) => ({ field, text: lines[i] ?? '' }))
}

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
      }
    }
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

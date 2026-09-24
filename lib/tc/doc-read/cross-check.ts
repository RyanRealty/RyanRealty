/**
 * Two independent reads of every form must agree before the Vault acts on
 * "fully executed". Pure.
 *
 * The reader (vision-reading.ts) transcribes the page like a person would:
 * which form, who is named, who signed, the response box. The form check
 * (lib/tc/form-match) lines the copy up with the printed form itself and
 * looks inside every signature box the form prints. They fail differently:
 * the reader can misjudge a faint or unusual mark; the form check cannot tell
 * a signature from a name typed on the line. So an empty box is strong
 * evidence and ink in a box is weak:
 *
 *  - The reader says fully executed, but a page of the form is missing, or a
 *    party it names has no mark on any of their lines: the form goes to a
 *    person (needs review) with both reads in the reason. It never drives an
 *    archive or a checklist link on the reader's word alone.
 *  - The form check finds a page missing from a copy the reader called
 *    partially signed or unsigned: the reason says so.
 *  - Everything else stands, and the verdict records which printed form and
 *    release the copy was checked against.
 */
import { describeCheck, type FormCheck } from '@/lib/tc/form-match/check'
import type { FormVerdict } from './verdict'
import type { FormReading, SignatureLine } from './vision-reading'

/** "OREF 003" / "Form 2.1" / "003" → "003"; "2.1" stays. */
export function normalizeFormNumber(n: string | null | undefined): string | null {
  if (!n) return null
  const s = n
    .toUpperCase()
    .replace(/\b(OREF|FORM|OR|ODS)\b/g, '')
    .replace(/[^0-9A-Z.]/g, '')
    .replace(/^\.+|\.+$/g, '')
  return s || null
}

/** The form check covering the same pages as this form's signature lines (and the same number, when both print one). */
export function pairCheck(reading: FormReading, checks: readonly FormCheck[]): FormCheck | null {
  const pages = new Set((reading.signatureLines ?? []).map((l) => l.page))
  const num = normalizeFormNumber(reading.formNumber)
  let best: FormCheck | null = null
  let bestOverlap = 0
  for (const c of checks) {
    const docPages = new Set(c.pages.filter((p) => p.docPage != null).map((p) => p.docPage as number))
    const overlap = [...pages].filter((p) => docPages.has(p)).length
    if (!overlap) continue
    const cnum = normalizeFormNumber(c.formNumber)
    if (num && cnum && num !== cnum) continue
    if (overlap > bestOverlap) {
      best = c
      bestOverlap = overlap
    }
  }
  return best
}

const RELEASE = (r: string | null) => (r ? (/^\d{4}/.test(r) ? ` version ${r}` : ` released ${r}`) : '')

export type CrossChecked = FormVerdict & {
  checkedAgainst: string | null
  checkIssues: string[]
}

export function crossCheckForm(verdict: FormVerdict, reading: FormReading, checks: readonly FormCheck[]): CrossChecked {
  const check = pairCheck(reading, checks)
  if (!check) return { ...verdict, checkedAgainst: null, checkIssues: [] }
  const against = `${check.family === 'OR' ? 'Form' : check.family} ${check.formNumber}${RELEASE(check.release)}${check.source === 'learned' ? ' (learned from our own copies)' : ''}`
  const named = { buyer: reading.buyersNamed?.length ?? 0, seller: reading.sellersNamed?.length ?? 0 }
  const d = describeCheck(check, named)
  const out: CrossChecked = { ...verdict, checkedAgainst: against, checkIssues: d.issues }
  if (d.complete) return out
  if (verdict.verdict === 'fully_executed') {
    return {
      ...out,
      verdict: 'needs_review',
      reasons: [`The reader read this as fully executed, but checked against the printed ${against}: ${d.issues.join('; ')}. A person confirms before the Vault relies on it.`, ...verdict.reasons],
    }
  }
  if (check.missingPages.length && (verdict.verdict === 'partially_executed' || verdict.verdict === 'unsigned')) {
    return { ...out, reasons: [`Checked against the printed ${against}: ${d.issues.join('; ')}.`, ...verdict.reasons] }
  }
  return out
}

export function crossCheckForms(verdicts: readonly FormVerdict[], readings: readonly FormReading[], checks: readonly FormCheck[] | null): CrossChecked[] {
  return verdicts.map((v, i) => (checks?.length && readings[i] ? crossCheckForm(v, readings[i], checks) : { ...v, checkedAgainst: null, checkIssues: [] }))
}

/**
 * The printed form says which signature lines a page has. On a page matched
 * to its exact release, an UNSIGNED buyer or seller line the reader reports
 * that the printed page does not have is a misread (OREF 020 01/2026 page 7
 * has a "II. BUYER'S ACKNOWLEDGMENT" heading and buyer initials but no buyer
 * signature line; the reader reported one and held a fully signed disclosure
 * as partial). Such lines are dropped before the verdict. Conservative on
 * purpose: only on pages whose form marks required lines (the ← legend, so
 * its lines were all found), only buyer and seller lines, never a line the
 * reader saw signed.
 */
export function reconcileWithForm(reading: FormReading, checks: readonly FormCheck[] | null): { reading: FormReading; dropped: string[] } {
  if (!checks?.length) return { reading, dropped: [] }
  const check = pairCheck(reading, checks)
  if (!check) return { reading, dropped: [] }
  const tplPageOf = new Map<number, number>()
  for (const p of check.pages) if (p.docPage != null) tplPageOf.set(p.docPage, p.templatePage)
  // Pages whose printed lines carry the required marker: every line on them was found.
  const marked = new Set(check.lines.filter((l) => l.required != null).map((l) => l.page))
  const dropped: string[] = []
  const kept: SignatureLine[] = []
  for (const l of reading.signatureLines ?? []) {
    const tp = tplPageOf.get(l.page)
    const principal = l.party === 'buyer' || l.party === 'seller'
    if (tp != null && marked.has(tp) && principal && !l.signed) {
      const printed = check.lines.some((t) => t.page === tp && t.party === l.party)
      if (!printed) {
        dropped.push(`page ${l.page}: a ${l.party} line ("${l.section || l.label}") the printed form does not have`)
        continue
      }
    }
    kept.push(l)
  }
  return dropped.length ? { reading: { ...reading, signatureLines: kept }, dropped } : { reading, dropped }
}

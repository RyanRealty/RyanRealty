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

/**
 * A signature row's date blank: one named for a date or time (the OR forms'
 * short "Dated ___" in either column), or the wide date column at the right of
 * an OREF row.
 */
function isDateLine(f: MappedField): boolean {
  if (f.type !== 'text' || f.h > 0.024 || f.w > 0.3) return false
  if (/date|time/i.test(`${f.label ?? ''} ${f.dataRef ?? ''}`)) return f.w >= 0.05
  return f.x >= 0.65 && f.w >= 0.12
}

/**
 * A box of signature height and width, wherever it sits. Only a printed role
 * beside it makes it a line, so it may be a little shorter than an unlabelled
 * line: the 2.4 Bill of Sale's are 0.0182 of the page (a fact line is 0.0164).
 */
function isSignatureBox(f: MappedField): boolean {
  return f.type === 'text' && f.h >= LABELLED_SIG_H_MIN && f.h <= SIG_H_MAX && f.w >= SIG_BOX_W_MIN
}
const LABELLED_SIG_H_MIN = 0.0175

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

function isPrintRowCandidate(f: MappedField): boolean {
  return f.type === 'text' && f.w >= SIG_W_MIN && f.h <= 0.02 && /^(text[\d.]*)?$/i.test((f.label ?? f.dataRef ?? '').trim())
}

/** The printed row a box sits on: the text nearest its bottom edge, where its baseline is. */
export function printedRow(f: Pick<MappedField, 'y' | 'h'>, runs: readonly PageTextRun[]): PageTextRun[] {
  const bottom = f.y + f.h
  let best: PageTextRun | null = null
  for (const r of runs) {
    if (Math.abs(r.y - bottom) > ROW_TOL) continue
    if (!best || Math.abs(r.y - bottom) < Math.abs(best.y - bottom)) best = r
  }
  return best ? runs.filter((r) => Math.abs(r.y - best!.y) < SAME_BASELINE) : []
}
const ROW_TOL = 0.009
const SAME_BASELINE = 0.003

/**
 * A run that carries on into a box ("Seller ______ Date/Time ___"): its text
 * up to the blank the box sits on. Character counts only estimate where each
 * blank starts, so the blank nearest the box is the box's own.
 */
function wordsBefore(r: PageTextRun, x: number): string {
  const perChar = r.w / Math.max(1, r.str.length)
  let best: { at: number; d: number } | null = null
  for (const m of r.str.matchAll(/_{2,}/g)) {
    const d = Math.abs(r.x + m.index! * perChar - x)
    if (d <= 0.08 && (!best || d < best.d)) best = { at: m.index!, d }
  }
  if (best) return r.str.slice(0, best.at)
  return r.str.slice(0, Math.max(0, Math.floor((x - r.x) / Math.max(perChar, 1e-6))))
}

/**
 * The words printed on a box's row, to its left ("26 Buyer"). A run that
 * carries on into the box ("Buyer ______ Date/Time ___", one run on the 020
 * and the 071) counts up to where the box starts, and only the words after
 * the last blank before the box label it: "Buyer ___ Seller" labels the
 * second line "Seller".
 */
export function rowLabel(f: Pick<MappedField, 'x' | 'y' | 'h'>, runs: readonly PageTextRun[]): string {
  const text = joinRuns(
    printedRow(f, runs)
      .filter((r) => r.x < f.x + 0.005 && r.x + r.w >= f.x - 0.25)
      .map((r) => (r.x + r.w <= f.x + 0.015 ? r : { ...r, str: wordsBefore(r, f.x) })),
  )
  // An underline that starts just before the box is the box's own blank.
  const segments = text.replace(/[_\s]+$/, '').split(/_{2,}/)
  // Only the words after the last sentence or colon label the box: "... the
  // informational pamphlet. Buyer Initials" (2.6), "Date d: Seller :" (2.4).
  const tail = (segments[segments.length - 1] ?? '').split(/[.;:]\s+/)
  return (tail[tail.length - 1] ?? '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Two pieces of page text this close (page width fraction) are one word. */
const TOUCH = 0.002

/**
 * Runs of one line in reading order, as text: pieces that touch are one word,
 * a gap is a space. Page text splits a word where the font kerns it: the 3.1
 * footer reads "B" "uyer Initials", the 020's "Seller In" "itials".
 */
export function joinRuns(rs: readonly PageTextRun[]): string {
  let out = ''
  let end = -1
  for (const r of rs.slice().sort((a, b) => a.x - b.x)) {
    out += end >= 0 && r.x - end > TOUCH ? ` ${r.str}` : r.str
    end = r.x + r.w
  }
  return out
}

/**
 * Who a printed row label names: "Buyer", "Seller", "Buyer's Agent",
 * "Seller Initials". Only a short label counts (a sentence is not a row
 * label), and one naming both principals names nobody. An aside is read only
 * when the label itself names nobody: "Seller(s) Initials (required if option
 * [a] is selected)" is the seller's, and so is "Grantor (Seller)".
 */
export function printedRole(label: string): SignerRole {
  // Page text splits "Buyer’s Agent" into "Buyer", "’", "s Agent" (the 021).
  const s = label
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s*'\s*/g, "'")
  const asides = [...s.matchAll(/\(([^)]*)\)?/g)].map((m) => m[1] ?? '')
  return roleOfWords(s.replace(/\([^)]*\)?/g, ' ')) ?? asides.map(roleOfWords).find(Boolean) ?? null
}

function roleOfWords(s: string): SignerRole {
  const words = s.replace(/[^a-z']+/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (!words.length || words.length > 5) return null
  if (/buyer'?s?\s*(agent|broker|licensee)|selling\s*(agent|broker|licensee)/.test(s)) return 'buyer_agent'
  if (/seller'?s?\s*(agent|broker|licensee)|listing\s*(agent|broker|licensee)/.test(s)) return 'listing_agent'
  const buyer = /\bbuyers?\b|\bpurchasers?\b/.test(s)
  const seller = /\bsellers?\b/.test(s)
  if (buyer === seller) return null
  return buyer ? 'buyer' : 'seller'
}

/** A line printed "Client" or "Client Signature:" (agency and disclosure forms). */
const CLIENT_LINE = /^(the\s+)?clients?('s)?(\s+signature)?\s*:?$/i

/** Signature lines further apart than this (a fraction of the page height) are two blocks. */
const BLOCK_GAP = 0.07

/**
 * The brokerage's own line on a form one agent signs: "Broker [signing for
 * Broker, individually, and on behalf of Principal Broker]:" on the 9.3
 * listing agreement sits in the right column, where no other signature line
 * does, so it is read from its printed label or its widget's name. A name,
 * firm, phone or licence number line is a fact, not a signature.
 */
const AGENT_LABEL = /^(principal\s+)?broker\b|^(real\s+estate\s+)?(agent|licensee)\b|^dealer'?s\s+representative\b/i
const AGENT_NAME = /\b(principal[\s_]*)?broker\b|licensee/i
const FACT_NAME = /firm|name|phone|e-?mail|licen[sc]e[\s_]*(no|#|num)|address|company/i
/** "Listing Firm Principal Broker Signature" (ODS 4-page listing agreement) is a signature, whatever else it names. */
const SIGNATURE_WORD = /signature/i
function isAgentLine(f: MappedField, label: string): boolean {
  if (f.type !== 'text' || f.w < SIG_BOX_W_MIN * 1.5 || f.h < SIG_H_MIN || f.h > SIG_H_MAX) return false
  return isAgentLabel(f, label)
}
function isAgentLabel(f: MappedField, label: string): boolean {
  const said = label.replace(/[\u2018\u2019]/g, "'")
  const both = `${f.dataRef ?? ''} ${said}`
  if (FACT_NAME.test(both) && !SIGNATURE_WORD.test(both)) return false
  return AGENT_LABEL.test(said) || AGENT_NAME.test(f.dataRef ?? '')
}

/**
 * Who signs each signature line, from the word printed beside it on the page:
 * "Buyer", "Seller", "Buyer's Agent". The printed word decides over the
 * widget's name: the 071 Bill of Sale names its four Buyer rows "Seller",
 * "SWeller" and "SellerR_2". A page whose text cannot be read (a font with no
 * Unicode map prints "Buyer" as "R A = ? 4") leaves the widget's name, or
 * nobody, and those lines stay for the broker to assign.
 *
 * `principals` are the roles the form is known to be signed by (never a
 * guess): a line printed "Client" belongs to the one principal among them (a
 * buyer agency agreement's client is the buyer), and a Broker or Agent line to
 * the one agent among them. With two, or none known, the line stays for the
 * broker.
 *
 * The nth line of a block is for the nth signer of that role, so a second
 * buyer gets the second Buyer line; rows that alternate Buyer, Seller, Buyer,
 * Seller are one block. The count starts again at each block (a new page, or
 * a gap between signature lines): the 020 has a Seller block on page 1
 * (claiming an exclusion) and another on page 7, and counting across both
 * gave the only seller the exclusion line and nobody the disclosure. A box
 * the last-page stack placed (fromStack) is not on a printed row and keeps
 * its role.
 */
export function labelSignatureRowsFromPage(
  map: readonly MappedField[],
  pages: ReadonlyArray<readonly PageTextRun[]>,
  principals: readonly SignerRole[] = [],
): MappedField[] {
  const one = (roles: SignerRole[]) => ([...new Set(roles)].length === 1 ? roles[0]! : null)
  const client = one(principals.filter((r) => r === 'buyer' || r === 'seller'))
  const agent = one(principals.filter((r) => r === 'listing_agent' || r === 'buyer_agent'))
  const out = map.map((f) => {
    if (f.fromStack) return { ...f }
    const runs = pages[f.page - 1] ?? []
    if (!isSignatureLine(f) && f.type !== 'signature') {
      // The line under a signature line, printed "Print": the signer's name.
      if (isPrintRowCandidate(f) && /\bprint/i.test(rowLabel(f, runs))) return { ...f, label: 'Print name' }
      const said = rowLabel(f, runs).replace(/^\d+\s*/, '')
      if (agent && isAgentLine(f, said)) return { ...f, type: 'signature' as const, label: `${said || 'Broker'} signature`, signerRole: agent }
      // A line of signature height beside a printed role is that role's line
      // wherever it sits: the OR forms print "Buyer: ____ Dated: ____ Seller:
      // ____ Dated: ____" in two columns (the 2.2 General Addendum).
      const printed = isSignatureBox(f) && !FACT_NAME.test(f.dataRef ?? '') ? printedRole(said) : null
      if (printed) return { ...f, type: 'signature' as const, label: `${said} signature`, signerRole: printed }
      return { ...f }
    }
    const label = rowLabel(f, runs).replace(/^\d+\s*/, '')
    const role = printedRole(label) ?? (CLIENT_LINE.test(label) ? client : null) ?? (agent && isAgentLabel(f, label) ? agent : null)
    if (role) return { ...f, label: `${label} signature`, signerRole: role }
    return { ...f }
  })
  const lines = out
    .map((f, i) => ({ f, i, role: f.signerRole ?? roleForLine(f) }))
    .filter(({ f }) => !f.fromStack && (isSignatureLine(f) || f.type === 'signature'))
    .sort((a, b) => a.f.page - b.f.page || a.f.y - b.f.y || a.f.x - b.f.x)
  let count = new Map<string, number>()
  let prev: MappedField | null = null
  for (const { f, i, role } of lines) {
    if (!prev || prev.page !== f.page || f.y - prev.y > BLOCK_GAP) count = new Map()
    prev = f
    if (!role) continue
    const n = count.get(role) ?? 0
    count.set(role, n + 1)
    out[i] = { ...out[i]!, signerIndex: n }
  }
  return out
}

/** Promote printed signature / date / print-name lines. Leaves other widgets alone. */
export function promoteLinedFormFields(map: readonly MappedField[]): MappedField[] {
  const out = map.map((f) => ({ ...f }))
  // Printed lines, and the signature boxes of the form itself (a box the last-page stack placed brings its own date).
  const sigIdx = out.map((f, i) => (!f.fromStack && (isSignatureLine(f) || f.type === 'signature') ? i : -1)).filter((i) => i >= 0)
  const lines = sigIdx.map((i) => out[i]!)
  const seen = new Set<string>()
  for (const i of sigIdx) {
    const sig = out[i]!
    // A role read from the printed row (labelSignatureRowsFromPage) outranks the widget's name.
    const role = sig.signerRole ?? roleForLine(sig)
    const key = role ?? `line:${sig.page}:${sig.y}`
    const first = !seen.has(key)
    if (role) seen.add(key)
    out[i] = { ...sig, type: 'signature', signerRole: role ?? sig.signerRole, optional: isSignatureLine(sig) ? !first : sig.optional }
    const index = sig.signerIndex != null ? { signerIndex: sig.signerIndex } : {}
    // The row's date is the nearest to the right, before the row's next signature line (two columns: Buyer, then Seller).
    const sameRow = (f: MappedField) => f.page === sig.page && Math.abs(f.y - sig.y) < 0.02 && f.x > sig.x
    const nextLine = Math.min(2, ...lines.filter(sameRow).map((f) => f.x))
    const date = out.filter((f) => isDateLine(f) && sameRow(f) && f.x < nextLine).sort((a, b) => a.x - b.x)[0]
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

/** A label that makes its boxes conditional: "required if option [a] is selected". */
const CONDITIONAL = /\b(required\s+)?if\b/i

/** A footer's boxes split where the gap is wider than this (page width fraction): "Buyer Initials" | "Seller Initials". */
const CLUSTER_GAP = 0.15

/**
 * Footer initial rows: a line of small boxes, each cluster after its own
 * printed label ("Buyer Initials ___ / ___ / ___ / ___", "Seller Initials
 * ..."). The printed label decides whose cluster it is: OREF puts Buyer on
 * the left of the 020 and Seller on the left of other forms, and a page may
 * carry one cluster only (the 020's last page has Seller Initials alone).
 * Within a labelled cluster the nth box is the nth signer's of that role.
 *
 * A row whose labels cannot be read keeps the old split: halves by position,
 * the form's principals in order, first box of each half required.
 *
 * `principals` are the principals who sign this form. A listing packet has no
 * buyer, so splitting an unlabelled row buyer-left / seller-right invents a
 * signer nobody on the envelope can be, and every one of those boxes lands
 * required and unassigned, which blocks the send outright.
 */
export function promoteInitialsBoxes(
  map: readonly MappedField[],
  principals: readonly SignerRole[] = ['buyer', 'seller'],
  pages: ReadonlyArray<readonly PageTextRun[]> = [],
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
    const clusters: { f: MappedField; i: number }[][] = []
    const runs = pages[group[0]!.f.page - 1] ?? []
    for (const g of group) {
      const cur = clusters[clusters.length - 1]
      const prev = cur?.[cur.length - 1]
      // A new label printed between two boxes ("... ___ Seller Initials ___") starts a new cluster however close.
      const relabelled = !!cur && printedRole(rowLabel(g.f, runs)) != null
      if (cur && prev && g.f.x - (prev.f.x + prev.f.w) <= CLUSTER_GAP && !relabelled) cur.push(g)
      else clusters.push([g])
    }
    const labels = clusters.map((c) => rowLabel(c[0]!.f, runs))
    const printed = labels.map(printedRole)
    // "Seller(s) Initials (required if option [a] is selected)" (the 015): nobody owes it until then.
    const conditional = (label: string) => CONDITIONAL.test(label)
    if (printed.every((r) => r === 'buyer' || r === 'seller')) {
      clusters.forEach((c, ci) =>
        c.forEach((g, idx) => {
          const onlyIf = conditional(labels[ci]!)
          out[g.i] = {
            ...g.f,
            type: 'initials',
            signerRole: printed[ci]!,
            optional: idx > 0 || onlyIf,
            signerIndex: idx,
            label: `${printed[ci] === 'buyer' ? 'Buyer' : 'Seller'} initials`,
            ...(onlyIf ? { conditional: true } : {}),
          }
        }),
      )
      continue
    }
    const mid = (group[0]!.f.x + group[group.length - 1]!.f.x) / 2
    const left = group.filter((g) => g.f.x < mid)
    const right = group.filter((g) => g.f.x >= mid)
    const assign = (cluster: { f: MappedField; i: number }[], role: SignerRole) => {
      const onlyIf = cluster.length > 0 && conditional(rowLabel(cluster[0]!.f, runs))
      cluster.forEach((g, idx) => {
        out[g.i] = { ...g.f, type: 'initials', signerRole: role, optional: idx > 0 || onlyIf, ...(onlyIf ? { conditional: true } : {}) }
      })
    }
    // One principal on the form means the whole row is theirs, both clusters.
    const leftRole = signing.length > 1 ? signing[0]! : (signing[0] ?? null)
    const rightRole = signing.length > 1 ? signing[1]! : (signing[0] ?? null)
    assign(left, leftRole)
    assign(right, rightRole)
  }
  // A lone initials box ("By Seller (initials) ___") is the one its printed label names.
  for (let i = 0; i < out.length; i++) {
    const f = out[i]!
    if (f.type !== 'initials' || f.signerRole) continue
    const role = printedRole(rowLabel(f, pages[f.page - 1] ?? []))
    if (role) out[i] = { ...f, signerRole: role }
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

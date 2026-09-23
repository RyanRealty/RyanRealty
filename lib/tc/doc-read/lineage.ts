/**
 * One copy per form instance. Pure.
 *
 * A deal collects the same form many times: the buyer-signed offer, the copy
 * with the seller's counter, the fully executed packet, the re-send, the
 * email forward. The file should hold ONE: the most complete copy of each
 * form instance. Every other copy goes to the archive with the reason and a
 * pointer to the copy that replaced it (archive is the Vault's delete, and
 * it is reversible). Only fully executed copies sit on the checklist.
 *
 * Precedence (canonical-selection.md, carried into code):
 *  1. identical files: one stays.
 *  2. fully executed (or signed-and-countered, or signed-and-rejected) beats
 *     any partial, unsigned or blank copy of the same instance.
 *  3. a copy whose signers are a superset beats the subset copy.
 *  4. ties: the copy already on the checklist, then the newest.
 *  5. can't tell two copies apart (no buyer names, no addendum number or
 *     terms): nothing moves; the group is flagged for a person.
 *
 * Never automatic: a document a person archived or restored, a checklist row
 * the principal already approved, or anything the reader could not identify
 * against the form library.
 */
import type { DocumentVerdict, ExecutionVerdict, FormVerdict } from './verdict'
import { VERDICT_LABEL, verdictRank } from './verdict'

export type LineageDoc = {
  id: string
  name: string
  contentType?: string | null
  bytes?: number | null
  sha256: string | null
  ingestedAt: string
  /** Checklist rows this document sits on now. */
  linkedItemIds: string[]
  /** A person archived or restored this document: the reader never moves it. */
  personDecided: boolean
  /** A source document of a signing envelope: the envelope points at it, so it never moves. */
  inEnvelope?: boolean
  /**
   * The Vault made this file (a sealed envelope, a filled OREF form, a CDA):
   * who signed it is a fact in tc_envelope_recipients, not a reading.
   */
  generated?: boolean
  verdict: DocumentVerdict | null
}

export type LineageItem = {
  id: string
  name: string
  typeName: string | null
  /** Principal-approved rows are the compliance record; the reader never changes them. */
  locked: boolean
}

export type LineageAction =
  | { kind: 'archive'; docId: string; reason: string; supersededBy: string | null }
  | { kind: 'link'; docId: string; itemId: string; reason: string }
  | { kind: 'unlink'; docId: string; itemId: string; reason: string }
  | { kind: 'flag'; docId: string; reason: string }

export type InstanceSummary = {
  key: string
  formName: string
  instanceNumber: string | null
  canonicalDocId: string
  verdict: ExecutionVerdict
  memberDocIds: string[]
  waitingOn: string[]
}

export type LineagePlan = {
  actions: LineageAction[]
  instances: InstanceSummary[]
}

/**
 * An image an email carried inline (a logo, a signature graphic) that the old
 * mail filer stored as a document: small, and named the way mail clients name
 * embedded parts (image001.png, _WRD0005.jpg, "img <uuid> 217.png", noname).
 * A real photo of a signed page is large and named by a person.
 */
export function isEmailEmbed(d: Pick<LineageDoc, 'name' | 'contentType' | 'bytes'>): boolean {
  const type = (d.contentType ?? '').toLowerCase()
  if (type === 'application/pdf') return false
  if ((d.bytes ?? 0) > 200_000) return false
  return /^(image\d{3}|_wrd\d+|img [0-9a-f]{8} - |noname)/i.test(d.name.trim())
}

/** Signing parties that closed out a deal: nothing is still in flight. */
export function cycleIsFinished(stage: string | null | undefined): boolean {
  return stage === 'closed' || stage === 'dead'
}

const DONE: ReadonlySet<ExecutionVerdict> = new Set(['fully_executed', 'countered', 'rejected'])
const IN_PROGRESS: ReadonlySet<ExecutionVerdict> = new Set(['partially_executed', 'unsigned'])
/** Offers and counteroffers: an unaccepted copy is negotiation history, not a gap. */
const OFFER_PROFILES: ReadonlySet<string> = new Set(['oref-001-rsa', 'generic-purchase-agreement', 'oref-003-counter', 'generic-counter'])

function signedNames(f: FormVerdict): Set<string> {
  return new Set(f.signers.filter((s) => s.signed).map((s) => `${s.party}:${(s.name ?? s.signedAs ?? '').toLowerCase()}`))
}

function signedCount(f: FormVerdict): number {
  return f.signers.filter((s) => s.signed).length
}

function isSubset(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) if (!b.has(x)) return false
  return true
}

type Member = { doc: LineageDoc; form: FormVerdict }

/** Identified by the printed lines alone, or its printed number contradicts its title. */
function unsure(f: FormVerdict): boolean {
  return f.basis === 'lines' || f.numberConflict
}

function describe(f: FormVerdict): string {
  const n = f.instanceNumber ? ` #${f.instanceNumber}` : ''
  return `${f.formName}${n}`
}

function waitingOn(f: FormVerdict): string[] {
  return f.signers.filter((s) => !s.signed).map((s) => (s.name ? `${s.name} (${s.party.replace('_', ' ')})` : s.party.replace('_', ' ')))
}

/**
 * Checklist rows a fully executed form belongs on. `match` is the caller's
 * checklist matcher (file-comms matchChecklistItems) so the reader and the
 * mail filer place documents by the same rules.
 */
export type ChecklistMatcher = (items: readonly LineageItem[], haystack: string) => LineageItem[]

export function planLineage(input: {
  stage: string
  docs: readonly LineageDoc[]
  items: readonly LineageItem[]
  match: ChecklistMatcher
}): LineagePlan {
  const actions: LineageAction[] = []
  const instances: InstanceSummary[] = []
  const finished = cycleIsFinished(input.stage)
  const archived = new Map<string, { reason: string; by: string | null; identical?: boolean }>()
  const itemById = new Map(input.items.map((i) => [i.id, i]))

  const movable = (d: LineageDoc) => !d.personDecided && !d.inEnvelope && !d.generated
  const archive = (d: LineageDoc, reason: string, by: string | null, identical = false) => {
    if (!movable(d) || archived.has(d.id)) return
    archived.set(d.id, { reason, by, identical })
  }

  // 0. Images an email carried inline are not transaction documents.
  for (const d of input.docs) {
    if (isEmailEmbed(d)) archive(d, 'Not a transaction document: an image embedded in an email (a logo or signature graphic).', null)
  }

  // 1. Identical files: keep the one on the checklist, else the first filed.
  const live = input.docs.filter((d) => d.verdict)
  const bySha = new Map<string, LineageDoc[]>()
  for (const d of input.docs) {
    if (!d.sha256) continue
    bySha.set(d.sha256, [...(bySha.get(d.sha256) ?? []), d])
  }
  for (const group of bySha.values()) {
    if (group.length < 2) continue
    const keep = [...group].sort(
      (a, b) =>
        Number(b.personDecided) - Number(a.personDecided) ||
        Number(!!b.inEnvelope) - Number(!!a.inEnvelope) ||
        Number(!!b.generated) - Number(!!a.generated) ||
        b.linkedItemIds.length - a.linkedItemIds.length ||
        a.ingestedAt.localeCompare(b.ingestedAt),
    )[0]
    for (const d of group) if (d.id !== keep.id) archive(d, `Duplicate of "${keep.name}" (identical file).`, keep.id, true)
  }

  // 2. Group form instances across documents.
  const groups = new Map<string, Member[]>()
  for (const d of live) {
    if (archived.has(d.id)) continue
    for (const f of d.verdict!.forms) {
      if (f.verdict === 'reference' || f.verdict === 'needs_review') continue
      groups.set(f.instanceKey, [...(groups.get(f.instanceKey) ?? []), { doc: d, form: f }])
    }
  }

  // Per document: which of its forms were superseded, and by what.
  const superseded = new Map<string, Array<{ form: FormVerdict; by: Member }>>()
  const canonicalForms = new Map<string, FormVerdict[]>()

  for (const [key, members] of groups) {
    const ranked = [...members].sort(
      (a, b) =>
        verdictRank(b.form.verdict) - verdictRank(a.form.verdict) ||
        signedCount(b.form) - signedCount(a.form) ||
        b.doc.linkedItemIds.length - a.doc.linkedItemIds.length ||
        b.doc.ingestedAt.localeCompare(a.doc.ingestedAt),
    )
    const top = ranked[0]
    canonicalForms.set(top.doc.id, [...(canonicalForms.get(top.doc.id) ?? []), top.form])
    instances.push({
      key,
      formName: top.form.formName,
      instanceNumber: top.form.instanceNumber,
      canonicalDocId: top.doc.id,
      verdict: top.form.verdict,
      memberDocIds: [...new Set(members.map((m) => m.doc.id))],
      waitingOn: IN_PROGRESS.has(top.form.verdict) ? waitingOn(top.form) : [],
    })
    const distinctDocs = new Set(members.map((m) => m.doc.id))
    if (distinctDocs.size < 2) continue
    if (members.some((m) => m.form.weakKey || unsure(m.form))) {
      // On a finished deal unfinished copies leave by the rule below anyway;
      // asking a person to pick between them is noise.
      const allUnfinished = members.every((m) => IN_PROGRESS.has(m.form.verdict) || m.form.verdict === 'blank')
      if (finished && allUnfinished) continue
      for (const m of ranked.slice(1)) {
        if (m.doc.id === top.doc.id) continue
        actions.push({
          kind: 'flag',
          docId: m.doc.id,
          reason: `Another copy of ${describe(m.form)} is on this deal, and the reader cannot tell the copies apart (no party names or form number). A person decides which stays.`,
        })
      }
      continue
    }
    // One copy says executed and another says rejected: they cannot both be
    // the same instance's final record. A person reads them.
    const finals = new Set(members.map((m) => m.form.verdict).filter((v) => v === 'fully_executed' || v === 'rejected'))
    if (finals.size > 1) {
      for (const m of ranked.slice(1)) {
        if (m.doc.id === top.doc.id) continue
        actions.push({
          kind: 'flag',
          docId: m.doc.id,
          reason: `One copy of ${describe(m.form)} reads fully executed and another reads rejected. A person decides which is the final record.`,
        })
      }
      continue
    }
    const topSigned = signedNames(top.form)
    for (const m of ranked.slice(1)) {
      if (m.doc.id === top.doc.id) continue
      const dominated =
        DONE.has(top.form.verdict) ||
        (verdictRank(top.form.verdict) >= verdictRank(m.form.verdict) && isSubset(signedNames(m.form), topSigned))
      if (dominated) superseded.set(m.doc.id, [...(superseded.get(m.doc.id) ?? []), { form: m.form, by: top }])
    }
  }

  // The deal's contract is on file when some sale agreement copy is executed or
  // signed-and-countered, or some counteroffer was accepted.
  const contractOnFile = live.some((d) =>
    d.verdict!.forms.some(
      (f) => OFFER_PROFILES.has(f.profileKey ?? '') && (f.verdict === 'fully_executed' || f.verdict === 'countered'),
    ),
  )

  // 3. A document goes to the archive only when every form in it was superseded
  //    (a packet whose addendum lives on elsewhere still holds the sale agreement).
  for (const d of live) {
    if (archived.has(d.id)) continue
    const forms = d.verdict!.forms.filter((f) => f.verdict !== 'reference')
    if (!forms.length) continue
    const sup = superseded.get(d.id) ?? []
    if (sup.length && forms.every((f) => sup.some((s) => s.form === f))) {
      const by = sup[0].by
      const what = forms.map((f) => `${describe(f)} (${VERDICT_LABEL[f.verdict].toLowerCase()})`).join(', ')
      archive(
        d,
        DONE.has(by.form.verdict)
          ? `Superseded: ${what}. The ${VERDICT_LABEL[by.form.verdict].toLowerCase()} copy is "${by.doc.name}".`
          : `Earlier copy: ${what}. A more complete copy is "${by.doc.name}".`,
        by.doc.id,
      )
      continue
    }
    // A blank copy goes only when a better copy of the same form is on file:
    // an unsigned pamphlet may be the only record that it was delivered.
    if (d.verdict!.verdict === 'blank' && forms.every((f) => !unsure(f))) {
      const better = live.find(
        (o) =>
          o.id !== d.id &&
          !archived.has(o.id) &&
          o.verdict!.forms.some((of) => forms.some((f) => f.profileKey && of.profileKey === f.profileKey) && verdictRank(of.verdict) > verdictRank('blank')),
      )
      if (better) {
        archive(d, `Blank form: nothing filled in or signed. The filled copy is "${better.name}".`, better.id)
        continue
      }
    }
    // A finished deal: an offer copy nobody accepted leaves the file (kept, per
    // OAR 863-015-0250). Any other form whose only copy is unfinished is a
    // compliance gap, not clutter: it stays where it is and a person is told,
    // because the partial copy is the only record there is.
    if (finished && forms.every((f) => IN_PROGRESS.has(f.verdict) || f.verdict === 'blank')) {
      const f = forms[0]
      const missing = waitingOn(f)
      const never = missing.length ? `, never signed by ${missing.join(', ')}` : ''
      // Only when the deal's executed contract is on file: otherwise this copy
      // may be the only record of the contract, and that is a gap to report.
      if (contractOnFile && forms.every((x) => OFFER_PROFILES.has(x.profileKey ?? '') && !unsure(x))) {
        archive(d, `Offer copy not accepted: ${describe(f)} ${VERDICT_LABEL[f.verdict].toLowerCase()}${never}. Kept per OAR 863-015-0250.`, null)
      } else {
        actions.push({ kind: 'flag', docId: d.id, reason: `No fully executed copy of ${describe(f)} on this closed file${never}.` })
      }
    }
  }

  for (const [docId, a] of archived) actions.push({ kind: 'archive', docId, reason: a.reason, supersededBy: a.by })

  // 4. Checklist. An archived copy comes off its rows and the copy that
  //    replaced it goes on the same rows: that is where a person (or SkySlope)
  //    already decided the form belongs. On a live deal an unfinished copy
  //    comes off too; it goes back on when its executed copy arrives.
  const linked = new Set<string>()
  const link = (docId: string, itemId: string, reason: string) => {
    const key = `${docId}|${itemId}`
    if (linked.has(key)) return
    linked.add(key)
    actions.push({ kind: 'link', docId, itemId, reason })
  }
  for (const d of input.docs) {
    const gone = archived.get(d.id)
    const docVerdict = d.verdict?.verdict ?? null
    const unfinished = !!docVerdict && (IN_PROGRESS.has(docVerdict) || docVerdict === 'blank')
    if (!gone && !(unfinished && !finished)) continue
    if (d.personDecided) continue
    const replacement = gone?.by ? input.docs.find((x) => x.id === gone.by) ?? null : null
    for (const itemId of d.linkedItemIds) {
      const item = itemById.get(itemId)
      if (item?.locked) {
        actions.push({
          kind: 'flag',
          docId: d.id,
          reason: `"${d.name}" is on the approved checklist row "${item.name}" but ${gone ? 'was superseded' : 'is not fully executed'}. The principal decides.`,
        })
        continue
      }
      actions.push({
        kind: 'unlink',
        docId: d.id,
        itemId,
        reason: gone ? (gone.by ? 'Archived: a better copy replaces it.' : 'Archived (see the archive reason).') : `Not fully executed (${VERDICT_LABEL[docVerdict!].toLowerCase()}).`,
      })
      if (replacement && !replacement.linkedItemIds.includes(itemId) && !archived.has(replacement.id) && item) {
        // The same file keeps whatever placement it already had (a packet
        // filed under several rows). A different, better copy takes the row
        // only when the row fits its form: rows set by the old keyword filer
        // are not carried forward.
        const fits = (replacement.verdict?.forms ?? []).some((f) => input.match([item], f.formName).length > 0)
        if (gone?.identical || fits) link(replacement.id, itemId, `Replaces "${d.name}" on this row.`)
      }
    }
  }
  // An executed copy on no row at all goes on the one row its form matches:
  // an empty row for a one-per-deal form (sale agreement, disclosure,
  // receipt), and the row even if occupied for forms a deal has several of
  // (addenda, counteroffers, notices). No match, or several: a person decides.
  const occupied = new Set(input.docs.filter((d) => !archived.has(d.id)).flatMap((d) => d.linkedItemIds))
  for (const a of actions) if (a.kind === 'link') occupied.add(a.itemId)
  for (const a of actions) if (a.kind === 'unlink') {
    const stillThere = input.docs.some((d) => d.id !== a.docId && !archived.has(d.id) && d.linkedItemIds.includes(a.itemId))
    if (!stillThere && !actions.some((x) => x.kind === 'link' && x.itemId === a.itemId)) occupied.delete(a.itemId)
  }
  for (const [docId, forms] of canonicalForms) {
    if (archived.has(docId)) continue
    const d = input.docs.find((x) => x.id === docId)!
    if (d.personDecided || d.linkedItemIds.length || actions.some((a) => a.kind === 'link' && a.docId === docId)) continue
    for (const f of forms) {
      const executed = f.verdict === 'fully_executed' || (f.verdict === 'countered' && f.profileKey !== null)
      if (!executed || f.basis === 'generic' || unsure(f)) continue
      const candidates = input.match(input.items, f.formName).filter((i) => !i.locked && (f.numbered || !occupied.has(i.id)))
      if (candidates.length !== 1) continue
      occupied.add(candidates[0].id)
      link(docId, candidates[0].id, `${VERDICT_LABEL[f.verdict]} ${describe(f)}.`)
    }
  }
  return { actions, instances }
}

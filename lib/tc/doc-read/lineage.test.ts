import { describe, expect, it } from 'vitest'
import { planLineage, type LineageDoc, type LineageItem } from './lineage'
import { documentVerdict, type FormVerdict, type ExecutionVerdict, type SignerStatus } from './verdict'

const signer = (party: SignerStatus['party'], name: string, isSigned: boolean): SignerStatus => ({
  party,
  name,
  signed: isSigned,
  signedAs: isSigned ? name : null,
  date: null,
  method: isSigned ? 'esign_stamp' : null,
  missingSections: isSigned ? [] : ['x'],
})

const fv = (over: Partial<FormVerdict> & { verdict: ExecutionVerdict }): FormVerdict => ({
  segment: 1,
  profileKey: 'oref-002-addendum',
  formName: 'Addendum to Sale Agreement',
  basis: 'library',
  numberConflict: false,
  instanceNumber: '1',
  counterBy: null,
  saleAgreementNumber: null,
  outcome: null,
  signers: [],
  reasons: [],
  instanceKey: 'oref-002-addendum|n1|b:nicoll',
  weakKey: false,
  numbered: true,
  checklistTerms: ['addendum'],
  ...over,
})

const doc = (id: string, forms: FormVerdict[], over: Partial<LineageDoc> = {}): LineageDoc => ({
  id,
  name: `${id}.pdf`,
  sha256: `sha-${id}`,
  ingestedAt: `2026-05-0${id.length}T00:00:00Z`,
  linkedItemIds: [],
  personDecided: false,
  verdict: documentVerdict(forms),
  ...over,
})

const items: LineageItem[] = [
  { id: 'item-add', name: 'Addendums', typeName: null, locked: false },
  { id: 'item-rsa', name: 'Sale Agreement', typeName: null, locked: false },
]
const match = (its: readonly LineageItem[], hay: string) =>
  its.filter((i) => (/addendum/i.test(hay) && /addend/i.test(i.name)) || (/sale agreement/i.test(hay) && /sale agreement/i.test(i.name)))

const executed = fv({ verdict: 'fully_executed', signers: [signer('buyer', 'Tyler Nicoll', true), signer('seller', 'Mary Bowman', true)] })
const sellerOnly = fv({ verdict: 'partially_executed', signers: [signer('buyer', 'Tyler Nicoll', false), signer('seller', 'Mary Bowman', true)] })

describe('planLineage', () => {
  it('keeps the fully executed copy, archives the partial one with a pointer, and puts only the executed copy on the checklist', () => {
    const plan = planLineage({
      stage: 'pending',
      docs: [doc('partial', [sellerOnly], { linkedItemIds: ['item-add'] }), doc('final', [executed])],
      items,
      match,
    })
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: 'archive', docId: 'partial', supersededBy: 'final' }))
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: 'unlink', docId: 'partial', itemId: 'item-add' }))
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: 'link', docId: 'final', itemId: 'item-add' }))
    const archive = plan.actions.find((a) => a.kind === 'archive')!
    expect(archive.kind === 'archive' && archive.reason).toMatch(/Superseded: Addendum to Sale Agreement #1 \(partially signed\)\. The fully executed copy is "final\.pdf"/)
  })

  it('identical files keep the one on the checklist', () => {
    const plan = planLineage({
      stage: 'pending',
      docs: [doc('a', [executed], { sha256: 'same' }), doc('bb', [executed], { sha256: 'same', linkedItemIds: ['item-add'] })],
      items,
      match,
    })
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: 'archive', docId: 'a', supersededBy: 'bb' }))
    expect(plan.actions.some((a) => a.kind === 'archive' && a.docId === 'bb')).toBe(false)
  })

  it('on a live deal the only copy of an unfinished addendum stays, off the checklist', () => {
    const plan = planLineage({ stage: 'pending', docs: [doc('partial', [sellerOnly], { linkedItemIds: ['item-add'] })], items, match })
    expect(plan.actions.some((a) => a.kind === 'archive')).toBe(false)
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: 'unlink', docId: 'partial', itemId: 'item-add' }))
    expect(plan.instances[0].waitingOn).toEqual(['Tyler Nicoll (buyer)'])
  })

  it('on a closed deal an offer that was never accepted goes to the archive, kept per OAR', () => {
    const offer = fv({
      profileKey: 'oref-001-rsa',
      formName: 'Residential Real Estate Sale Agreement',
      instanceNumber: null,
      instanceKey: 'oref-001-rsa|b:other',
      verdict: 'partially_executed',
      signers: [signer('buyer', 'Other Buyer', true), signer('seller', 'Mary Bowman', false)],
    })
    const plan = planLineage({ stage: 'closed', docs: [doc('offer', [offer])], items, match })
    const a = plan.actions.find((x) => x.kind === 'archive')
    expect(a && a.kind === 'archive' && a.reason).toMatch(/^Offer copy not accepted: .*never signed by Mary Bowman \(seller\)\. Kept per OAR 863-015-0250\.$/)
  })

  it('on a closed deal the only, partially signed disclosure stays on its row and is reported', () => {
    const spd = fv({
      profileKey: 'oref-020-spd',
      formName: "Seller's Property Disclosure Statement",
      instanceNumber: null,
      instanceKey: 'oref-020-spd',
      verdict: 'partially_executed',
      signers: [signer('seller', 'Douglas Halpin', true), signer('buyer', 'Elsa Uchikawa', false)],
    })
    const plan = planLineage({ stage: 'closed', docs: [doc('spd', [spd], { linkedItemIds: ['item-spd'] })], items: [...items, { id: 'item-spd', name: 'Property Disclosure', typeName: null, locked: false }], match })
    expect(plan.actions).toEqual([
      { kind: 'flag', docId: 'spd', reason: "No fully executed copy of Seller's Property Disclosure Statement on this closed file, never signed by Elsa Uchikawa (buyer)." },
    ])
  })

  it('the executed copy takes the row its superseded copy was on', () => {
    const plan = planLineage({
      stage: 'closed',
      docs: [doc('partial', [sellerOnly], { linkedItemIds: ['item-custom'] }), doc('final', [executed])],
      items: [...items, { id: 'item-custom', name: 'Repairs agreed', typeName: null, locked: false }],
      match,
    })
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: 'link', docId: 'final', itemId: 'item-custom' }))
    expect(plan.actions.some((a) => a.kind === 'link' && a.itemId === 'item-add')).toBe(false)
  })

  it('a packet whose addendum is superseded elsewhere stays: it still holds the executed sale agreement', () => {
    const rsa = fv({ profileKey: 'oref-001-rsa', formName: 'Residential Real Estate Sale Agreement', instanceNumber: null, instanceKey: 'oref-001-rsa|b:nicoll', verdict: 'fully_executed', signers: executed.signers })
    const plan = planLineage({
      stage: 'pending',
      docs: [doc('packet', [rsa, sellerOnly]), doc('final-add', [executed])],
      items,
      match,
    })
    expect(plan.actions.some((a) => a.kind === 'archive' && a.docId === 'packet')).toBe(false)
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: 'link', docId: 'packet', itemId: 'item-rsa' }))
  })

  it('copies it cannot tell apart are flagged, not archived', () => {
    const weak = fv({ verdict: 'unsigned', instanceNumber: null, instanceKey: 'oref-002-addendum', weakKey: true })
    const live = planLineage({ stage: 'pending', docs: [doc('x', [weak]), doc('yy', [{ ...weak }])], items, match })
    expect(live.actions.filter((a) => a.kind === 'flag')).toHaveLength(1)
    expect(live.actions.some((a) => a.kind === 'archive')).toBe(false)
    // On a closed deal each is a gap to report, never an archive.
    const closed = planLineage({ stage: 'closed', docs: [doc('x', [weak]), doc('yy', [{ ...weak }])], items, match })
    expect(closed.actions.filter((a) => a.kind === 'archive')).toHaveLength(0)
    expect(closed.actions.filter((a) => a.kind === 'flag').map((a) => a.kind === 'flag' && a.reason)).toEqual([
      'No fully executed copy of Addendum to Sale Agreement on this closed file.',
      'No fully executed copy of Addendum to Sale Agreement on this closed file.',
    ])
  })

  it('never moves a document a person archived or restored, and never touches an approved row', () => {
    const plan = planLineage({
      stage: 'closed',
      docs: [
        doc('kept-by-matt', [sellerOnly], { personDecided: true, linkedItemIds: ['item-add'] }),
        doc('approved', [sellerOnly], { linkedItemIds: ['item-locked'] }),
      ],
      items: [...items, { id: 'item-locked', name: 'Addendums (approved)', typeName: null, locked: true }],
      match,
    })
    expect(plan.actions.some((a) => a.docId === 'kept-by-matt')).toBe(false)
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: 'flag', docId: 'approved' }))
    expect(plan.actions.some((a) => a.kind === 'unlink' && a.itemId === 'item-locked')).toBe(false)
  })

  it('does not act on a form the library does not know', () => {
    const lines = fv({ profileKey: null, basis: 'lines', verdict: 'fully_executed', instanceKey: 'title:noticeofdisapproval|b:nicoll' })
    const plan = planLineage({ stage: 'pending', docs: [doc('n1', [lines]), doc('n22', [{ ...lines, verdict: 'partially_executed' }])], items, match })
    expect(plan.actions.some((a) => a.kind === 'archive' || a.kind === 'link')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { isEmailEmbed, planLineage, type LineageDoc, type LineageItem } from './lineage'
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
  rule: null,
  confidence: 'library',
  offer: false,
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
      offer: true,
      formName: 'Residential Real Estate Sale Agreement',
      instanceNumber: null,
      instanceKey: 'oref-001-rsa|b:other',
      verdict: 'partially_executed',
      signers: [signer('buyer', 'Other Buyer', true), signer('seller', 'Mary Bowman', false)],
    })
    const contract = fv({
      profileKey: 'oref-001-rsa',
      offer: true,
      formName: 'Residential Real Estate Sale Agreement',
      instanceNumber: null,
      instanceKey: 'oref-001-rsa|b:nicoll',
      verdict: 'fully_executed',
      signers: executed.signers,
    })
    const plan = planLineage({ stage: 'closed', docs: [doc('offer', [offer]), doc('contract', [contract])], items, match })
    const a = plan.actions.find((x) => x.kind === 'archive')
    expect(a && a.kind === 'archive' && a.reason).toMatch(/^Offer copy not accepted: .*never signed by Mary Bowman \(seller\)\. Kept per OAR 863-015-0250\.$/)

    // Without the executed contract on file the copy may be the only record of it: a gap, not an archive.
    const alone = planLineage({ stage: 'closed', docs: [doc('offer', [offer])], items, match })
    expect(alone.actions).toEqual([expect.objectContaining({ kind: 'flag', docId: 'offer', reason: expect.stringMatching(/^No fully executed copy of Residential Real Estate Sale Agreement/) })])
  })

  it('an executed copy and a rejected copy of one instance go to a person', () => {
    const rejected = { ...executed, verdict: 'rejected' as const }
    const plan = planLineage({ stage: 'closed', docs: [doc('ok', [executed]), doc('no', [rejected])], items, match })
    expect(plan.actions.some((a) => a.kind === 'archive')).toBe(false)
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: 'flag', docId: 'no' }))
  })

  it('never archives a signing envelope\'s source document', () => {
    const plan = planLineage({
      stage: 'pending',
      docs: [doc('draft', [sellerOnly], { inEnvelope: true, sha256: 'same' }), doc('copy', [sellerOnly], { sha256: 'same' })],
      items,
      match,
    })
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: 'archive', docId: 'copy', supersededBy: 'draft' }))
    expect(plan.actions.some((a) => a.kind === 'archive' && a.docId === 'draft')).toBe(false)
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

  it('a better copy takes its predecessor\'s row only when the row fits the form; an identical file keeps any row', () => {
    const rows = [...items, { id: 'item-hoa', name: 'Association & CCRs Documents', typeName: null, locked: false }]
    // The old keyword filer put an addendum on the HOA row: not carried forward.
    const plan = planLineage({ stage: 'closed', docs: [doc('partial', [sellerOnly], { linkedItemIds: ['item-hoa'] }), doc('final', [executed])], items: rows, match })
    expect(plan.actions.some((a) => a.kind === 'link' && a.itemId === 'item-hoa')).toBe(false)
    // On the addenda row it is.
    const fit = planLineage({ stage: 'closed', docs: [doc('partial', [sellerOnly], { linkedItemIds: ['item-add'] }), doc('final', [executed])], items: rows, match })
    expect(fit.actions).toContainEqual(expect.objectContaining({ kind: 'link', docId: 'final', itemId: 'item-add' }))
    // The same bytes filed under the HOA row keep that row.
    const same = planLineage({ stage: 'closed', docs: [doc('a', [executed], { sha256: 'x' }), doc('bb', [executed], { sha256: 'x', linkedItemIds: ['item-hoa'] }), doc('ccc', [executed], { sha256: 'x', linkedItemIds: ['item-add'] })], items: rows, match })
    // bb (on a row, filed first) stays; ccc's addenda row moves onto it; bb keeps its HOA row.
    expect(same.actions.filter((a) => a.kind === 'link')).toEqual([
      { kind: 'link', docId: 'bb', itemId: 'item-add', reason: 'Replaces "ccc.pdf" on this row.' },
    ])
    expect(same.actions.some((a) => a.kind === 'unlink' && a.docId === 'bb')).toBe(false)
  })

  it('a packet whose addendum is superseded elsewhere stays: it still holds the executed sale agreement', () => {
    const rsa = fv({ profileKey: 'oref-001-rsa', offer: true, formName: 'Residential Real Estate Sale Agreement', instanceNumber: null, instanceKey: 'oref-001-rsa|b:nicoll', verdict: 'fully_executed', signers: executed.signers })
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

  it('archives images an email carried inline, never a real photo or a PDF', () => {
    expect(isEmailEmbed({ name: 'image001_112.jpg', contentType: 'image/jpeg', bytes: 29787 })).toBe(true)
    expect(isEmailEmbed({ name: '_WRD0005_767.jpg', contentType: 'image/jpeg', bytes: 823 })).toBe(true)
    expect(isEmailEmbed({ name: 'img 2e65b90d - af86 - 463a - 852b - 97a1f645fa04 217.png', contentType: 'image/png', bytes: 547 })).toBe(true)
    expect(isEmailEmbed({ name: 'noname_303', contentType: 'application/octet-stream', bytes: 68223 })).toBe(true)
    expect(isEmailEmbed({ name: 'Commons___Irrigation-Water-0001.jpg', contentType: 'image/jpeg', bytes: 4560248 })).toBe(false)
    expect(isEmailEmbed({ name: 'image001.pdf', contentType: 'application/pdf', bytes: 2000 })).toBe(false)
    const plan = planLineage({ stage: 'pending', docs: [{ ...doc('logo', []), name: 'image002_786.png', contentType: 'image/png', bytes: 18546, verdict: null }], items, match })
    expect(plan.actions).toEqual([
      { kind: 'archive', docId: 'logo', reason: 'Not a transaction document: an image embedded in an email (a logo or signature graphic).', supersededBy: null },
    ])
  })

  it('a blank copy goes only when a filled copy of the same form is on file', () => {
    const blank = { ...executed, verdict: 'blank' as const, signers: [] }
    const alone = planLineage({ stage: 'pending', docs: [doc('blank', [blank])], items, match })
    expect(alone.actions.some((a) => a.kind === 'archive')).toBe(false)
    const withFilled = planLineage({ stage: 'pending', docs: [doc('blank', [{ ...blank, instanceKey: 'other' }]), doc('filled', [executed])], items, match })
    expect(withFilled.actions).toContainEqual(expect.objectContaining({ kind: 'archive', docId: 'blank', supersededBy: 'filled' }))
  })

  it('never moves a file the Vault produced (a sealed envelope reads as its own record)', () => {
    const plan = planLineage({ stage: 'pending', docs: [doc('sealed', [sellerOnly], { generated: true, sha256: 'x' }), doc('sealed2', [sellerOnly], { generated: true, sha256: 'x' })], items, match })
    expect(plan.actions.some((a) => a.kind === 'archive')).toBe(false)
  })
})

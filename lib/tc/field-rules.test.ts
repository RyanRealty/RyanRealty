import { describe, expect, it } from 'vitest'
import {
  checkSubmission,
  dateValue,
  fieldOwner,
  formatFieldDate,
  formatFieldTime,
  groupFromRule,
  groupRule,
  groupRuleText,
  groupSatisfied,
  isIsoDate,
  nextChecklistItem,
  pacificStamp,
  preparedField,
  signatureRowSiblings,
  signerChecklist,
  timeValue,
  valueIsFilled,
} from './field-rules'
import type { EnvelopeField, SignFieldValue } from './signing'

const BUYER = 'buyer-1'
const SELLER = 'seller-1'
let n = 0
const field = (over: Partial<EnvelopeField>): EnvelopeField => ({
  id: over.id ?? `f${++n}`,
  documentId: 'doc',
  recipientId: BUYER,
  type: 'text',
  page: 1,
  x: 0.1,
  y: 0.1,
  w: 0.2,
  h: 0.03,
  required: false,
  value: null,
  signedAt: null,
  ...over,
})
const PNG = 'data:image/png;base64,iVBORw0KGgo='

describe('who fills a field', () => {
  it('is the broker when nobody is assigned (locked), the signer when it is theirs', () => {
    expect(fieldOwner({ recipientId: null }, BUYER)).toBe('locked')
    expect(fieldOwner({ recipientId: BUYER }, BUYER)).toBe('mine')
    expect(fieldOwner({ recipientId: SELLER }, BUYER)).toBe('theirs')
  })
})

describe('dates and times', () => {
  it('accepts only real calendar dates and prints them the way Oregon forms do', () => {
    expect(isIsoDate('2026-11-30')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('11/30/2026')).toBe(false)
    expect(formatFieldDate('2026-11-30')).toBe('11/30/2026')
    expect(dateValue('2026-11-30')).toEqual({ kind: 'date', iso: '2026-11-30', text: '11/30/2026' })
    expect(dateValue('1776-07-04')).toBeNull()
  })

  it('prints a picked time in 12-hour form', () => {
    expect(formatFieldTime('00:05')).toBe('12:05 AM')
    expect(formatFieldTime('12:00')).toBe('12:00 PM')
    expect(formatFieldTime('17:30')).toBe('5:30 PM')
    expect(timeValue('24:00')).toBeNull()
  })

  it('stamps the signing moment in Oregon time', () => {
    expect(pacificStamp(new Date('2026-09-25T03:30:00Z'))).toEqual({ date: '09/24/2026', time: '8:30 PM' })
  })
})

describe('checkbox groups', () => {
  it('reads the three rules the way DigiSign offers them', () => {
    expect(groupRule(groupFromRule('g', { kind: 'exactly', n: 1 }))).toEqual({ kind: 'exactly', n: 1 })
    expect(groupRule(groupFromRule('g', { kind: 'at_least', n: 2 }))).toEqual({ kind: 'at_least', n: 2 })
    expect(groupRule(groupFromRule('g', { kind: 'at_most', n: 3 }))).toEqual({ kind: 'at_most', n: 3 })
    expect(groupRuleText({ min: 1, max: 1 })).toBe('Select exactly 1 box')
    expect(groupRuleText({ min: null, max: 2 })).toBe('Select up to 2 boxes')
  })

  it('holds the count to the rule', () => {
    expect(groupSatisfied({ min: 1, max: 1 }, 0)).toBe(false)
    expect(groupSatisfied({ min: 1, max: 1 }, 1)).toBe(true)
    expect(groupSatisfied({ min: 1, max: 1 }, 2)).toBe(false)
    expect(groupSatisfied({ min: null, max: 2 }, 0)).toBe(true)
  })
})

describe("the signer's checklist", () => {
  const g = { key: 'financing', min: 1, max: 1 }
  const fields = [
    field({ id: 'sig', type: 'signature', required: true, y: 0.9 }),
    field({ id: 'name', type: 'full_name', required: true, y: 0.92 }),
    field({ id: 'cash', type: 'checkbox', group: g, y: 0.3 }),
    field({ id: 'loan', type: 'checkbox', group: g, y: 0.32 }),
    field({ id: 'poss', type: 'date', required: true, label: 'Possession date', y: 0.5 }),
    field({ id: 'note', type: 'text', required: false, y: 0.6 }),
    field({ id: 'locked', recipientId: null, type: 'text', value: { kind: 'text', text: '$519,000' }, y: 0.2 }),
    field({ id: 'seller-sig', recipientId: SELLER, type: 'signature', required: true, y: 0.95 }),
  ]

  it('lists only the signer’s own work, top to bottom, one line per checkbox group, no automatic stamps', () => {
    const items = signerChecklist(fields, BUYER, new Map())
    expect(items.map((i) => i.id)).toEqual(['group:financing', 'poss', 'note', 'sig'])
    expect(items[0]).toMatchObject({ required: true, done: false, prompt: 'Select exactly 1 box', fieldIds: ['cash', 'loan'] })
    expect(items[1].prompt).toBe('Possession date')
  })

  it('walks the required items first, and wraps', () => {
    const items = signerChecklist(fields, BUYER, new Map<string, SignFieldValue>([['cash', { kind: 'checkbox', checked: true }]]))
    expect(nextChecklistItem(items, null)?.id).toBe('poss')
    expect(nextChecklistItem(items, 'poss')?.id).toBe('sig')
    expect(nextChecklistItem(items, 'sig')?.id).toBe('poss')
  })
})

describe('accepting a submission', () => {
  const g = { key: 'financing', min: 1, max: 1 }
  const fields = [
    field({ id: 'sig', type: 'signature', required: true }),
    field({ id: 'date', type: 'date_signed', required: true }),
    field({ id: 'name', type: 'full_name', required: true }),
    field({ id: 'cash', type: 'checkbox', group: g }),
    field({ id: 'loan', type: 'checkbox', group: g }),
    field({ id: 'poss', type: 'date', required: true }),
    field({ id: 'price', recipientId: null, type: 'text', value: { kind: 'text', text: '$519,000' } }),
    field({ id: 'terms', type: 'text', value: { kind: 'text', text: 'Seller pays HOA transfer' } }),
    field({ id: 'seller-sig', recipientId: SELLER, type: 'signature', required: true }),
  ]
  const now = new Date('2026-09-24T21:00:00Z')
  const ok = new Map<string, unknown>([
    ['sig', { kind: 'signature', png: PNG }],
    ['cash', { kind: 'checkbox', checked: true }],
    ['poss', { kind: 'date', iso: '2026-11-30' }],
  ])

  it('keeps the signer’s own values, stamps date and name on the server, and leaves the broker’s and other signers’ fields alone', () => {
    const r = checkSubmission(fields, { id: BUYER, name: 'Vault Test Buyer' }, new Map([...ok, ['price', { kind: 'text', text: '$1' }], ['seller-sig', { kind: 'signature', png: PNG }], ['date', { kind: 'date_signed', text: '01/01/1999' }]]), now)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.values.get('date')).toEqual({ kind: 'date_signed', text: '09/24/2026' })
    expect(r.values.get('name')).toEqual({ kind: 'text', text: 'Vault Test Buyer' })
    expect(r.values.get('poss')).toEqual({ kind: 'date', iso: '2026-11-30', text: '11/30/2026' })
    expect(r.values.get('terms')).toEqual({ kind: 'text', text: 'Seller pays HOA transfer' })
    expect(r.values.has('price')).toBe(false)
    expect(r.values.has('seller-sig')).toBe(false)
  })

  it('refuses a missing required field, a broken rule and a value of the wrong shape', () => {
    const noDate = new Map(ok)
    noDate.delete('poss')
    expect(checkSubmission(fields, { id: BUYER, name: 'B' }, noDate, now)).toMatchObject({ ok: false, fieldId: 'poss' })
    const both = new Map([...ok, ['loan', { kind: 'checkbox', checked: true }]])
    expect(checkSubmission(fields, { id: BUYER, name: 'B' }, both, now)).toMatchObject({ ok: false, error: 'Select exactly 1 box.' })
    const badDate = new Map([...ok, ['poss', { kind: 'date', iso: '2026-13-01' }]])
    expect(checkSubmission(fields, { id: BUYER, name: 'B' }, badDate, now)).toMatchObject({ ok: false, fieldId: 'poss' })
    const badSig = new Map([...ok, ['sig', { kind: 'signature', png: 'javascript:alert(1)' }]])
    expect(checkSubmission(fields, { id: BUYER, name: 'B' }, badSig, now)).toMatchObject({ ok: false, fieldId: 'sig' })
  })

  it('counts a ticked box, a picked date and a signature as filled, and an empty one as not', () => {
    expect(valueIsFilled('checkbox', { kind: 'checkbox', checked: false })).toBe(false)
    expect(valueIsFilled('date', dateValue('2026-11-30'))).toBe(true)
    expect(valueIsFilled('signature', { kind: 'signature', png: PNG })).toBe(true)
    expect(valueIsFilled('text', { kind: 'text', text: '  ' })).toBe(false)
  })
})

describe('preparedField (what the composer saves)', () => {
  it('never keeps a value on a signature, initials or stamp', () => {
    expect(preparedField({ type: 'signature', recipientId: 'r', value: { kind: 'signature', png: 'data:image/png;base64,AA' } }).value).toBeNull()
    expect(preparedField({ type: 'date_signed', recipientId: null, value: { kind: 'date_signed', text: '01/01/2020' } }).value).toBeNull()
  })
  it('keeps a fillable value only of its own kind, re-checking dates and times', () => {
    expect(preparedField({ type: 'date', recipientId: null, value: { kind: 'date', iso: '2026-11-30', text: 'whatever' } }).value).toEqual({ kind: 'date', iso: '2026-11-30', text: '11/30/2026' })
    expect(preparedField({ type: 'date', recipientId: null, value: { kind: 'date', iso: '2026-02-30', text: '' } }).value).toBeNull()
    expect(preparedField({ type: 'time', recipientId: null, value: { kind: 'time', hhmm: '17:30', text: '' } }).value).toEqual({ kind: 'time', hhmm: '17:30', text: '5:30 PM' })
    expect(preparedField({ type: 'checkbox', recipientId: null, value: { kind: 'text', text: 'x' } }).value).toBeNull()
    expect(preparedField({ type: 'text', recipientId: null, value: { kind: 'text', text: 'Hi', size: 8.5 } }).value).toEqual({ kind: 'text', text: 'Hi', size: 8.5 })
  })
  it('keeps a group only on a checkbox and only with a rule the database accepts', () => {
    expect(preparedField({ type: 'checkbox', recipientId: 'r', group: { key: ' q1 ', min: 1, max: 1 } }).group).toEqual({ key: 'q1', min: 1, max: 1 })
    expect(preparedField({ type: 'text', recipientId: 'r', group: { key: 'q1', min: 1, max: 1 } }).group).toBeNull()
    expect(preparedField({ type: 'checkbox', recipientId: 'r', group: { key: 'q1', min: 2, max: 1 } }).group).toBeNull()
    expect(preparedField({ type: 'checkbox', recipientId: 'r', group: { key: 'q1', min: null, max: 0 } }).group).toBeNull()
    expect(preparedField({ type: 'checkbox', recipientId: 'r', group: { key: '', min: 1, max: null } }).group).toBeNull()
  })
  it('trims the label and drops an empty one', () => {
    expect(preparedField({ type: 'text', recipientId: 'r', label: '  Possession date ' }).label).toBe('Possession date')
    expect(preparedField({ type: 'text', recipientId: 'r', label: '   ' }).label).toBeNull()
  })
})

describe('signatureRowSiblings (a signature line takes its row)', () => {
  const f = (key: string, type: EnvelopeField['type'], y: number, x: number, extra: Partial<EnvelopeField> = {}) => ({ key, documentId: 'd', page: 1, type, x, y, w: type === 'date_signed' ? 0.18 : 0.508, recipientId: null, value: null, ...extra })
  it('takes the date beside the line and turns the empty print line beneath into the Full Name', () => {
    const fields = [f('date', 'date_signed', 0.555, 0.72), f('print', 'text', 0.570, 0.126), f('next', 'text', 0.608, 0.126), f('other-date', 'date_signed', 0.593, 0.72)]
    expect(signatureRowSiblings(fields, { documentId: 'd', page: 1, x: 0.126, y: 0.549 })).toEqual([
      { key: 'date', type: 'date_signed' },
      { key: 'print', type: 'full_name' },
    ])
  })
  it('leaves boxes that already belong to someone, or a print line with text in it', () => {
    const fields = [f('date', 'date_signed', 0.555, 0.72, { recipientId: 'r2' }), f('print', 'text', 0.570, 0.126, { value: { kind: 'text', text: 'Jane' } })]
    expect(signatureRowSiblings(fields, { documentId: 'd', page: 1, x: 0.126, y: 0.549 })).toEqual([])
  })
})

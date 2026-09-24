import { describe, expect, it } from 'vitest'
import { readerView } from './view'
import { READER_VERSION } from './vision-reading'

describe('readerView', () => {
  it('names who signed and who has not, per form', () => {
    const v = readerView({
      execution_state: 'unknown',
      reader: {
        version: READER_VERSION,
        verdict: 'partially_executed',
        label: 'Partially signed',
        forms: [
          {
            form: 'Addendum to Sale Agreement',
            instance: '2',
            verdict: 'partially_executed',
            basis: 'library',
            signers: [
              { party: 'buyer', name: 'Tyler Nicoll', signed: false },
              { party: 'seller', name: 'Mary Bowman', signed: true, signed_as: 'Mary Bowman' },
            ],
          },
        ],
      },
    })
    expect(v).toEqual({
      label: 'Partially signed',
      tone: 'slow',
      stale: false,
      forms: [{ title: 'Addendum to Sale Agreement #2', signed: ['Mary Bowman (seller)'], waiting: ['Tyler Nicoll (buyer)'], note: null }],
    })
  })

  it('returns null for a document the reader has not read', () => {
    expect(readerView({ execution_state: 'unsigned' })).toBeNull()
    expect(readerView(null)).toBeNull()
  })

  it('marks a read by an older reader version as stale and explains library misses', () => {
    const v = readerView({ reader: { version: 'old', verdict: 'fully_executed', label: 'Fully executed', forms: [{ form: 'Agreement to Occupy', basis: 'lines', verdict: 'fully_executed', signers: [] }] } })
    expect(v?.stale).toBe(true)
    expect(v?.forms[0].note).toMatch(/Not in the form library/)
  })

  it('says who signs a registry form and why', () => {
    const v = readerView({
      reader: {
        version: 'x',
        verdict: 'partially_executed',
        label: 'Partially signed',
        forms: [{ form: 'SEPTIC/ONSITE SEWAGE SYSTEM ADDENDUM', basis: 'registry', rule: 'The form prints signature lines for the buyer and seller on 17 copies; each named buyer and seller signs.', verdict: 'partially_executed', signers: [] }],
      },
    })
    expect(v?.forms[0].note).toBe('Who signs: The form prints signature lines for the buyer and seller on 17 copies; each named buyer and seller signs.')
  })
})

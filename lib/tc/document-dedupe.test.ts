import { describe, expect, it } from 'vitest'
import { existingBlankIdForForm, existingDocumentIdByHash } from './document-dedupe'

function stubClient(rows: Array<{ id: string }>, seen: { cycleId?: string; sha?: string } = {}) {
  return {
    from: () => ({
      select: () => ({
        eq: (_c: string, cycleId: string) => {
          seen.cycleId = cycleId
          return {
            eq: (_c2: string, sha: string) => {
              seen.sha = sha
              return { limit: async () => ({ data: rows }) }
            },
          }
        },
      }),
    }),
  }
}

describe('existingDocumentIdByHash', () => {
  it('finds the document already on the cycle with these bytes', async () => {
    const seen: { cycleId?: string; sha?: string } = {}
    const id = await existingDocumentIdByHash(stubClient([{ id: 'doc-1' }], seen), 'cyc-1', 'abc123')
    expect(id).toBe('doc-1')
    expect(seen).toEqual({ cycleId: 'cyc-1', sha: 'abc123' })
  })

  it('returns null when the cycle has never seen these bytes', async () => {
    expect(await existingDocumentIdByHash(stubClient([]), 'cyc-1', 'abc123')).toBeNull()
  })

  it('never folds an unhashed write into an unrelated row', async () => {
    // 10 of Apollo's 40 documents carried sha256 null. Matching on a blank hash
    // would have collapsed unrelated PDFs into one.
    expect(await existingDocumentIdByHash(stubClient([{ id: 'doc-1' }]), 'cyc-1', null)).toBeNull()
    expect(await existingDocumentIdByHash(stubClient([{ id: 'doc-1' }]), 'cyc-1', '  ')).toBeNull()
  })
})

/** A client that records every equality filter and answers with the rows whose fields match them all. */
function filteringClient(rows: Array<Record<string, string>>, seen: Array<[string, string]> = []) {
  const chain = (filters: Array<[string, string]>) => ({
    eq: (col: string, val: string) => {
      seen.push([col, val])
      return chain([...filters, [col, val]])
    },
    limit: async () => ({ data: rows.filter((r) => filters.every(([c, v]) => r[c] === v)) }),
  })
  return { from: () => ({ select: () => chain([]) }) }
}

describe('existingBlankIdForForm', () => {
  // Both 020 versions are one file (OREF ships the full disclosure and the
  // exempt seller's as the same bytes).
  const exemptBlank = {
    id: 'doc-exempt',
    cycle_id: 'cyc-1',
    sha256: '52f8eac1',
    'classification->>form_version_id': 'fv-020-exempt',
  }

  it('reuses the blank this form version already put on the cycle', async () => {
    const seen: Array<[string, string]> = []
    const id = await existingBlankIdForForm(filteringClient([exemptBlank], seen), 'cyc-1', '52f8eac1', 'fv-020-exempt')
    expect(id).toBe('doc-exempt')
    expect(seen).toEqual([
      ['cycle_id', 'cyc-1'],
      ['sha256', '52f8eac1'],
      ['classification->>form_version_id', 'fv-020-exempt'],
    ])
  })

  it('does not hand a different form on the same bytes the other form\'s row', async () => {
    // The live defect: a full 020 packet opened after an exempt one was named
    // "Sellers Property Disclosure Statement (Exempt Seller)".
    expect(await existingBlankIdForForm(filteringClient([exemptBlank]), 'cyc-1', '52f8eac1', 'fv-020-full')).toBeNull()
  })

  it('never matches without a hash or a form version', async () => {
    expect(await existingBlankIdForForm(filteringClient([exemptBlank]), 'cyc-1', null, 'fv-020-exempt')).toBeNull()
    expect(await existingBlankIdForForm(filteringClient([exemptBlank]), 'cyc-1', '52f8eac1', null)).toBeNull()
  })
})

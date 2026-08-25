import { describe, expect, it } from 'vitest'
import { existingDocumentIdByHash } from './document-dedupe'

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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * recordCmaRepliedEvent stamps "this contact replied about this CMA" as a
 * crm_timeline row. It used to read `error` only to return false, and its
 * comment called every failure "a duplicate key". The live
 * crm_timeline_kind_check did not allow 'cma_replied' (10 refusals on
 * 2026-10-11), so the stamp failed as if it were a duplicate and nothing
 * said so. A duplicate stays silent; anything else logs once.
 */
const insert = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: () => ({ insert }) }),
}))

import { CMA_REPLIED_KIND, recordCmaRepliedEvent } from './engagementAlerts'

const params = {
  personId: 7,
  cmaId: 'cma-id-1',
  slug: 'cma-828-florida',
  subjectAddress: '828 Florida, Bend, OR 97703',
  channel: 'email' as const,
  broker: 'rebecca',
}

let errorSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  insert.mockReset()
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => errorSpy.mockRestore())

describe('recordCmaRepliedEvent', () => {
  it('writes the cma_replied kind with a per-document dedupe key and returns true', async () => {
    insert.mockResolvedValue({ error: null })
    expect(await recordCmaRepliedEvent(params)).toBe(true)
    expect(CMA_REPLIED_KIND).toBe('cma_replied')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        person_id: 7,
        kind: 'cma_replied',
        source: 'cma-engagement',
        dedupe_key: 'cma:replied:cma-828-florida:7',
      }),
    )
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('a duplicate key is the expected steady state: false, and no log line', async () => {
    insert.mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value violates unique constraint "crm_timeline_dedupe_uq"' },
    })
    expect(await recordCmaRepliedEvent(params)).toBe(false)
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('a refused kind is not a duplicate: false, and one line naming the table and kind', async () => {
    insert.mockResolvedValue({
      error: {
        code: '23514',
        message: 'new row for relation "crm_timeline" violates check constraint "crm_timeline_kind_check"',
        details: 'Failing row contains (1, 7, cma_replied, Replied about the 828 Florida report)',
      },
    })
    expect(await recordCmaRepliedEvent(params)).toBe(false)
    expect(errorSpy).toHaveBeenCalledTimes(1)
    const line = String(errorSpy.mock.calls[0][0])
    expect(line).toContain('table=crm_timeline')
    expect(line).toContain('column=kind')
    expect(line).toContain('value=cma_replied')
    expect(line).toContain('code=23514')
    // No address, no person, no row.
    expect(line).not.toContain('828 Florida')
    expect(line).not.toContain('Failing row')
  })
})

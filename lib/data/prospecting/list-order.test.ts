/**
 * Locks the prospecting worklist default order: oldest-first (date asc) for
 * first-touch desks on both FSBO and expired. Only an explicit dir=desc flips
 * newest-first; unknown sort keys fall back to date.
 */
import { describe, expect, it } from 'vitest'
import {
  PROSPECT_LIST_DEFAULT_DIR,
  PROSPECT_LIST_DEFAULT_SORT,
  resolveProspectListOrder,
} from './types'

describe('prospect list order defaults', () => {
  it('defaults to oldest-first (date asc)', () => {
    expect(PROSPECT_LIST_DEFAULT_SORT).toBe('date')
    expect(PROSPECT_LIST_DEFAULT_DIR).toBe('asc')
    expect(resolveProspectListOrder()).toEqual({ sort: 'date', dir: 'asc' })
    expect(resolveProspectListOrder(null, null)).toEqual({ sort: 'date', dir: 'asc' })
    expect(resolveProspectListOrder(undefined, undefined)).toEqual({ sort: 'date', dir: 'asc' })
  })

  it('only an explicit dir=desc flips to newest-first', () => {
    expect(resolveProspectListOrder('date', 'desc')).toEqual({ sort: 'date', dir: 'desc' })
    expect(resolveProspectListOrder('date', 'ASC')).toEqual({ sort: 'date', dir: 'asc' })
    expect(resolveProspectListOrder('date', 'nope')).toEqual({ sort: 'date', dir: 'asc' })
  })

  it('honors known sort keys and rejects unknown ones', () => {
    expect(resolveProspectListOrder('price', 'asc')).toEqual({ sort: 'price', dir: 'asc' })
    expect(resolveProspectListOrder('owner', 'desc')).toEqual({ sort: 'owner', dir: 'desc' })
    expect(resolveProspectListOrder('not-a-key', 'desc')).toEqual({ sort: 'date', dir: 'desc' })
  })
})

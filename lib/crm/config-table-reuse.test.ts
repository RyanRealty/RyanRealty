import { describe, it, expect } from 'vitest'
import { makeConfigTable } from './config-table'

/**
 * Factory reuse contract.
 *
 * The newsletter-segment and report-area catalogs both back their CRUD on
 * makeConfigTable rather than re-implementing list/create/rename/reorder/
 * setActive/remove. This test asserts the factory yields the full CRUD surface
 * for any table name (so the two new action modules inherit the same guarded,
 * tested behavior as crm_stages). It does NOT hit a DB — it only verifies the
 * shape of what the factory returns, which is what the action modules wire to.
 */
describe('makeConfigTable reuse for Wave 2 catalogs', () => {
  it('returns the full CRUD surface for crm_newsletter_segments', () => {
    const t = makeConfigTable({
      table: 'crm_newsletter_segments',
      revalidatePaths: ['/admin/crm'],
    })
    expect(typeof t.list).toBe('function')
    expect(typeof t.create).toBe('function')
    expect(typeof t.rename).toBe('function')
    expect(typeof t.reorder).toBe('function')
    expect(typeof t.setActive).toBe('function')
    expect(typeof t.remove).toBe('function')
  })

  it('returns the full CRUD surface for crm_report_areas', () => {
    const t = makeConfigTable({
      table: 'crm_report_areas',
      revalidatePaths: ['/admin/crm'],
    })
    expect(Object.keys(t).sort()).toEqual(
      ['create', 'list', 'remove', 'rename', 'reorder', 'setActive'].sort(),
    )
  })
})

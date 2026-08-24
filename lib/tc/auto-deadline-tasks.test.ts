import { describe, expect, it } from 'vitest'
import { dealCalendarItems } from './deal-calendar'
import { autoDeadlineTasksFromCalendar } from './auto-deadline-tasks'

describe('autoDeadlineTasksFromCalendar', () => {
  it('turns Oregon clocks into checkable tasks, not listing expire/close', () => {
    const items = dealCalendarItems({
      address: '218 SW 4th',
      cycles: [{ id: 'S', contract_acceptance_date: '2026-08-01', escrow_closing_date: '2026-09-15', hasWell: true }],
    })
    const tasks = autoDeadlineTasksFromCalendar(items)
    expect(tasks.map((t) => t.kind)).toEqual([
      'earnest_money_due',
      'executed_copies_due',
      'spds_revocation_ends',
      'principal_review_due',
      'well_contingency',
    ])
    const withWindows = autoDeadlineTasksFromCalendar(
      dealCalendarItems({
        address: '218 SW 4th',
        cycles: [{ id: 'S', contract_acceptance_date: '2026-08-01', inspectionDays: 10, financingDays: 30 }],
      }),
    )
    expect(withWindows.some((t) => t.kind === 'inspection_period_ends')).toBe(true)
    expect(withWindows.some((t) => t.kind === 'financing_contingency_ends')).toBe(true)
    expect(tasks.every((t) => t.cycleId === 'S')).toBe(true)
  })
})

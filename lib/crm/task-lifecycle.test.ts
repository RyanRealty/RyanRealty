import { describe, it, expect } from 'vitest'
import { canActOnTask, addDaysToDue } from './task-lifecycle'

describe('canActOnTask', () => {
  it('lets a superuser act on any task regardless of owner', () => {
    expect(canActOnTask({ role: 'superuser', brokerSlug: 'matt' }, 'rebecca')).toBe(true)
    expect(canActOnTask({ role: 'superuser', brokerSlug: 'matt' }, null)).toBe(true)
  })

  it('lets a broker act only on their own task', () => {
    expect(canActOnTask({ role: 'broker', brokerSlug: 'rebecca' }, 'rebecca')).toBe(true)
    expect(canActOnTask({ role: 'broker', brokerSlug: 'rebecca' }, 'paul')).toBe(false)
  })

  it('refuses a broker on an unassigned task', () => {
    expect(canActOnTask({ role: 'broker', brokerSlug: 'rebecca' }, null)).toBe(false)
    expect(canActOnTask({ role: 'broker', brokerSlug: 'rebecca' }, undefined)).toBe(false)
  })

  it('refuses a broker with no slug', () => {
    expect(canActOnTask({ role: 'broker', brokerSlug: null }, 'rebecca')).toBe(false)
  })

  it('refuses a report_viewer', () => {
    expect(canActOnTask({ role: 'report_viewer', brokerSlug: null }, null)).toBe(false)
  })
})

describe('addDaysToDue', () => {
  const FROM = new Date('2026-06-25T12:00:00.000Z')

  it('pushes an existing due date forward by N days', () => {
    const out = addDaysToDue('2026-06-25T00:00:00.000Z', 3, FROM)
    expect(out).toBe('2026-06-28T00:00:00.000Z')
  })

  it('anchors off now when the task has no due date', () => {
    const out = addDaysToDue(null, 2, FROM)
    expect(out).toBe('2026-06-27T12:00:00.000Z')
  })

  it('clamps days below 1 to a 1-day minimum', () => {
    expect(addDaysToDue('2026-06-25T00:00:00.000Z', 0, FROM)).toBe('2026-06-26T00:00:00.000Z')
    expect(addDaysToDue('2026-06-25T00:00:00.000Z', -5, FROM)).toBe('2026-06-26T00:00:00.000Z')
  })

  it('floors fractional days', () => {
    expect(addDaysToDue('2026-06-25T00:00:00.000Z', 2.9, FROM)).toBe('2026-06-27T00:00:00.000Z')
  })

  it('anchors off now when the stored due date is unparseable', () => {
    const out = addDaysToDue('not-a-date', 1, FROM)
    expect(out).toBe('2026-06-26T12:00:00.000Z')
  })
})

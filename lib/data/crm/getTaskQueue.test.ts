import { describe, it, expect } from 'vitest'
import { taskQueueBounds, classifyTaskView } from './getTaskQueue'

// A fixed reference instant: 2026-06-25 14:00 local.
const NOW = new Date('2026-06-25T14:00:00.000Z')
const B = taskQueueBounds(NOW)

describe('taskQueueBounds', () => {
  it('spans the full calendar day for today', () => {
    expect(B.startOfToday <= NOW.toISOString()).toBe(true)
    expect(B.endOfToday >= NOW.toISOString()).toBe(true)
    expect(B.endOfToday > B.startOfToday).toBe(true)
  })

  it('puts the stale floor 31 days before now', () => {
    const diffDays = (NOW.getTime() - new Date(B.staleFloor).getTime()) / (24 * 3600 * 1000)
    expect(Math.round(diffDays)).toBe(31)
  })

  it('puts the completed floor 30 days before now', () => {
    const diffDays = (NOW.getTime() - new Date(B.completedFloor).getTime()) / (24 * 3600 * 1000)
    expect(Math.round(diffDays)).toBe(30)
  })
})

describe('classifyTaskView', () => {
  const iso = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString()
  const DAY = 24 * 3600 * 1000

  it('classifies a task due later today as today', () => {
    expect(classifyTaskView({ dueAt: B.endOfToday, completedAt: null }, B)).toBe('today')
    expect(classifyTaskView({ dueAt: B.startOfToday, completedAt: null }, B)).toBe('today')
  })

  it('classifies a task due yesterday as overdue', () => {
    expect(classifyTaskView({ dueAt: iso(-1 * DAY), completedAt: null }, B)).toBe('overdue')
  })

  it('drops an overdue task older than the 31-day stale floor', () => {
    expect(classifyTaskView({ dueAt: iso(-40 * DAY), completedAt: null }, B)).toBeNull()
  })

  it('classifies a task due tomorrow as upcoming', () => {
    expect(classifyTaskView({ dueAt: iso(2 * DAY), completedAt: null }, B)).toBe('upcoming')
  })

  it('classifies a dateless open task as upcoming', () => {
    expect(classifyTaskView({ dueAt: null, completedAt: null }, B)).toBe('upcoming')
  })

  it('classifies a recently-completed task as completed', () => {
    expect(classifyTaskView({ dueAt: iso(-5 * DAY), completedAt: iso(-1 * DAY) }, B)).toBe('completed')
  })

  it('drops a completion older than the 30-day window', () => {
    expect(classifyTaskView({ dueAt: null, completedAt: iso(-40 * DAY) }, B)).toBeNull()
  })

  it('a completed task is never overdue even if its due date passed', () => {
    // Due 40 days ago (past the overdue stale floor) but completed yesterday →
    // completed wins, not dropped-as-stale-overdue.
    expect(classifyTaskView({ dueAt: iso(-40 * DAY), completedAt: iso(-1 * DAY) }, B)).toBe('completed')
  })
})

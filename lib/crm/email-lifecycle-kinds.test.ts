import { describe, expect, it } from 'vitest'
import {
  EMAIL_DELIVERED_KIND,
  EMAIL_LIFECYCLE_KINDS,
  isEmailLifecycleKind,
  mergeDeliveredRows,
  postgrestInList,
} from './email-lifecycle-kinds'

describe('isEmailLifecycleKind', () => {
  it('is true for the four lifecycle kinds only', () => {
    for (const kind of EMAIL_LIFECYCLE_KINDS) expect(isEmailLifecycleKind(kind)).toBe(true)
    for (const kind of ['email_out', 'email_in', 'email_open', 'email_click', 'system', '', null, undefined]) {
      expect(isEmailLifecycleKind(kind)).toBe(false)
    }
  })

  it('names delivered as the high-volume kind', () => {
    expect(EMAIL_DELIVERED_KIND).toBe('email_delivered')
    expect(postgrestInList(['a', 'b'])).toBe('(a,b)')
  })
})

describe('mergeDeliveredRows', () => {
  const row = (id: string, ts: string) => ({ id, ts })

  it('merges newest first when the window is not full', () => {
    const out = mergeDeliveredRows([row('call', '2026-10-10T10:00:00Z')], [row('d1', '2026-10-14T14:00:00Z'), row('d0', '2026-09-01T14:00:00Z')], 100)
    expect(out.map((r) => r.id)).toEqual(['d1', 'call', 'd0'])
  })

  it('drops a delivery older than a full window, so no delivery sits past cut history', () => {
    const window = Array.from({ length: 3 }, (_, i) => row(`w${i}`, `2026-10-1${4 - i}T10:00:00Z`))
    const out = mergeDeliveredRows(window, [row('new', '2026-10-14T15:00:00Z'), row('old', '2026-10-01T10:00:00Z')], 3)
    expect(out.map((r) => r.id)).toEqual(['new', 'w0', 'w1', 'w2'])
  })

  it('returns the window untouched when there is nothing to merge', () => {
    const window = [row('a', '2026-10-14T10:00:00Z')]
    expect(mergeDeliveredRows(window, [], 100)).toBe(window)
  })
})

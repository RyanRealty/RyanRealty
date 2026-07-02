import { describe, it, expect } from 'vitest'
import { collectLinkedAutomationIds, buildUsedByMap } from './automation-links'

describe('collectLinkedAutomationIds', () => {
  it('returns empty for non-arrays and empty steps', () => {
    expect(collectLinkedAutomationIds(null)).toEqual([])
    expect(collectLinkedAutomationIds(undefined)).toEqual([])
    expect(collectLinkedAutomationIds({})).toEqual([])
    expect(collectLinkedAutomationIds([])).toEqual([])
  })

  it('collects run_automation values from flat steps', () => {
    const steps = [
      { channel: 'email', templateKey: 'x' },
      { channel: 'run_automation', value: '5' },
      { channel: 'run_automation', value: '9' },
    ]
    expect(collectLinkedAutomationIds(steps)).toEqual([5, 9])
  })

  it('dedupes and ignores junk values', () => {
    const steps = [
      { channel: 'run_automation', value: '5' },
      { channel: 'run_automation', value: '5' },
      { channel: 'run_automation', value: 'abc' },
      { channel: 'run_automation', value: '-3' },
      { channel: 'run_automation', value: '' },
      { channel: 'run_automation' },
    ]
    expect(collectLinkedAutomationIds(steps)).toEqual([5])
  })

  it('walks condition branches recursively', () => {
    const steps = [
      {
        type: 'condition',
        field: 'stage',
        op: 'is',
        value: 'lead',
        truePath: [{ channel: 'run_automation', value: '7' }],
        falsePath: [
          {
            type: 'condition',
            field: 'tag',
            op: 'is',
            value: 't',
            truePath: [{ channel: 'run_automation', value: '8' }],
            falsePath: [],
          },
        ],
      },
    ]
    expect(collectLinkedAutomationIds(steps)).toEqual([7, 8])
  })
})

describe('buildUsedByMap', () => {
  it('inverts outgoing references into incoming "used by" lists', () => {
    const sequences = [
      { id: 1, steps: [{ channel: 'run_automation', value: '3' }] },
      { id: 2, steps: [{ channel: 'run_automation', value: '3' }] },
      { id: 3, steps: [] },
    ]
    const map = buildUsedByMap(sequences)
    expect(map.get(3)).toEqual([1, 2])
    expect(map.has(1)).toBe(false)
  })

  it('ignores self-references', () => {
    const map = buildUsedByMap([{ id: 4, steps: [{ channel: 'run_automation', value: '4' }] }])
    expect(map.size).toBe(0)
  })
})

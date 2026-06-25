import { describe, it, expect } from 'vitest'
import {
  isTriggerType,
  isActionType,
  mapRule,
  matchRules,
  type CrmAutomationRule,
} from './getCrmAutomationRules'

function rule(over: Partial<CrmAutomationRule> = {}): CrmAutomationRule {
  return {
    id: 1,
    name: 'r',
    isActive: true,
    triggerType: 'tag_added',
    triggerValue: 'audience:seller',
    actionType: 'enroll_sequence',
    actionValue: '5',
    position: 0,
    ...over,
  }
}

describe('isTriggerType / isActionType', () => {
  it('accepts the v1 trigger set and rejects others', () => {
    expect(isTriggerType('tag_added')).toBe(true)
    expect(isTriggerType('stage_changed')).toBe(true)
    expect(isTriggerType('source_is')).toBe(true)
    expect(isTriggerType('inactivity')).toBe(true)
    expect(isTriggerType('on_birthday')).toBe(false)
  })
  it('accepts the v1 action set and rejects others', () => {
    expect(isActionType('enroll_sequence')).toBe(true)
    expect(isActionType('add_tag')).toBe(true)
    expect(isActionType('set_stage')).toBe(true)
    expect(isActionType('assign_broker')).toBe(true)
    expect(isActionType('send_carrier_pigeon')).toBe(false)
  })
})

describe('mapRule', () => {
  it('maps a raw DB row to the typed shape', () => {
    const mapped = mapRule({
      id: 7,
      name: 'Seller workflow',
      is_active: true,
      trigger_type: 'tag_added',
      trigger_value: 'audience:seller',
      action_type: 'enroll_sequence',
      action_value: '69',
      position: 2,
    })
    expect(mapped).toEqual({
      id: 7,
      name: 'Seller workflow',
      isActive: true,
      triggerType: 'tag_added',
      triggerValue: 'audience:seller',
      actionType: 'enroll_sequence',
      actionValue: '69',
      position: 2,
    })
  })

  it('falls back to safe defaults on a drifted trigger/action string', () => {
    const mapped = mapRule({
      id: 1,
      name: 'x',
      is_active: false,
      trigger_type: 'WEIRD',
      trigger_value: 'v',
      action_type: 'ALSO_WEIRD',
      action_value: 'a',
      position: 0,
    })
    expect(mapped.triggerType).toBe('tag_added')
    expect(mapped.actionType).toBe('add_tag')
    expect(mapped.isActive).toBe(false)
  })
})

describe('matchRules — the trigger matcher the engine resolves through', () => {
  it('matches active rules of the right type + value, ordered by position', () => {
    const rules = [
      rule({ id: 1, triggerValue: 'audience:seller', position: 2 }),
      rule({ id: 2, triggerValue: 'audience:seller', position: 0 }),
      rule({ id: 3, triggerValue: 'audience:buyer', position: 1 }),
    ]
    const out = matchRules(rules, 'tag_added', 'audience:seller')
    expect(out.map((r) => r.id)).toEqual([2, 1])
  })

  it('first matching rule wins by taking [0]', () => {
    const rules = [
      rule({ id: 10, triggerValue: 'intent:fsbo', position: 5, actionValue: '72' }),
      rule({ id: 11, triggerValue: 'intent:fsbo', position: 1, actionValue: '99' }),
    ]
    expect(matchRules(rules, 'tag_added', 'intent:fsbo')[0].actionValue).toBe('99')
  })

  it('skips inactive rules', () => {
    const rules = [rule({ id: 1, isActive: false })]
    expect(matchRules(rules, 'tag_added', 'audience:seller')).toHaveLength(0)
  })

  it('matches case-insensitively and trims', () => {
    const rules = [rule({ triggerValue: 'Audience:Seller' })]
    expect(matchRules(rules, 'tag_added', '  audience:seller  ')).toHaveLength(1)
  })

  it('does not match across trigger types', () => {
    const rules = [rule({ triggerType: 'stage_changed', triggerValue: 'Pending' })]
    expect(matchRules(rules, 'tag_added', 'Pending')).toHaveLength(0)
    expect(matchRules(rules, 'stage_changed', 'Pending')).toHaveLength(1)
  })

  it('seed shape: the 4 seeded tag→enroll rules resolve to their sequences in const order', () => {
    // Mirrors the migration seed: 4 tag_added → enroll_sequence rows, positions 0-3.
    const seeded: CrmAutomationRule[] = [
      rule({ id: 1, triggerValue: 'intent:expired-listing', actionValue: '71', position: 0 }),
      rule({ id: 2, triggerValue: 'intent:fsbo', actionValue: '72', position: 1 }),
      rule({ id: 3, triggerValue: 'audience:seller', actionValue: '69', position: 2 }),
      rule({ id: 4, triggerValue: 'audience:buyer', actionValue: '70', position: 3 }),
    ]
    expect(matchRules(seeded, 'tag_added', 'intent:expired-listing')[0].actionValue).toBe('71')
    expect(matchRules(seeded, 'tag_added', 'intent:fsbo')[0].actionValue).toBe('72')
    expect(matchRules(seeded, 'tag_added', 'audience:seller')[0].actionValue).toBe('69')
    expect(matchRules(seeded, 'tag_added', 'audience:buyer')[0].actionValue).toBe('70')
    // every seeded rule is a tag_added → enroll_sequence shape
    expect(seeded.every((r) => r.triggerType === 'tag_added' && r.actionType === 'enroll_sequence')).toBe(true)
  })
})

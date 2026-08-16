import { describe, expect, it } from 'vitest'
import {
  JOURNEY_ENTRY_STAGE,
  JOURNEY_NURTURE_STAGE,
  JOURNEY_WRITERS,
  isJourneyAdvanceTrigger,
  nextStageOnTrigger,
} from './journey-advance'

describe('journey-advance (G3 stage truth)', () => {
  it('names every writer with a trigger and a when', () => {
    expect(JOURNEY_WRITERS.length).toBeGreaterThanOrEqual(3)
    for (const w of JOURNEY_WRITERS) {
      expect(w.trigger.trim().length).toBeGreaterThan(0)
      expect(w.when.trim().length).toBeGreaterThan(0)
    }
  })

  it('entry stage is the literal Lead string', () => {
    expect(JOURNEY_ENTRY_STAGE).toBe('Lead')
  })

  it('native-create sets Lead — not Nurture', () => {
    const create = JOURNEY_WRITERS.find((w) => w.trigger === 'native-create')
    expect(create?.sets).toBe(JOURNEY_ENTRY_STAGE)
    expect(create?.sets).not.toBe(JOURNEY_NURTURE_STAGE)
  })

  it('sequence-enroll and first-outbound advance Lead → Nurture', () => {
    expect(nextStageOnTrigger('Lead', 'sequence-enroll')).toBe('Nurture')
    expect(nextStageOnTrigger('Lead', 'first-outbound')).toBe('Nurture')
  })

  it('does not rewind or touch later stages', () => {
    expect(nextStageOnTrigger('Nurture', 'sequence-enroll')).toBeNull()
    expect(nextStageOnTrigger('Engaged', 'first-outbound')).toBeNull()
    expect(nextStageOnTrigger('Active Client', 'sequence-enroll')).toBeNull()
    expect(nextStageOnTrigger(null, 'first-outbound')).toBeNull()
  })

  it('rejects unknown triggers', () => {
    expect(isJourneyAdvanceTrigger('sequence-enroll')).toBe(true)
    expect(isJourneyAdvanceTrigger('backfill')).toBe(false)
  })
})

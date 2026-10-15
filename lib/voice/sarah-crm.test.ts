import { describe, expect, it } from 'vitest'
import { intentTags, parseBudget, planSarahCrmUpdate, SARAH_AUDIT } from './sarah-crm'
import type { Qualification } from './receptionist-log'

function q(partial: Partial<Qualification>): Qualification {
  return {
    summary: 'Caller asked about a listing.',
    name: 'Alex',
    callback_number: '+15415550100',
    intent: 'buying',
    area: 'Bend',
    budget: '650k',
    timing: 'this spring',
    financing: '',
    urgent: false,
    ...partial,
  }
}

describe('sarah CRM plan', () => {
  it('tags buyer and seller from volunteered intent', () => {
    expect(intentTags('buying a home')).toEqual(['segment:buyer'])
    expect(intentTags('selling')).toEqual(['segment:seller'])
    expect(intentTags('both')).toEqual(['segment:buyer', 'segment:seller'])
  })

  it('parses volunteered budgets without inventing', () => {
    expect(parseBudget('650k')).toBe(650000)
    expect(parseBudget('$1,200,000')).toBe(1200000)
    expect(parseBudget('')).toBeUndefined()
    expect(parseBudget('a few')).toBeUndefined()
  })

  it('moves Lead to Seller Prospect when they volunteer selling', () => {
    const plan = planSarahCrmUpdate({
      qualification: q({ intent: 'selling', summary: 'Wants to sell.' }),
      transcript: 'Caller: I want to sell my house',
      currentStage: 'Lead',
      lastStageSource: 'native-create',
      currentName: 'Call lead 5415550100',
    })
    expect(plan.stageTo).toBe('Seller Prospect')
    expect(plan.name).toBe('Alex')
    expect(plan.flagBroker).toBe(false)
    expect(plan.noteBody).toContain('Wants to sell')
  })

  it('does not downgrade a Matt-set stage', () => {
    const plan = planSarahCrmUpdate({
      qualification: q({ intent: 'selling' }),
      transcript: 'Caller: I want to sell',
      currentStage: 'Nurture',
      lastStageSource: 'broker-set-stage',
      currentName: 'Pat',
    })
    expect(plan.stageTo).toBeNull()
    expect(plan.flagBroker).toBe(true)
    expect(plan.flagReason).toContain(SARAH_AUDIT)
    expect(plan.name).toBeUndefined()
  })

  it('does not move Active Client or Pending', () => {
    const plan = planSarahCrmUpdate({
      qualification: q({ intent: 'selling' }),
      transcript: '',
      currentStage: 'Active Client',
      lastStageSource: 'sequence-enroll',
      currentName: 'Pat',
    })
    expect(plan.stageTo).toBeNull()
    expect(plan.flagBroker).toBe(true)
  })
})

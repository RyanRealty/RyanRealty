import { describe, expect, it } from 'vitest'
import { sarahGreeting } from '@/lib/sarah'
import { RECEPTIONIST_GREETING, RECEPTIONIST_PROMPT, RECEPTIONIST_RECORDING_NOTICE } from './receptionist-prompt'

describe('receptionist prompt uses lib/sarah', () => {
  it('uses Counsel voice greeting verbatim', () => {
    expect(RECEPTIONIST_GREETING).toBe(sarahGreeting('voice'))
    expect(RECEPTIONIST_GREETING).toContain("I'm not a person")
    expect(RECEPTIONIST_GREETING).toContain('not a licensed broker')
    expect(RECEPTIONIST_GREETING).toContain('recorded and transcribed')
  })

  it('does not run a qualification interview', () => {
    expect(RECEPTIONIST_PROMPT).toMatch(/YOU MAY NOT/i)
    expect(RECEPTIONIST_PROMPT).toMatch(/Qualify or work a lead/i)
    expect(RECEPTIONIST_PROMPT).not.toMatch(/warmly qualify/i)
    expect(RECEPTIONIST_PROMPT).not.toMatch(/pre-approved, cash, proof of funds/i)
  })

  it('announces recording before the SIP conference', () => {
    expect(RECEPTIONIST_RECORDING_NOTICE).toMatch(/recorded/)
    expect(RECEPTIONIST_RECORDING_NOTICE).toContain("Matt's assistant")
  })
})

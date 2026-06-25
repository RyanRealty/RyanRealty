import { describe, expect, it } from 'vitest'
import { decideContactNextStep } from './next-step'

describe('decideContactNextStep', () => {
  it('recommends a CMA when the contact owns a home', () => {
    const step = decideContactNextStep({ ownsHome: true })
    expect(step.kind).toBe('cma')
    expect(step.label).toBe('Send CMA')
    expect(step.description.length).toBeGreaterThan(0)
  })

  it('recommends the newsletter when the contact does not own a home', () => {
    const step = decideContactNextStep({ ownsHome: false })
    expect(step.kind).toBe('newsletter')
    expect(step.label).toBe('Send newsletter')
    expect(step.description.length).toBeGreaterThan(0)
  })

  it('keeps copy free of banned punctuation (no em-dash or semicolon)', () => {
    for (const ownsHome of [true, false]) {
      const step = decideContactNextStep({ ownsHome })
      for (const field of [step.label, step.description]) {
        expect(field).not.toMatch(/[—–;]/)
      }
    }
  })
})

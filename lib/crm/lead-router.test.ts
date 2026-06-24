import { describe, it, expect } from 'vitest'
import { leadBackendPlan, crmLeadBackend } from './lead-router'

describe('leadBackendPlan', () => {
  it('fub mode writes FUB only', () => {
    expect(leadBackendPlan('fub')).toEqual({ native: false, fub: true })
  })
  it('native mode writes the in-house CRM only (the cutover end-state)', () => {
    expect(leadBackendPlan('native')).toEqual({ native: true, fub: false })
  })
  it('dual mode writes both (the proving window)', () => {
    expect(leadBackendPlan('dual')).toEqual({ native: true, fub: true })
  })
})

describe('crmLeadBackend', () => {
  const orig = process.env.CRM_LEAD_BACKEND
  const set = (v: string | undefined) => {
    if (v === undefined) delete process.env.CRM_LEAD_BACKEND
    else process.env.CRM_LEAD_BACKEND = v
  }
  it('defaults to native when unset (FUB decommissioned 2026-06-24)', () => {
    set(undefined)
    expect(crmLeadBackend()).toBe('native')
  })
  it('reads fub / native (case-insensitive)', () => {
    set('FUB')
    expect(crmLeadBackend()).toBe('fub')
    set('native')
    expect(crmLeadBackend()).toBe('native')
  })
  it('falls back to native on an unknown value', () => {
    set('garbage')
    expect(crmLeadBackend()).toBe('native')
    set(orig)
  })
})

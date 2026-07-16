import { describe, it, expect } from 'vitest'
import {
  hasCapability,
  capabilitiesFor,
  ALL_CAPABILITIES,
  type AdminCapabilityContext,
} from '@/lib/admin/capabilities'
import { buildNav, DESTINATIONS } from '@/lib/admin/nav'
import type { AdminRoleType } from '@/app/actions/admin-roles'

function ctx(role: AdminRoleType, canExport = true): AdminCapabilityContext {
  return {
    email: `${role}@ryan-realty.com`,
    role,
    brokerId: role === 'broker' ? 'b1' : null,
    brokerSlug: role === 'broker' ? 'paul' : null,
    flags: { canExport, pauseLeads: false },
  }
}

describe('capability model', () => {
  it('superuser holds every capability (no dead-ends, ever)', () => {
    const su = ctx('superuser')
    for (const cap of ALL_CAPABILITIES) expect(hasCapability(su, cap)).toBe(true)
  })

  it('broker holds the operating set but not superuser-only caps', () => {
    const b = ctx('broker')
    expect(hasCapability(b, 'people.view')).toBe(true)
    expect(hasCapability(b, 'inbox.send')).toBe(true)
    expect(hasCapability(b, 'send.deliverable')).toBe(true)
    expect(hasCapability(b, 'performance.view')).toBe(true) // scoped own-book (D3)
    // superuser-only
    expect(hasCapability(b, 'performance.financials')).toBe(false)
    expect(hasCapability(b, 'financials.view')).toBe(false)
    expect(hasCapability(b, 'commissions.view')).toBe(false) // brokers see own rows via scope (D4)
    expect(hasCapability(b, 'content.site')).toBe(false) // public-site write (RC5)
    expect(hasCapability(b, 'settings.team')).toBe(false)
    expect(hasCapability(b, 'people.import')).toBe(false)
  })

  it('report_viewer is read-only numbers only', () => {
    const r = ctx('report_viewer')
    expect(hasCapability(r, 'today.view')).toBe(true)
    expect(hasCapability(r, 'performance.view')).toBe(true)
    expect(hasCapability(r, 'settings.account')).toBe(true)
    expect(hasCapability(r, 'people.view')).toBe(false)
    expect(hasCapability(r, 'inbox.view')).toBe(false)
  })

  it('can_export flag gates people.export for a broker', () => {
    expect(hasCapability(ctx('broker', true), 'people.export')).toBe(true)
    expect(hasCapability(ctx('broker', false), 'people.export')).toBe(false)
    // superuser is never blocked by the flag
    expect(hasCapability(ctx('superuser'), 'people.export')).toBe(true)
  })

  it('parked v1 caps are absent from the enum (e-sign, D1)', () => {
    expect(ALL_CAPABILITIES).not.toContain('transactions.signoff')
    expect(ALL_CAPABILITIES).not.toContain('esign.send')
  })
})

describe('nav generator projects the capability map', () => {
  it('superuser sees all 8 destinations with all children', () => {
    const nav = buildNav(ctx('superuser'))
    expect(nav.map((s) => s.key)).toEqual(DESTINATIONS.map((d) => d.key))
    const transactions = nav.find((s) => s.key === 'transactions')!
    expect(transactions.children.map((c) => c.label)).toContain('Financials')
  })

  it('broker gets a subset and NO dead-end children', () => {
    const nav = buildNav(ctx('broker'))
    const keys = nav.map((s) => s.key)
    expect(keys).toContain('people')
    expect(keys).toContain('inbox')
    expect(keys).toContain('transactions')
    // Transactions shows for a broker but Financials (superuser-only) is filtered out.
    const transactions = nav.find((s) => s.key === 'transactions')!
    expect(transactions.children.map((c) => c.label)).not.toContain('Financials')
    expect(transactions.children.map((c) => c.label)).toContain('Deals')
    // Every rendered child is one the broker actually holds (no dead-ends).
    for (const s of nav) for (const c of s.children) expect(hasCapability(ctx('broker'), c.capability)).toBe(true)
  })

  it('report_viewer reaches only real pages (Today, Performance, Settings)', () => {
    const nav = buildNav(ctx('report_viewer'))
    expect(nav.map((s) => s.key).sort()).toEqual(['performance', 'settings', 'today'])
  })

  it('every destination + child capability is a real enum member', () => {
    const set = new Set(capabilitiesFor(ctx('superuser')))
    for (const d of DESTINATIONS) {
      expect(set.has(d.capability)).toBe(true)
      for (const c of d.children ?? []) expect(set.has(c.capability)).toBe(true)
    }
  })
})

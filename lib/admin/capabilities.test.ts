import { describe, it, expect } from 'vitest'
import {
  hasCapability,
  capabilitiesFor,
  ALL_CAPABILITIES,
  type AdminCapabilityContext,
} from '@/lib/admin/capabilities'
import { buildNav, DESTINATIONS, toShellSections, buildMobileTabs, bestShellNavHref } from '@/lib/admin/nav'
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
    expect(hasCapability(b, 'settings.templates')).toBe(true) // daily messaging surface, page allows
    expect(hasCapability(b, 'settings.automations')).toBe(true)
    expect(hasCapability(b, 'settings.profile')).toBe(true) // /admin/brokers allows brokers
    // superuser-only
    // performance.view is su-only until spec 06 lands the scoped own-book page —
    // /admin/analytics is superuser-gated, so granting it would nav-dead-end brokers.
    expect(hasCapability(b, 'performance.view')).toBe(false)
    expect(hasCapability(b, 'content.listings')).toBe(false) // su-only until spec 08's read-only page
    expect(hasCapability(b, 'performance.financials')).toBe(false)
    expect(hasCapability(b, 'financials.view')).toBe(false)
    expect(hasCapability(b, 'commissions.view')).toBe(false) // brokers see own rows via scope (D4)
    expect(hasCapability(b, 'content.site')).toBe(false) // public-site write (RC5)
    expect(hasCapability(b, 'settings.team')).toBe(false)
    expect(hasCapability(b, 'settings.crm')).toBe(false)
    expect(hasCapability(b, 'settings.system')).toBe(false)
    expect(hasCapability(b, 'people.import')).toBe(false)
  })

  it('report_viewer is read-only numbers only', () => {
    const r = ctx('report_viewer')
    expect(hasCapability(r, 'today.view')).toBe(true)
    expect(hasCapability(r, 'settings.account')).toBe(true)
    expect(hasCapability(r, 'performance.view')).toBe(false) // until spec 06 (su-only page today)
    expect(hasCapability(r, 'people.view')).toBe(false)
    expect(hasCapability(r, 'inbox.view')).toBe(false)
    expect(hasCapability(r, 'settings.profile')).toBe(false) // /admin/brokers bounces report_viewer
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
  it('superuser sees every destination with all children', () => {
    const nav = buildNav(ctx('superuser'))
    expect(nav.map((s) => s.key)).toEqual(DESTINATIONS.map((d) => d.key))
    const closings = nav.find((s) => s.key === 'closings')!
    expect(closings.children.map((c) => c.label)).toContain('Financials')
  })

  it('broker gets a subset and NO dead-end children', () => {
    const nav = buildNav(ctx('broker'))
    const keys = nav.map((s) => s.key)
    expect(keys).toContain('people')
    expect(keys).toContain('inbox')
    expect(keys).toContain('closings')
    // Closings shows for a broker but Financials (superuser-only) is filtered out.
    const closings = nav.find((s) => s.key === 'closings')!
    expect(closings.children.map((c) => c.label)).not.toContain('Financials')
    expect(closings.children.map((c) => c.label)).toContain('Board')
    // Every rendered child is one the broker actually holds (no dead-ends).
    for (const s of nav) for (const c of s.children) expect(hasCapability(ctx('broker'), c.capability)).toBe(true)
  })

  it('report_viewer reaches only real pages (Home, Settings)', () => {
    const nav = buildNav(ctx('report_viewer'))
    expect(nav.map((s) => s.key).sort()).toEqual(['home', 'settings'])
    // …and its Settings section carries only My settings (the account page).
    const settings = nav.find((s) => s.key === 'settings')!
    expect(settings.children.map((c) => c.label)).toEqual(['My settings'])
  })

  it('every destination + child capability is a real enum member', () => {
    const set = new Set(capabilitiesFor(ctx('superuser')))
    for (const d of DESTINATIONS) {
      expect(set.has(d.capability)).toBe(true)
      for (const c of d.children ?? []) expect(set.has(c.capability)).toBe(true)
    }
  })
})

describe('shell projection (one nav source for every surface)', () => {
  it('renders the nav budget: 39 superuser items, 24 broker items (P9: Oversight absorbed 4 items and added 1; Valuations became its own 3-item destination while Prospecting went leaf, net +1 both roles)', () => {
    const count = (role: AdminRoleType) =>
      toShellSections(buildNav(ctx(role))).reduce((n, s) => n + s.items.length, 0)
    expect(count('superuser')).toBe(39)
    expect(count('broker')).toBe(24)
  })

  it('leaf destinations render as single items; hubs as their children', () => {
    const sections = toShellSections(buildNav(ctx('superuser')))
    const home = sections.find((s) => s.label === 'Today')!
    expect(home.items).toEqual([{ label: 'Today', href: '/admin/today', icon: 'dashboard' as const }])
    const people = sections.find((s) => s.label === 'People')!
    expect(people.items.map((i) => i.label)).toContain('Pipeline')
    expect(people.items.map((i) => i.label)).not.toContain('People')
  })

  it('mobile tabs are the locked IA five (Today · Messages · Prospecting · People · Oversight) for superuser AND broker', () => {
    for (const role of ['superuser', 'broker'] as const) {
      const tabs = buildMobileTabs(buildNav(ctx(role)))
      expect(tabs.map((t) => t.label)).toEqual(['Today', 'Messages', 'Prospecting', 'People', 'Oversight'])
      expect(tabs.map((t) => t.href)).toEqual([
        '/admin/today',
        '/admin/messages',
        '/admin/prospecting',
        '/admin/people',
        '/admin/oversight',
      ])
      expect(tabs.find((t) => t.label === 'Messages')?.badge).toBe('inbox')
    }
  })

  it('a role missing a tab surface loses the tab, never gets a dead one', () => {
    const tabs = buildMobileTabs(buildNav(ctx('report_viewer')))
    expect(tabs.map((t) => t.label)).toEqual(['Today'])
  })

  it('exactly ONE top-bar section lights per route (longest-match, no double-highlight)', () => {
    // Regression (adversarial review 2026-07-17): People carries the bare
    // /admin/crm, so a per-section prefix test lit People ALONGSIDE Inbox on
    // /admin/crm/inbox and alongside Settings on /admin/crm/settings/*.
    const sections = toShellSections(buildNav(ctx('superuser')))
    const activeSections = (pathname: string) => {
      const best = bestShellNavHref(pathname, sections)
      return sections
        .filter((s) => best !== '' && s.items.some((i) => i.href.split('?')[0] === best))
        .map((s) => s.label)
    }
    expect(activeSections('/admin/messages')).toEqual(['Messages'])
    expect(activeSections('/admin/crm/settings/templates')).toEqual(['Settings'])
    expect(activeSections('/admin/crm/sequences')).toEqual(['Settings'])
    expect(activeSections('/admin/crm/57297')).toEqual(['People']) // lead detail → People
    expect(activeSections('/admin/crm/deals')).toEqual(['People']) // pipeline, NOT Transactions
    expect(activeSections('/admin/today')).toEqual(['Today'])
    expect(activeSections('/admin/help')).toEqual([]) // non-nav route lights nothing
  })
})

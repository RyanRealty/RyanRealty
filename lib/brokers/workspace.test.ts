import { describe, expect, it } from 'vitest'
import { isSharedMailbox, planWorkspaceSync, slugFor, type BrokerRow, type RoleRow, type WorkspaceUser } from './workspace'

const user = (email: string, fullName: string, p: Partial<WorkspaceUser> = {}): WorkspaceUser => {
  const [givenName, ...rest] = fullName.split(' ')
  return { id: `g-${email}`, email, givenName, familyName: rest.join(' ') || null, fullName, suspended: false, archived: false, mailbox: true, ...p }
}

// The Directory as it stood on 2026-09-24.
const DIRECTORY = [
  user('admin@ryan-realty.com', 'Admin Account'),
  user('marketing@ryan-realty.com', 'Marketing Ryan'),
  user('matt@ryan-realty.com', 'Matthew Ryan'),
  user('paul@ryan-realty.com', 'Paul Stevenson'),
  user('rebeccapeterson@ryan-realty.com', 'Rebecca Peterson'),
]
const BROKERS: BrokerRow[] = [
  { id: 'b-matt', slug: 'matt', email: 'matt@ryan-realty.com', displayName: 'Matt Ryan' },
  { id: 'b-paul', slug: 'paul', email: 'paul@ryan-realty.com', displayName: 'Paul Stevenson' },
  { id: 'b-rebecca', slug: 'rebecca', email: 'rebeccapeterson@ryan-realty.com', displayName: 'Rebecca Peterson' },
]
const ROLES: RoleRow[] = [
  { email: 'matt@ryan-realty.com', role: 'superuser', brokerId: 'b-matt' },
  { email: 'paul@ryan-realty.com', role: 'broker', brokerId: 'b-paul' },
  { email: 'rebeccapeterson@ryan-realty.com', role: 'broker', brokerId: 'b-rebecca' },
]
const plan = (users: WorkspaceUser[], p: Partial<Parameters<typeof planWorkspaceSync>[0]> = {}) =>
  planWorkspaceSync({ users, complete: true, brokers: BROKERS, roles: ROLES, removedOnPurpose: new Set(), ...p })

describe('planWorkspaceSync', () => {
  it('changes nothing for the Directory as it is today', () => {
    const p = plan(DIRECTORY)
    expect(p.add).toEqual([])
    expect(p.grant).toEqual([])
    expect(p.remove).toEqual([])
    expect(p.skipped.map((s) => s.email)).toEqual(['admin@ryan-realty.com', 'marketing@ryan-realty.com'])
  })

  it('adds a new person as a broker with a login', () => {
    const p = plan([...DIRECTORY, user('jane.doe@ryan-realty.com', 'Jane Doe')])
    expect(p.add).toEqual([expect.objectContaining({ slug: 'jane', displayName: 'Jane Doe' })])
  })

  it('never adds a shared inbox, and never re-adds someone removed on the team page', () => {
    const p = plan([...DIRECTORY, user('info@ryan-realty.com', 'Info Desk'), user('sam@ryan-realty.com', 'Sam Lee')], {
      removedOnPurpose: new Set(['sam@ryan-realty.com']),
    })
    expect(p.add).toEqual([])
    expect(p.skipped.map((s) => s.reason)).toContain('removed on the team page')
  })

  it('removes the login of someone suspended, archived or gone from Google, but never a superuser', () => {
    const p = plan([
      ...DIRECTORY.filter((u) => !u.email.startsWith('paul') && !u.email.startsWith('matt')),
      user('paul@ryan-realty.com', 'Paul Stevenson', { suspended: true }),
    ])
    expect(p.remove).toEqual([{ email: 'paul@ryan-realty.com', brokerId: 'b-paul', reason: 'suspended in Google' }])
    // Matt is missing from this listing but is the superuser: untouched.
    expect(p.remove.map((r) => r.email)).not.toContain('matt@ryan-realty.com')
  })

  it('removes nobody for being absent when the listing was not complete', () => {
    const p = plan(DIRECTORY.slice(0, 3), { complete: false })
    expect(p.remove).toEqual([])
  })

  it('gives a login to a broker row that has none', () => {
    const p = plan(DIRECTORY, { roles: ROLES.filter((r) => !r.email.startsWith('rebecca')) })
    expect(p.grant.map((g) => g.broker.slug)).toEqual(['rebecca'])
  })
})

describe('slugFor and isSharedMailbox', () => {
  it('picks a free slug', () => {
    expect(slugFor({ givenName: 'Jane', familyName: 'Doe', email: 'jd@ryan-realty.com' }, new Set())).toBe('jane')
    expect(slugFor({ givenName: 'Matt', familyName: 'Smith', email: 'ms@ryan-realty.com' }, new Set(['matt']))).toBe('matts')
    expect(slugFor({ givenName: 'Matt', familyName: 'Smith', email: 'ms@ryan-realty.com' }, new Set(['matt', 'matts']))).toBe('mattsmith')
    expect(slugFor({ givenName: 'Matt', familyName: null, email: 'm@ryan-realty.com' }, new Set(['matt']))).toBe('matt2')
    expect(slugFor({ givenName: 'José', familyName: "O'Neil", email: 'j@ryan-realty.com' }, new Set())).toBe('jose')
  })

  it('knows a role address from a person', () => {
    expect(isSharedMailbox({ email: 'admin@ryan-realty.com', fullName: 'Admin Account' })).toBe(true)
    expect(isSharedMailbox({ email: 'marketing@ryan-realty.com', fullName: 'Marketing Ryan' })).toBe(true)
    expect(isSharedMailbox({ email: 'rebeccapeterson@ryan-realty.com', fullName: 'Rebecca Peterson' })).toBe(false)
  })
})

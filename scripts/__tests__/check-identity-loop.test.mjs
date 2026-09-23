import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import {
  findDirectAttributeCalls,
  findHandStampedIdentity,
  findRawEmailInUrl,
  missingWiring,
} from '../check-identity-loop.mjs'

describe('check-identity-loop — rule 1: one decoration helper', () => {
  it('fires on a direct attributeSiteLinks call, including one split across lines', () => {
    expect(findDirectAttributeCalls("const x = attributeSiteLinks(body, 'matt', null, id)")).toHaveLength(1)
    expect(findDirectAttributeCalls('const x = merge.attributeSiteLinks(\n  body,\n  slug,\n  null,\n  id,\n)')).toHaveLength(1)
  })
  it('ignores a mention in a comment and honours a reasoned pragma', () => {
    expect(findDirectAttributeCalls('// attributeSiteLinks(body) is the primitive')).toHaveLength(0)
    expect(findDirectAttributeCalls('// identity-loop-ok: fixture\nattributeSiteLinks(a, b, c, d)')).toHaveLength(0)
    expect(findDirectAttributeCalls('// identity-loop-ok:\nattributeSiteLinks(a, b, c, d)')).toHaveLength(1)
  })
})

describe('check-identity-loop — rule 2: nobody stamps _pid by hand', () => {
  it('fires on searchParams.set, template and concatenation shapes', () => {
    expect(findHandStampedIdentity("u.searchParams.set('_pid', String(id))")).toHaveLength(1)
    expect(findHandStampedIdentity('const url = `${doc}?_pid=${lead.personId}&utm_source=crm`')).toHaveLength(1)
    expect(findHandStampedIdentity("var q = '_pid=' + encodeURIComponent(pid)")).toHaveLength(1)
    expect(findHandStampedIdentity("u.searchParams.set('_fuid', '9')")).toHaveLength(1)
  })
  it('allows reading, deleting, comments and prose', () => {
    expect(findHandStampedIdentity("const t = u.searchParams.get('_pid')")).toHaveLength(0)
    expect(findHandStampedIdentity("u.searchParams.delete('_pid')")).toHaveLength(0)
    expect(findHandStampedIdentity('// the link carries ?_pid=${token}')).toHaveLength(0)
    expect(findHandStampedIdentity(' * stamps `_pid=<token>` on every link')).toHaveLength(0)
  })
})

describe('check-identity-loop — rule 3: no email in a URL', () => {
  it('fires on URL builders', () => {
    expect(findRawEmailInUrl("url.searchParams.set('email', email)")).toHaveLength(1)
    expect(findRawEmailInUrl('const href = `/unsubscribe?email=${email}`')).toHaveLength(1)
  })
  it('does not fire on a form body', () => {
    expect(findRawEmailInUrl("formData.set('email', email.trim())")).toHaveLength(0)
  })
})

describe('check-identity-loop — rules 4-7: wiring on the real tree', () => {
  const read = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : null)
  it('is fully wired today', () => {
    expect(missingWiring(read)).toEqual([])
  })
  it('fires when the track route stops resolving the token', () => {
    const broken = (f) =>
      f === 'app/api/visitors/track/route.ts' ? (read(f) ?? '').replaceAll('verifyPersonLinkToken(', 'nope(') : read(f)
    expect(missingWiring(broken).map((m) => m.why)).toContain('track route no longer verifies the signed ?_pid= token')
  })
  it('fires when the activity view loses its query', () => {
    const broken = (f) =>
      f === 'app/admin/(protected)/visitors/live/KnownPeople.tsx' ? '' : read(f)
    expect(missingWiring(broken).map((m) => m.why)).toContain('Known people no longer reads getActiveKnownPeople')
  })
  it('fires when Known people stops screening scripted form submits', () => {
    const broken = (f) =>
      f === 'lib/data/crm/getSiteActivity.ts' ? (read(f) ?? '').replaceAll('isSuspectContact(', 'keepEveryone(') : read(f)
    expect(missingWiring(broken).map((m) => m.why)).toContain(
      'Known people no longer screens out scripted form submits (quality:suspect)',
    )
  })
  it('fires when a file the contract names disappears', () => {
    const broken = (f) => (f === 'lib/data/crm/getSiteActivity.ts' ? null : read(f))
    expect(missingWiring(broken).some((m) => m.file === 'lib/data/crm/getSiteActivity.ts')).toBe(true)
  })
})

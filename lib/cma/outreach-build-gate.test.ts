import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decideOutreachBuild, outreachOrigin, outreachStreet, ownerPhonesFromPayload } from './outreach-build-gate'

const clean = {
  unreadable: false,
  onMarket: false,
  hardStop: false,
  flags: [] as string[],
  email: 'owner@example.com',
  emailSuppressed: false,
  phones: [] as Array<{ value?: string | null; type?: string | null; dnc?: boolean | null }>,
}

describe('decideOutreachBuild', () => {
  it('builds when the home is off the market and the email can be sent', () => {
    expect(decideOutreachBuild(clean)).toEqual({ ok: true })
  })

  it('refuses when live status cannot be read', () => {
    expect(decideOutreachBuild({ ...clean, unreadable: true }).ok).toBe(false)
  })

  it('refuses a home that is on the market before it looks at the email', () => {
    const decision = decideOutreachBuild({ ...clean, onMarket: true })
    expect(decision).toEqual({ ok: false, reason: 'This home is on the market. The CMA was not built.' })
  })

  it('refuses a litigator and a deceased owner', () => {
    expect(decideOutreachBuild({ ...clean, flags: ['litigator'] }).ok).toBe(false)
    expect(decideOutreachBuild({ ...clean, flags: ['deceased'] }).ok).toBe(false)
  })

  it('refuses a suppressed email when there is no typed cell', () => {
    const decision = decideOutreachBuild({
      ...clean,
      emailSuppressed: true,
      phones: [{ value: '5415550100', type: null }],
    })
    expect(decision).toEqual({ ok: false, reason: 'The owner email is suppressed. The CMA was not built.' })
  })

  it('refuses when there is no email and the phone has no line type', () => {
    const decision = decideOutreachBuild({
      ...clean,
      email: null,
      phones: [{ value: '5415550100', type: null }],
    })
    expect(decision).toEqual({
      ok: false,
      reason: 'There is no sendable owner email or cell. The CMA was not built.',
    })
  })

  it('builds on a mobile cell when there is no email', () => {
    expect(
      decideOutreachBuild({
        ...clean,
        email: null,
        phones: [{ value: '5415550100', type: 'mobile' }],
      }),
    ).toEqual({ ok: true })
  })

  it('refuses a STOP or other SMS-suppressed cell when there is no email', () => {
    expect(
      decideOutreachBuild({
        ...clean,
        email: null,
        smsSuppressed: true,
        phones: [{ value: '5415550100', type: 'mobile' }],
      }),
    ).toEqual({ ok: false, reason: 'The cell cannot be texted. The CMA was not built.' })
  })

  it('treats a stored compliance hard stop as an email block', () => {
    expect(decideOutreachBuild({ ...clean, hardStop: true }).ok).toBe(false)
  })
})

describe('outreach origin', () => {
  it('uses the stored expired or FSBO source, not a cli rebuild label', () => {
    expect(outreachOrigin('cli-rebuild', 'cma')).toBeNull()
    expect(outreachOrigin('expired-listing-cron', 'cma')).toBe('expired')
    expect(outreachOrigin('expired-backfill', 'cma')).toBe('expired')
    expect(outreachOrigin('fsbo-cron', 'cma')).toBe('fsbo')
    expect(outreachOrigin('seller-lp', 'cma')).toBeNull()
  })

  it('keeps the street number and name and drops the city', () => {
    expect(outreachStreet('2745 Aldrich, Bend, OR 97701')).toBe('2745 Aldrich')
    expect(outreachStreet('2745 Aldrich')).toBe('2745 Aldrich')
  })

  it('reads typed phones off the queued payload', () => {
    expect(
      ownerPhonesFromPayload([{ value: '5415550100', type: 'wireless', dnc: false }]),
    ).toEqual([{ number: null, value: '5415550100', type: 'wireless', dnc: false }])
    expect(ownerPhonesFromPayload(null)).toBeNull()
  })
})

describe('buildCma calls the gate first', () => {
  it('runs the outreach gate before the snapshot', () => {
    const src = readFileSync(join(process.cwd(), 'lib/cma/build.ts'), 'utf8')
    const body = src.slice(src.indexOf('export async function buildCma'))
    const gate = body.indexOf('await gateOutreachBuild(')
    const snap = body.indexOf('snapshotCmaVersion(')
    expect(gate).toBeGreaterThan(-1)
    expect(snap).toBeGreaterThan(gate)
  })

  it('checks SMS suppression on the cell before a mobile-only build', () => {
    const src = readFileSync(join(process.cwd(), 'lib/cma/outreach-build-gate.ts'), 'utf8')
    expect(src).toContain('isSuppressedByPhone')
    expect(src).toContain('smsSuppressed')
    const body = src.slice(src.indexOf('export async function gateOutreachBuild'))
    expect(body.indexOf('isSuppressedByPhone')).toBeGreaterThan(-1)
    expect(body.indexOf('isSuppressedByPhone')).toBeLessThan(body.indexOf('decideOutreachBuild'))
  })
})

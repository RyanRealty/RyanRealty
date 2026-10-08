/**
 * Expired/FSBO intake (Matt 2026-10-05).
 * Live status, then compliance, then a sendable email, then a cell.
 * A proceed decision is what lets the processor build a CMA.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { expiredOutreachListingHits } from '@/lib/data/prospecting/compliance'
import { complianceFromSkipTrace } from '@/lib/owner-resolution.mjs'
import {
  decideProspectIntake,
  emailBlockedByFlags,
  intakeBuildsCma,
  phoneBlockedByFlags,
  pickSendableCell,
  type ProspectIntakeInput,
} from './intake-gate'

const EXPIRE = '2026-06-01T00:00:00Z'
const AFTER = '2026-07-15T00:00:00Z'
const PARCEL = '171219DB02100'

function clean(over: Partial<ProspectIntakeInput> = {}): ProspectIntakeInput {
  return {
    onMarket: false,
    litigator: false,
    deceased: false,
    dncTcpa: false,
    dncPhone: false,
    email: 'owner@example.com',
    emailSuppressed: false,
    phones: [],
    ...over,
  }
}

describe('complianceFromSkipTrace', () => {
  it('tags a litigator as an email hard stop', () => {
    const mapped = complianceFromSkipTrace({ litigator: true })
    expect(mapped.emailHardStop).toBe(true)
    expect(mapped.flags).toEqual(['litigator'])
    expect(mapped.tags).toContain('compliance:hard-stop')
    expect(mapped.tags).toContain('tcpa:litigator')
  })

  it('tags deceased as an email hard stop', () => {
    const mapped = complianceFromSkipTrace({ deceased: true })
    expect(mapped.emailHardStop).toBe(true)
    expect(mapped.flags).toEqual(['deceased'])
    expect(mapped.tags).toContain('compliance:hard-stop')
    expect(mapped.tags).toContain('compliance:deceased')
  })

  it('does not treat TCPA-only as a litigator or an email hard stop', () => {
    const mapped = complianceFromSkipTrace({ dncTcpa: true })
    expect(mapped.emailHardStop).toBe(false)
    expect(mapped.flags).toEqual(['dnc:tcpa'])
    expect(mapped.tags).not.toContain('compliance:hard-stop')
    expect(mapped.tags).not.toContain('tcpa:litigator')
    expect(mapped.tags).toEqual(['contact:do-not-call', 'contact:do-not-text'])
  })

  it('keeps a DNC phone on calls and texts', () => {
    const mapped = complianceFromSkipTrace({ dncPhone: true })
    expect(mapped.emailHardStop).toBe(false)
    expect(mapped.flags).toEqual(['dnc'])
    expect(mapped.tags).toEqual(['contact:do-not-call', 'contact:do-not-text'])
    expect(mapped.tags).not.toContain('compliance:hard-stop')
  })
})

describe('decideProspectIntake', () => {
  it('skips a litigator before a person or a CMA', () => {
    const decision = decideProspectIntake(clean({ litigator: true }))
    expect(decision.action).toBe('skip')
    if (decision.action === 'skip') expect(decision.reason).toBe('litigator')
    expect(decision.emailHardStop).toBe(true)
    expect(intakeBuildsCma(decision)).toBe(false)
  })

  it('skips a deceased owner', () => {
    const decision = decideProspectIntake(clean({ deceased: true }))
    expect(decision).toMatchObject({ action: 'skip', reason: 'deceased', emailHardStop: true })
    expect(intakeBuildsCma(decision)).toBe(false)
  })

  it('lets a TCPA-only owner with a valid email through', () => {
    const decision = decideProspectIntake(clean({ dncTcpa: true }))
    expect(intakeBuildsCma(decision)).toBe(true)
    expect(decision).toMatchObject({
      action: 'proceed',
      channel: 'email',
      email: 'owner@example.com',
      emailHardStop: false,
      flags: ['dnc:tcpa'],
    })
    expect(decision.tags).not.toContain('compliance:hard-stop')
  })

  it('lets a DNC phone with a valid email through', () => {
    const decision = decideProspectIntake(clean({ dncPhone: true }))
    expect(intakeBuildsCma(decision)).toBe(true)
    expect(decision.emailHardStop).toBe(false)
    expect(decision.flags).toEqual(['dnc'])
    expect(emailBlockedByFlags(decision.flags, false)).toBeNull()
    expect(phoneBlockedByFlags(decision.flags)).toMatch(/dnc/)
  })

  it('skips a landline when there is no email', () => {
    const decision = decideProspectIntake(clean({
      email: null,
      phones: [{ value: '5415550100', type: 'Landline', dnc: false }],
    }))
    expect(decision).toMatchObject({ action: 'skip', reason: 'no-sendable-email' })
    expect(intakeBuildsCma(decision)).toBe(false)
  })

  it('skips an untyped phone when there is no email', () => {
    const decision = decideProspectIntake(clean({
      email: null,
      phones: [{ value: '5415550101', type: null, dnc: false }],
    }))
    expect(decision).toMatchObject({ action: 'skip', reason: 'no-sendable-email' })
  })

  it('builds for a non-DNC cell when there is no email', () => {
    const decision = decideProspectIntake(clean({
      email: null,
      phones: [
        { value: '5415550199', type: 'Landline', dnc: true },
        { value: '15415550102', type: 'Mobile', dnc: false },
      ],
    }))
    expect(intakeBuildsCma(decision)).toBe(true)
    expect(decision).toMatchObject({
      action: 'proceed',
      channel: 'sms',
      email: null,
      phone: '5415550102',
      emailHardStop: false,
      flags: [],
      tags: [],
    })
  })

  it('does not text a DNC cell, and does not tag a clean cell do-not-text', () => {
    const blocked = decideProspectIntake(clean({
      email: null,
      dncPhone: true,
      phones: [{ value: '5415550103', type: 'Wireless', dnc: true }],
    }))
    expect(blocked).toMatchObject({ action: 'skip', reason: 'no-sendable-email' })

    const cleanCell = decideProspectIntake(clean({
      email: null,
      dncPhone: true,
      phones: [{ value: '5415550104', type: 'cell', dnc: false }],
    }))
    expect(cleanCell).toMatchObject({ action: 'proceed', channel: 'sms', phone: '5415550104' })
    expect(cleanCell.tags).not.toContain('contact:do-not-text')
    expect(cleanCell.tags).not.toContain('contact:do-not-call')
  })

  it('does not text a TCPA cell when there is no email', () => {
    const decision = decideProspectIntake(clean({
      email: null,
      dncTcpa: true,
      phones: [{ value: '5415550105', type: 'Mobile', dnc: false }],
    }))
    expect(decision).toMatchObject({ action: 'skip', reason: 'sms-blocked', flags: ['dnc:tcpa'] })
    expect(intakeBuildsCma(decision)).toBe(false)
  })

  it('texts a clean cell when the email is suppressed', () => {
    const decision = decideProspectIntake(clean({
      emailSuppressed: true,
      phones: [{ value: '5415550106', type: 'Mobile', dnc: false }],
    }))
    expect(decision).toMatchObject({
      action: 'proceed',
      channel: 'sms',
      email: null,
      phone: '5415550106',
    })
  })

  it('keeps email when both a cell and a sendable email exist', () => {
    const decision = decideProspectIntake(clean({
      phones: [{ value: '5415550107', type: 'Mobile', dnc: false }],
    }))
    expect(decision).toMatchObject({
      action: 'proceed',
      channel: 'email',
      email: 'owner@example.com',
      phone: null,
    })
  })

  it('skips a suppressed email when there is no cell', () => {
    const decision = decideProspectIntake(clean({ emailSuppressed: true }))
    expect(decision).toMatchObject({ action: 'skip', reason: 'email-suppressed' })
  })

  it('pickSendableCell ignores landline, VOIP, DNC, and a blank type', () => {
    expect(pickSendableCell([
      { value: '5415550110', type: 'Landline' },
      { value: '5415550111', type: 'VOIP' },
      { value: '5415550112', type: 'Mobile', dnc: true },
      { value: '5415550113', type: '' },
      { number: '5415550114', type: 'wireless' },
    ])).toBe('5415550114')
  })

  it('checks live status before compliance', () => {
    const decision = decideProspectIntake(clean({ onMarket: true, litigator: true }))
    expect(decision).toMatchObject({ action: 'skip', reason: 'back-on-market' })
    expect(decision.emailHardStop).toBe(true)
  })

  it('builds for a clean owner with a sendable email', () => {
    const decision = decideProspectIntake(clean())
    expect(intakeBuildsCma(decision)).toBe(true)
    expect(decision).toMatchObject({
      action: 'proceed',
      channel: 'email',
      email: 'owner@example.com',
      phone: null,
      emailHardStop: false,
      flags: [],
      tags: [],
    })
  })
})

describe('back on market feeds the same intake decision', () => {
  function onMarket(listing: Parameters<typeof expiredOutreachListingHits>[0]['listing'], subjectParcel: string | null = null) {
    return expiredOutreachListingHits({
      kind: 'expired',
      listing,
      namePrefix: 'PINE',
      cityUpper: 'BEND',
      expiryComparator: EXPIRE,
      subjectParcel,
    })
  }

  it('skips an Active relist at the same address', () => {
    const hit = onMarket({
      StreetName: 'PINE',
      City: 'Bend',
      StandardStatus: 'Active',
      status_change_timestamp: AFTER,
    })
    expect(hit).toBe(true)
    expect(decideProspectIntake(clean({ onMarket: hit }))).toMatchObject({ action: 'skip', reason: 'back-on-market' })
  })

  it('skips a Pending relist', () => {
    const hit = onMarket({
      StreetName: 'PINE',
      City: 'Bend',
      StandardStatus: 'Pending',
      status_change_timestamp: AFTER,
    })
    expect(decideProspectIntake(clean({ onMarket: hit }))).toMatchObject({ action: 'skip', reason: 'back-on-market' })
  })

  it('skips a Closed sale after expiry', () => {
    const hit = onMarket({
      StreetName: 'PINE',
      City: 'Bend',
      StandardStatus: 'Closed',
      CloseDate: AFTER,
      status_change_timestamp: AFTER,
    })
    expect(hit).toBe(true)
    expect(decideProspectIntake(clean({ onMarket: hit }))).toMatchObject({ action: 'skip', reason: 'back-on-market' })
  })

  it('skips a parcel match when the street spelling differs', () => {
    const hit = onMarket(
      {
        StreetName: 'PINECREST',
        City: 'Redmond',
        StandardStatus: 'Active',
        status_change_timestamp: AFTER,
        parcel_number: PARCEL,
      },
      PARCEL,
    )
    expect(hit).toBe(true)
    expect(intakeBuildsCma(decideProspectIntake(clean({ onMarket: hit })))).toBe(false)
  })
})

describe('intake is wired in front of person and CMA creation', () => {
  const expired = readFileSync(join(process.cwd(), 'lib/expired-listing-processor.ts'), 'utf8')
  const fsbo = readFileSync(join(process.cwd(), 'lib/fsbo-processor.ts'), 'utf8')
  const send = readFileSync(join(process.cwd(), 'lib/cma/send.ts'), 'utf8')
  const request = readFileSync(join(process.cwd(), 'lib/cma-request.ts'), 'utf8')
  const resolution = readFileSync(join(process.cwd(), 'lib/owner-resolution.mjs'), 'utf8')
  const lookup = readFileSync(join(process.cwd(), 'lib/expired-owner-lookup.ts'), 'utf8')
  const batch = readFileSync(join(process.cwd(), 'lib/data/prospecting/batch.ts'), 'utf8')

  function buildsOnlyAfterGate(src: string) {
    const body = src.slice(src.search(/export async function process/))
    const gate = body.indexOf('intakeBuildsCma(decision)')
    const person = body.indexOf('await ensureNativeLead')
    const cma = body.indexOf('createCmaRequest')
    const probe = body.indexOf('probeIntakeBackOnMarket')
    expect(probe).toBeGreaterThan(-1)
    expect(gate).toBeGreaterThan(probe)
    expect(person).toBeGreaterThan(gate)
    expect(cma).toBeGreaterThan(gate)
  }

  it('expired intake probes live status, then builds only on proceed', () => {
    buildsOnlyAfterGate(expired)
  })

  it('FSBO intake probes live status, then builds only on proceed', () => {
    buildsOnlyAfterGate(fsbo)
  })

  it('does not put the intake gate on the shared CMA send or create path', () => {
    expect(send).not.toContain('decideProspectIntake')
    expect(send).not.toContain('intakeBuildsCma')
    expect(request).not.toContain('decideProspectIntake')
    expect(request).not.toContain('intakeBuildsCma')
  })

  it('keeps BatchData hardStop to a true litigator or deceased signal', () => {
    expect(resolution).toMatch(/hardStop:\s*litigator \|\| deceased/)
    expect(resolution).not.toMatch(/hardStop:\s*litigator \|\| dncTcpa/)
  })

  it('tries Tracerfy and Apify when county plus BatchData return no email', () => {
    const fn = lookup.slice(lookup.indexOf('export async function lookupOwnerForExpiredListing'))
    const resolved = fn.slice(fn.indexOf('if (resolved)'), fn.indexOf('} catch'))
    expect(resolved).toContain('enrichOwnerContact')
    expect(resolved.indexOf('!resolved.bestEmail')).toBeLessThan(resolved.indexOf('enrichOwnerContact'))
    expect(resolved.indexOf('enrichOwnerContact')).toBeLessThan(resolved.lastIndexOf('return result'))
    expect(resolved).toContain('fallback?.allPhones')
  })

  it('shares one email-hard-stop flag set with the prospect send path', () => {
    expect(batch).toContain('emailBlockedByFlags')
    expect(batch).toContain('phoneBlockedByFlags')
    expect(batch).not.toContain('const DANGEROUS_FLAGS')
    expect(emailBlockedByFlags(['dnc:tcpa', 'do-not-call'], false)).toBeNull()
    expect(emailBlockedByFlags(['litigator'], false)).toMatch(/litigator/)
    expect(phoneBlockedByFlags(['dnc:tcpa'])).toMatch(/dnc:tcpa/)
  })
})

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function src(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), 'utf8')
}

describe('industry contacts are excluded on every bulk / marketing path', () => {
  it('audience bus drops industry before sendable resolution', () => {
    const text = src('./audience.ts')
    expect(text).toContain('isIndustryContact')
    expect(text).toContain('INDUSTRY_BULK_SKIP_REASON')
  })

  it('sequence engine halts industry contacts before email or SMS', () => {
    const text = src('../../app/api/cron/crm-sequence-engine/route.ts')
    const industryAt = text.indexOf('isIndustryContact({ tags: person.tags, stage: person.stage })')
    const emailGate = text.indexOf("const gate = await isSuppressed(person.id, 'email')")
    const smsGate = text.indexOf("const gate = await isSuppressed(person.id, 'sms')")
    expect(industryAt).toBeGreaterThan(-1)
    expect(industryAt).toBeLessThan(emailGate)
    expect(industryAt).toBeLessThan(smsGate)
  })

  it('auto-enroll and manual enroll refuse industry contacts', () => {
    const text = src('./enroll.ts')
    expect(text).toMatch(/isIndustryContact\(\{ tags, stage:/)
    expect(text).toContain("reason: 'industry-contact'")
  })

  it('email-cohort skips industry after the suppression gate', () => {
    const text = src('./bulk-handlers/email-cohort.ts')
    expect(text).toContain("bucket: 'industry-contact'")
    expect(text).toContain('isIndustryContact')
  })

  it('market-report send skips industry', () => {
    const text = src('./market-report-send.ts')
    expect(text).toContain("reason: 'industry-contact'")
    expect(text).toContain('isIndustryContact')
  })

  it('offline conversions skip industry and ignore cleared suppressions', () => {
    const text = src('../../app/api/cron/offline-conversions/route.ts')
    expect(text).toContain('isIndustryContact')
    expect(text).toContain('.is(\'cleared_at\', null)')
  })

  it('add-newsletter skips industry', () => {
    const text = src('./bulk-handlers/add-newsletter.ts')
    expect(text).toContain('industry_contact')
    expect(text).toContain('isIndustryContact')
  })

  it('Meta audience and westside honor the industry helper', () => {
    expect(src('../data/crm/getAudienceEligiblePeople.ts')).toContain('isIndustryContact')
    expect(src('../meta-westside-audience.ts')).toContain('isIndustryContact')
  })

  it('prospecting marketing sends refuse industry', () => {
    const text = src('../../app/actions/prospecting.ts')
    expect(text).toContain('isIndustryContact')
    expect(text).toContain('industry-contact')
  })
})

describe('1:1 composer stays open for industry contacts', () => {
  it('sendCrmEmailAction uses isSuppressed only — not the industry helper', () => {
    const text = src('../../app/actions/crm.ts')
    const emailFn = text.indexOf('export async function sendCrmEmailAction')
    const smsFn = text.indexOf('export async function sendCrmSmsAction')
    const emailSlice = text.slice(emailFn, smsFn)
    expect(emailSlice).toContain('isSuppressed')
    expect(emailSlice).not.toContain('isIndustryContact')
  })

  it('sendCrmSmsAction may skip a soft consent row on 1:1 compose', () => {
    const text = src('../../app/actions/crm.ts')
    const smsFn = text.indexOf('export async function sendCrmSmsAction')
    const nextExport = text.indexOf('\nexport async function', smsFn + 1)
    const smsSlice = text.slice(smsFn, nextExport === -1 ? undefined : nextExport)
    expect(smsSlice).toContain('skipSuppression: true')
    expect(smsSlice).not.toContain('isIndustryContact')
  })
})

describe('skipSuppression cannot ride a bulk, drip, or marketing path', () => {
  it('sequence, drip, and cohort senders never set the skip flag', () => {
    const sequence = src('../../app/api/cron/crm-sequence-engine/route.ts')
    const drip = src('../data/prospecting/drip-drain.ts')
    const cohort = src('./bulk-handlers/email-cohort.ts')
    expect(sequence).not.toContain('skipSuppression')
    expect(drip).not.toContain('skipSuppression')
    expect(cohort).not.toContain('skipSuppression')
  })

  it('quiet-hours rechecks do not skip all suppressions', () => {
    const sms = src('../comms/sendGovernedSms.ts')
    expect(sms).toContain('quietHoursOnly: true')
    expect(sms).not.toMatch(/skipSuppression:\s*true/)
  })
})

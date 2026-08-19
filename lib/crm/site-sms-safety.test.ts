import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

describe('lead SMS cannot use personal iMessage', () => {
  it('sequence engine has no personal-Messages fallback and does not write broker alerts', () => {
    const engine = read('app/api/cron/crm-sequence-engine/route.ts')
    expect(engine).not.toMatch(/LEAD_SMS_IMESSAGE_FALLBACK/)
    expect(engine).not.toMatch(/crm_broker_alerts/)
    expect(engine).not.toMatch(/osascript/)
  })

  it('governed lead SMS does not import the broker-self or iMessage rails', () => {
    const governed = read('lib/comms/sendGovernedSms.ts')
    expect(governed).not.toMatch(/broker-self-sms|osascript|iMessage|LEAD_SMS_IMESSAGE/)
    expect(governed).toMatch(/sendSmsViaMessagingService|sendSms/)
  })

  it('group compose on the site path refuses silent one-off fan-out', () => {
    const sms = read('app/actions/crm.ts')
    const group = read('lib/crm/try-send-group-mms.ts')
    expect(sms).toMatch(/trySendGroupMms/)
    expect(sms).toMatch(/groupThread/)
    expect(sms).not.toMatch(/LEAD_SMS_IMESSAGE_FALLBACK/)
    expect(group).toMatch(/decideGroupSmsFallback/)
    expect(group).toMatch(/GROUP_THREAD_FAILED/)
    expect(group).toMatch(/sendGovernedGroupMms/)
    expect(group).not.toMatch(/sendGroupMms/)
    expect(group).not.toMatch(/LEAD_SMS_IMESSAGE_FALLBACK/)
  })

  it('broker-self CMA text uses Twilio, never AppleScript', () => {
    const self = read('lib/crm/broker-self-sms.ts')
    expect(self).toMatch(/api\.twilio\.com/)
    expect(self).not.toMatch(/osascript/)
    expect(self).not.toMatch(/LEAD_SMS_IMESSAGE_FALLBACK/)
    expect(self).toMatch(/isBrokerPhone/)
  })
})

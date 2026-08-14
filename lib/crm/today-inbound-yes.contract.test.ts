import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const actionsUrl = new URL('../../app/admin/(protected)/today/actions.ts', import.meta.url)

describe('Today inbound Yes-path contract', () => {
  it('routes Yes through sendCrmSmsAction and does not open a second SMS path', () => {
    const actionSrc = readFileSync(actionsUrl, 'utf8')
    expect(actionSrc).toMatch(/export async function sendTodayInboundReply/)
    expect(actionSrc).toMatch(/checkAdminAction\('today\.view'\)/)
    expect(actionSrc).toMatch(/sendCrmSmsAction/)
    expect(actionSrc).toMatch(/dismissTriageItemAction/)
    expect(actionSrc).not.toMatch(/overrideQuietHours/)
    expect(actionSrc).not.toMatch(/from ['"]@\/lib\/crm\/twilio['"]/)
    expect(actionSrc).not.toMatch(/from ['"]@\/lib\/comms\/sendGovernedSms['"]/)
    expect(actionSrc).not.toMatch(/\bsendSms\b/)
  })
})

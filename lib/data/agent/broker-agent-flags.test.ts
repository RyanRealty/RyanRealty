import { afterEach, describe, expect, it } from 'vitest'
import { isBrokerSmsAgentEnvEnabled, isSmsAgentBrokerSlug } from './broker-agent-flags'

describe('isSmsAgentBrokerSlug', () => {
  it('accepts the three CRM desks and rejects anything else', () => {
    expect(isSmsAgentBrokerSlug('matt')).toBe(true)
    expect(isSmsAgentBrokerSlug('rebecca')).toBe(true)
    expect(isSmsAgentBrokerSlug('paul')).toBe(true)
    expect(isSmsAgentBrokerSlug('not-a-broker')).toBe(false)
    expect(isSmsAgentBrokerSlug('')).toBe(false)
  })
})

describe('isBrokerSmsAgentEnvEnabled', () => {
  const previous = process.env.BROKER_SMS_AGENT_ENABLED

  afterEach(() => {
    if (previous === undefined) delete process.env.BROKER_SMS_AGENT_ENABLED
    else process.env.BROKER_SMS_AGENT_ENABLED = previous
  })

  it('is fail-closed unless the env value is the literal string true', () => {
    process.env.BROKER_SMS_AGENT_ENABLED = 'true'
    expect(isBrokerSmsAgentEnvEnabled()).toBe(true)
    process.env.BROKER_SMS_AGENT_ENABLED = 'TRUE'
    expect(isBrokerSmsAgentEnvEnabled()).toBe(false)
    delete process.env.BROKER_SMS_AGENT_ENABLED
    expect(isBrokerSmsAgentEnvEnabled()).toBe(false)
  })
})

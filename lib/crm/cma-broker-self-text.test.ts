import { describe, expect, it } from 'vitest'
import { brokerPhoneSet, last10 } from '@/lib/crm/alert-drain-core'
import {
  cmaBrokerReviewUrl,
  cmaBrokerSelfTextBody,
  collectCmaClientPhones,
  isNonBrokerClientDestination,
  refuseIfClientDestination,
  resolveBrokerSelfPhone,
} from '@/lib/crm/cma-broker-self-text'

const env = {
  TWILIO_FORWARD_MATT: '+15415551234',
  TWILIO_FORWARD_REBECCA: '541-555-2345',
  TWILIO_FORWARD_PAUL: '(541) 555-3456',
}
const whitelist = brokerPhoneSet(env)
const phonesByBroker = {
  matt: env.TWILIO_FORWARD_MATT,
  rebecca: env.TWILIO_FORWARD_REBECCA,
  paul: env.TWILIO_FORWARD_PAUL,
}

const CLIENT_JANE = '541-703-0001'
const CLIENT_ODESSA = '+15417030002'
const CLIENT_NEALON = '(541) 703-0003'

describe('cma broker-self text (never the household)', () => {
  it('resolves Matt from the broker map, not the CMA client phone', () => {
    const dest = resolveBrokerSelfPhone({ broker: 'matt', phonesByBroker, whitelist })
    expect(dest).toEqual({ ok: true, to: '+15415551234' })
    expect(last10(dest.ok ? dest.to : '')).not.toBe(last10(CLIENT_JANE))
    expect(last10(dest.ok ? dest.to : '')).not.toBe(last10(CLIENT_ODESSA))
    expect(last10(dest.ok ? dest.to : '')).not.toBe(last10(CLIENT_NEALON))
  })

  it('refuses a client/homeowner number even if someone passes it as the destination', () => {
    expect(isNonBrokerClientDestination(CLIENT_JANE, [CLIENT_JANE, CLIENT_ODESSA], whitelist)).toBe(true)
    expect(refuseIfClientDestination({
      to: CLIENT_JANE,
      clientPhones: [CLIENT_JANE, CLIENT_ODESSA, CLIENT_NEALON],
      whitelist,
    })).toEqual({ ok: false, error: 'Refused: that number is the client, not a broker line.' })
  })

  it('refuses any non-whitelist number', () => {
    expect(refuseIfClientDestination({
      to: '+15419998888',
      clientPhones: [],
      whitelist,
    }).ok).toBe(false)
  })

  it('never puts the client phone in the review-link body', () => {
    const body = cmaBrokerSelfTextBody({
      slug: '648-se-douglas-bend-97702',
      subjectAddress: '648 SE Douglas Ave, Bend',
    })
    expect(body).toContain('https://ryan-realty.com/admin/cmas/648-se-douglas-bend-97702')
    expect(body).toContain('broker only')
    expect(body).not.toMatch(/541-703-0001|5417030001|Odessa|Nealon|Jane/i)
    expect(cmaBrokerReviewUrl('648-SE-Douglas-Bend-97702')).toBe(
      'https://ryan-realty.com/admin/cmas/648-se-douglas-bend-97702',
    )
  })

  it('collects CMA client phones so the send path can refuse them', () => {
    expect(collectCmaClientPhones({ client_phone: CLIENT_JANE, clientPhone: CLIENT_ODESSA })).toEqual([
      CLIENT_JANE,
      CLIENT_ODESSA,
    ])
  })

  it('fails closed when the broker cell is missing or not whitelisted', () => {
    expect(resolveBrokerSelfPhone({ broker: 'matt', phonesByBroker: {}, whitelist }).ok).toBe(false)
    expect(
      resolveBrokerSelfPhone({
        broker: 'matt',
        phonesByBroker: { matt: CLIENT_JANE },
        whitelist,
      }).ok,
    ).toBe(false)
  })
})

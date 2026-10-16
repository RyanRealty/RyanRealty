import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { clearPublicRecordsCache } from '@/lib/sarah/public-records'
import {
  LOOKUP_PUBLIC_RECORDS_TOOL,
  SIP_PUBLIC_RECORDS_FILLER,
  handleSipPublicRecordsCall,
  parseSipToolArgs,
  sipSessionTools,
} from './voice-sip'

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  '../sarah/fixtures/public-records',
)

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf8')
}

describe('sipSessionTools', () => {
  it('always registers lookup_public_records on the phone session', () => {
    const bare = sipSessionTools({})
    expect(bare.map((t) => t.name)).toEqual(['lookup_public_records'])
    expect(bare[0]).toMatchObject({ name: LOOKUP_PUBLIC_RECORDS_TOOL.name, type: 'function' })

    const full = sipSessionTools({
      resolveTransfer: () => '+15555550100',
      onMessage: async () => true,
    })
    expect(full.map((t) => t.name)).toEqual([
      'transfer_call',
      'take_message',
      'lookup_public_records',
    ])
  })
})

describe('handleSipPublicRecordsCall', () => {
  it('returns a spoken ADU answer with filler contract and no transfer', async () => {
    expect(SIP_PUBLIC_RECORDS_FILLER).toBe('Let me check.')
    expect(parseSipToolArgs('{')).toEqual({})

    clearPublicRecordsCache()
    const spoken = await handleSipPublicRecordsCall(
      JSON.stringify({
        question: 'can I build an ADU here?',
        streetNumber: '4722',
        streetName: 'Zenith',
        city: 'Redmond',
        county: 'Deschutes',
        parcelNumber: '280444',
        latitude: 44.241837,
        longitude: -121.224638,
      }),
      {
        brokerFirstName: 'Matt',
        deps: {
          fetchText: async () => fixture('dial-permits-shop.html'),
          lookupZone: async () => ({ zone: 'R2', zoneType: '3' }),
        },
      },
    )
    expect(spoken).toMatch(/This lot is zoned R-2, limited residential/)
    expect(spoken).not.toMatch(/https?:\/\//)
    expect(spoken).toMatch(/Want me to text you the source, and connect you with Matt/)
    expect(spoken).not.toMatch(/transfer_call|refer|Dial Matt/i)
    expect(spoken.match(/The city can confirm/g)?.length).toBe(1)
  })

  it('returns a spoken shop-permit fact from the recorded DIAL fixture', async () => {
    clearPublicRecordsCache()
    const spoken = await handleSipPublicRecordsCall(
      JSON.stringify({
        question: 'is there a permit for the shop?',
        parcelNumber: '123456',
        city: 'Redmond',
        county: 'Deschutes',
      }),
      {
        brokerFirstName: 'Matt',
        deps: {
          fetchText: async () => fixture('dial-permits-shop.html'),
          lookupZone: async () => ({ zone: null, zoneType: null }),
        },
      },
    )
    expect(spoken).toMatch(/20 by 30 shop in 2021/)
    expect(spoken).not.toMatch(/https?:\/\//)
    expect(spoken).toMatch(/Want me to text you the source, and connect you with Matt/)
  })
})

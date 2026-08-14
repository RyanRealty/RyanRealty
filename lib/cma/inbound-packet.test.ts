import { describe, expect, it } from 'vitest'
import { checkBrandVoice } from '@/lib/voice/check'
import { blamesPriorAgent, isWorthQuestionCopy } from '@/lib/crm/first-touch-copy'
import {
  composeInboundCoverLine,
  composeInboundValuationCopy,
  emptyInboundPacketFacts,
  inboundImmersiveHeroKick,
  inboundImmersiveTitle,
  resolveThisHomePlan,
} from './inbound-packet'

const FULL = {
  ...emptyInboundPacketFacts(),
  address: '1842 NW Foo St',
  firstName: 'Pat',
  valueLow: 820000,
  valueHigh: 910000,
  recommendedList: 865000,
}

function assertCBar(body: string, address: string | null) {
  expect(isWorthQuestionCopy(body)).toBe(false)
  expect(blamesPriorAgent(body)).toBe(false)
  expect(body).not.toMatch(/ryan-realty\.com\/sell/i)
  expect(body).not.toMatch(/a little about us/i)
  expect(body).not.toMatch(/what every listing gets/i)
  expect(body).not.toMatch(/full market analysis/i)
  expect(body).not.toMatch(/\bI (saw|put)\b/)
  if (address) expect(body).toContain(address)
  const voice = checkBrandVoice(body)
  expect(voice.ok, JSON.stringify(voice.violations)).toBe(true)
}

describe('inbound valuation first packet', () => {
  it('names THIS address, markets this home, and cites verified numbers only', () => {
    const copy = composeInboundValuationCopy(FULL)
    assertCBar(copy.bodyText, '1842 NW Foo St')
    assertCBar(copy.subject, '1842 NW Foo St')
    assertCBar(copy.previewText, '1842 NW Foo St')
    expect(copy.subject).toBe('Your report on 1842 NW Foo St')
    expect(copy.mastheadLine).toBe('THIS HOME')
    expect(copy.bodyText).toContain('listing video')
    expect(copy.bodyText).toContain('flyers')
    expect(copy.bodyText).toContain('photo set')
    expect(copy.bodyText).toContain('$820,000')
    expect(copy.bodyText).toContain('$910,000')
    expect(copy.bodyText).toContain('$865,000')
    expect(copy.numbers).toContain('Recommended list:')
  })

  it('omits the range when any number is missing and invents no digits', () => {
    const copy = composeInboundValuationCopy({
      ...emptyInboundPacketFacts(),
      address: '1842 NW Foo St',
      firstName: 'Pat',
    })
    assertCBar(copy.bodyText, '1842 NW Foo St')
    expect(copy.numbers).toBeNull()
    expect(copy.bodyText).not.toMatch(/\$\d/)
    expect(copy.bodyText).toContain('listing video')
  })

  it('does not invent an address', () => {
    const copy = composeInboundValuationCopy(emptyInboundPacketFacts())
    assertCBar(copy.bodyText, null)
    expect(copy.subject).toBe('Your report on this home')
    expect(copy.bodyText).toContain('this home')
    expect(copy.bodyText).not.toMatch(/1842|Main St/)
    expect(copy.bodyText).not.toMatch(/\$\d/)
  })
})

describe('this-home plan fallback', () => {
  it('keeps an explicit plan and otherwise builds from the address', () => {
    expect(resolveThisHomePlan({ thisHomePlan: ['For 9 Pine we cut a listing video from this home\'s photos.'] })[0]).toContain('9 Pine')
    const fallback = resolveThisHomePlan({ streetAddress: '1842 NW Foo St' })
    expect(fallback[0]).toContain('1842 NW Foo St')
    expect(fallback[0]).toContain('listing video')
    expect(fallback.join(' ')).not.toMatch(/What every Ryan Realty listing gets/i)
  })
})

describe('cover + immersive openers', () => {
  it('name THIS home and the list-kit plan, never a worth-question', () => {
    const cover = composeInboundCoverLine('1842 NW Foo St')
    const kick = inboundImmersiveHeroKick('1842 NW Foo St', '2026-08-13T18:00:00.000Z')
    const title = inboundImmersiveTitle('1842 NW Foo St')
    for (const line of [cover, kick, title]) {
      assertCBar(line, '1842 NW Foo St')
      expect(line).not.toMatch(/what your home is worth/i)
    }
    expect(cover).toContain('listing video')
    expect(kick).toBe('How we would market 1842 NW Foo St · 2026-08-13')
    expect(title).toContain('How we would market this home')
  })
})

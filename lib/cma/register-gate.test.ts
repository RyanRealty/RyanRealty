import { describe, expect, it } from 'vitest'
import { checkBrandVoice } from '@/lib/voice/check'
import { blamesPriorAgent, isWorthQuestionCopy } from '@/lib/crm/first-touch-copy'
import { renderRegisterShell } from './register-gate'

describe('CMA register shell — inbound packet', () => {
  it('names THIS home and the list-kit plan, never a worth-question', () => {
    const html = renderRegisterShell({
      slug: 'cma-1842-nw-foo',
      address: '1842 NW Foo St',
      clientName: 'Pat',
    })
    expect(html).toContain('Your report on 1842 NW Foo St')
    expect(html).toContain('listing video')
    expect(html).toContain('flyers')
    expect(html).toContain('photo set')
    expect(html).not.toMatch(/what your home is worth/i)
    expect(html).not.toMatch(/What every listing gets/i)
    expect(isWorthQuestionCopy(html)).toBe(false)
    expect(blamesPriorAgent(html)).toBe(false)
    const visible = [
      'Your report on 1842 NW Foo St is ready',
      'How we would market 1842 NW Foo St: listing video, flyers, and a photo set made for this house',
      'Closed sales near 1842 NW Foo St, each adjusted for when it sold and how its size compares',
      'A licensed Oregon broker one text away',
    ]
    for (const line of visible) {
      const voice = checkBrandVoice(line)
      expect(voice.ok, `${line} -> ${JSON.stringify(voice.violations)}`).toBe(true)
    }
  })
})

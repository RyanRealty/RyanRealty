import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ROUTE = 'app/api/visitors/track/route.ts'

describe('visitors/track GA4 page_view mirror — broker props', () => {
  const src = readFileSync(ROUTE, 'utf8')

  it('resolves visit broker and attaches assigned_broker + broker_slug on the MP fire', () => {
    expect(src).toContain("from '@/lib/analytics/visit-broker'")
    expect(src).toContain('visitBrokerGa4Fields')
    expect(src).toContain('resolveVisitBrokerSlug')
    expect(src).toContain('AGENT_ATTRIB_COOKIE')
    expect(src).toMatch(/userProperties:[\s\S]*broker\?\.userProperties/)
    expect(src).toMatch(/eventParams:[\s\S]*broker\?\.eventParams/)
  })
})

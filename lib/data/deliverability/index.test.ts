import { describe, it, expect } from 'vitest'
import { deliverabilityVerdict } from './index'

const row = (o: Partial<Parameters<typeof deliverabilityVerdict>[0] & object>) =>
  ({ domain: 'news.ryan-realty.com', metric_date: '2026-07-03', spam_ratio: 0, domain_reputation: 'HIGH', spf_ok: true, dkim_ok: true, dmarc_ok: true, fetched_at: '2026-07-03T00:00:00Z', ...o }) as Parameters<typeof deliverabilityVerdict>[0]

describe('deliverabilityVerdict (G-NL-20)', () => {
  it('no data → warmup (never block, never full-blast)', () => {
    expect(deliverabilityVerdict(null).action).toBe('warmup')
  })
  it('LOW / BAD reputation → block', () => {
    expect(deliverabilityVerdict(row({ domain_reputation: 'LOW' })).action).toBe('block')
    expect(deliverabilityVerdict(row({ domain_reputation: 'BAD' })).action).toBe('block')
  })
  it('spam rate over 0.30% → block', () => {
    expect(deliverabilityVerdict(row({ spam_ratio: 0.004 })).action).toBe('block')
  })
  it('MEDIUM reputation or spam > 0.10% → warn', () => {
    expect(deliverabilityVerdict(row({ domain_reputation: 'MEDIUM' })).action).toBe('warn')
    expect(deliverabilityVerdict(row({ spam_ratio: 0.0015 })).action).toBe('warn')
  })
  it('HIGH reputation, low spam → allow', () => {
    expect(deliverabilityVerdict(row({ domain_reputation: 'HIGH', spam_ratio: 0.0002 })).action).toBe('allow')
  })
})

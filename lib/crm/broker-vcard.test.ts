import { describe, expect, it } from 'vitest'
import { buildBrokerVcard } from '@/lib/crm/broker-vcard'

describe('broker vCard', () => {
  it('builds a work card without a private cell field', () => {
    const vcf = buildBrokerVcard({
      name: 'Matt Ryan',
      email: 'matt@ryan-realty.com',
      phone: '+15417033095',
    })
    expect(vcf).toContain('BEGIN:VCARD')
    expect(vcf).toContain('FN:Matt Ryan')
    expect(vcf).toContain('EMAIL;TYPE=WORK:matt@ryan-realty.com')
    expect(vcf).toContain('TEL;TYPE=WORK,VOICE:+15417033095')
    expect(vcf).toContain('END:VCARD')
    expect(vcf).not.toMatch(/Jane|Odessa|Nealon/i)
  })
})

import { describe, expect, it } from 'vitest'
import {
  cmaComposeEmailBody,
  cmaComposeEmailFromFacts,
  cmaComposeEmailSubject,
  cmaComposePdfFilename,
  cmaComposeSmsBody,
} from './crm-compose-copy'
import { subjectHasBareCma } from './fsbo-cma-templates'

describe('cma compose copy', () => {
  it('keeps SE on 648 SE Douglas and never bare-CMA subjects', () => {
    const address = '648 SE Douglas, Bend, OR 97702'
    const subject = cmaComposeEmailSubject(address)
    expect(subject).toBe('Pricing report for 648 SE Douglas, Bend, OR 97702')
    expect(subjectHasBareCma(subject)).toBe(false)
    expect(cmaComposeEmailBody(address)).toContain('648 SE Douglas')
    expect(cmaComposeEmailBody(address)).not.toContain('/cma/')
    expect(cmaComposeEmailBody(address)).not.toMatch(/\bCMA\b/)
    expect(cmaComposeSmsBody(address)).toBe('Pricing report for 648 SE Douglas, Bend, OR 97702 is attached.')
    expect(cmaComposePdfFilename('cma-648-se-douglas')).toBe('cma-648-se-douglas.pdf')
  })

  it('merges owner + range facts into first-touch email', () => {
    const out = cmaComposeEmailFromFacts({
      subjectAddress: '123 NW Cascade Ave, Bend, OR 97703',
      ownerFirstName: 'Sarah',
      priceRangeLow: 625000,
      priceRangeHigh: 655000,
      suggestedListPrice: 649000,
      calendarLink: 'https://ryan-realty.com/book/matt',
      agentName: 'Matt Ryan',
    })
    expect(out.subject).toContain('Pricing report')
    expect(out.body).toContain('Hi Sarah')
    expect(out.body).toContain('$649,000')
    expect(out.requiresPdfAttachment).toBe(true)
  })
})

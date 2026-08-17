import { describe, expect, it } from 'vitest'
import { brokerCmaViewHref, canBrokerReviewCma, isCmaClientReady } from './draft-access'

describe('CMA draft review access', () => {
  it('keeps drafts off the public web', () => {
    expect(isCmaClientReady('draft')).toBe(false)
    expect(isCmaClientReady('building')).toBe(false)
    expect(isCmaClientReady('archived')).toBe(false)
    expect(canBrokerReviewCma({ isAdmin: false, status: 'draft' })).toBe(false)
  })

  it('lets a broker open a draft for review', () => {
    expect(canBrokerReviewCma({ isAdmin: true, status: 'draft' })).toBe(true)
    expect(canBrokerReviewCma({ isAdmin: true, status: 'building' })).toBe(true)
  })

  it('lets anyone with the link open a client-ready document', () => {
    expect(isCmaClientReady('finalized')).toBe(true)
    expect(isCmaClientReady('delivered')).toBe(true)
    expect(canBrokerReviewCma({ isAdmin: false, status: 'finalized' })).toBe(true)
  })

  it('sends broker review through the admin view, not the public slug', () => {
    expect(brokerCmaViewHref('cma-850-quince-redmond-97756')).toBe(
      '/admin/cmas/cma-850-quince-redmond-97756/view',
    )
  })
})

import { describe, expect, it } from 'vitest'
import {
  adminCmaEntityActions,
  brokerCmaViewHref,
  canBrokerReviewCma,
  canOpenCmaDocument,
  isCmaClientReady,
} from './draft-access'

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

  it('opens a draft that only has render_args', () => {
    expect(canOpenCmaDocument({ render_args: { comps: [] }, html_content: null })).toBe(true)
    expect(canOpenCmaDocument({ html_content: null, html_path: null, render_args: null })).toBe(false)
  })

  it('does not reopen a failed rebuild that only stamped built_at after clearing html', () => {
    expect(
      canOpenCmaDocument({
        html_content: null,
        html_path: null,
        render_args: null,
        built_at: '2026-09-04T03:00:00.000Z',
      }),
    ).toBe(false)
  })

  it('opens a built draft from html_path without pulling html_content', () => {
    expect(
      canOpenCmaDocument({
        html_content: null,
        html_path: 'db:cmas.html_content:cma-648-se-douglas',
        render_args: null,
      }),
    ).toBe(true)
  })

  it('keeps Review CMA and Open PDF as quiet document links, never the page primary', () => {
    const actions = adminCmaEntityActions({
      slug: 'cma-850-quince-redmond-97756',
      canOpenDocument: true,
      hasPdf: true,
    })
    expect(actions[0]).toEqual({
      id: 'review-cma',
      label: 'Review CMA',
      href: '/admin/cmas/cma-850-quince-redmond-97756/view',
      primary: false,
    })
    expect(actions.every((a) => a.primary === false)).toBe(true)
  })
})

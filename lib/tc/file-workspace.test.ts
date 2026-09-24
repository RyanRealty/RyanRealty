import { describe, expect, it } from 'vitest'
import {
  checklistFilter,
  currentCycle,
  cycleLabel,
  fileAttention,
  fileTab,
  isFinishedFile,
  matchesChecklistFilter,
  milestonesFor,
  type WorkspaceCycle,
} from './file-workspace'

function cycle(p: Partial<WorkspaceCycle> & { id: string; kind: 'sale' | 'listing' }): WorkspaceCycle {
  return {
    status: null,
    contract_acceptance_date: null,
    escrow_closing_date: null,
    actual_closing_date: null,
    expiration_date: null,
    dead_date: null,
    inspection_days: null,
    financing_days: null,
    listing_date: null,
    ...p,
  }
}

describe('which cycle a file opens on', () => {
  // 3480 SW 45th: the 2025 sale closed; the 2026 listing and sale followed.
  const old2025 = cycle({ id: 'sale-2025', kind: 'sale', status: 'Closed', contract_acceptance_date: '2025-07-06', actual_closing_date: '2025-08-14' })
  const listing2026 = cycle({ id: 'listing-2026', kind: 'listing', status: 'Transaction', listing_date: '2026-07-10' })
  const sale2026 = cycle({ id: 'sale-2026', kind: 'sale', status: 'Pending', contract_acceptance_date: '2026-07-21', escrow_closing_date: '2026-09-01' })
  const canceled = cycle({ id: 'sale-dead', kind: 'sale', status: 'Canceled/Pend', contract_acceptance_date: '2026-08-01', dead_date: '2026-08-10' })

  it('opens a file under contract on its live sale, not an older close or a canceled one', () => {
    expect(currentCycle([old2025, listing2026, canceled, sale2026], 'pending')?.id).toBe('sale-2026')
  })
  it('opens an active listing on the listing', () => {
    expect(currentCycle([old2025, listing2026], 'active_listing')?.id).toBe('listing-2026')
  })
  it('opens a closed file on its latest closed sale', () => {
    const closed2026 = { ...sale2026, status: 'Closed', actual_closing_date: '2026-09-01' }
    expect(currentCycle([old2025, closed2026, listing2026], 'closed')?.id).toBe('sale-2026')
  })
  it('honors the cycle asked for', () => {
    expect(currentCycle([old2025, sale2026], 'pending', 'sale-2025')?.id).toBe('sale-2025')
    expect(currentCycle([old2025, sale2026], 'pending', 'nope')?.id).toBe('sale-2026')
  })
  it('labels a cycle with its kind, date and status', () => {
    expect(cycleLabel(sale2026)).toBe('Sale · accepted Jul 21, 2026 · Pending')
    expect(cycleLabel(listing2026)).toBe('Listing · listed Jul 10, 2026 · Transaction')
  })
})

describe('milestones', () => {
  it('walks a sale from acceptance to closing in banking days, marking the next step', () => {
    const steps = milestonesFor(
      cycle({ id: 's', kind: 'sale', contract_acceptance_date: '2026-09-21', inspection_days: 10, financing_days: 21, escrow_closing_date: '2026-10-30' }),
      '2026-09-24',
    )
    expect(steps.map((s) => s.label)).toEqual(['Accepted', 'Earnest money', 'Inspection ends', 'Financing ends', 'Closing'])
    expect(steps[0]).toMatchObject({ state: 'done', date: 'Sep 21' })
    // Earnest money: 3 banking days after Mon Sep 21 is Thu Sep 24 — today, so it is next.
    expect(steps[1]).toMatchObject({ state: 'next', date: 'Sep 24 · today' })
    expect(steps[4].date).toBe('Oct 30 · in 36 days')
  })

  it('reads a passed deadline as passed, not done, and a missed closing as late', () => {
    const steps = milestonesFor(
      cycle({ id: 's', kind: 'sale', contract_acceptance_date: '2026-08-03', inspection_days: 10, escrow_closing_date: '2026-09-20' }),
      '2026-09-24',
    )
    expect(steps.find((s) => s.key === 'inspection_period_ends')?.state).toBe('past')
    expect(steps.find((s) => s.key === 'closing')).toMatchObject({ state: 'late', date: 'Sep 20 · 4 days late' })
  })

  it('shows a recorded close as done', () => {
    const steps = milestonesFor(cycle({ id: 's', kind: 'sale', contract_acceptance_date: '2026-07-21', actual_closing_date: '2026-09-01' }), '2026-09-24')
    expect(steps[steps.length - 1]).toMatchObject({ label: 'Closed', state: 'done', date: 'Sep 1' })
  })

  it('walks a listing from listed to expiration with days on market', () => {
    const steps = milestonesFor(cycle({ id: 'l', kind: 'listing', listing_date: '2026-08-01', expiration_date: '2026-12-31' }), '2026-09-24')
    expect(steps).toEqual([
      { key: 'listed', label: 'Listed', date: 'Aug 1 · 54 days on market', state: 'done' },
      { key: 'expires', label: 'Listing expires', date: 'Dec 31 · in 98 days', state: 'next' },
    ])
  })
})

describe('checklist filter', () => {
  it('maps each filter to the statuses it shows', () => {
    expect(checklistFilter('review')).toBe('review')
    expect(checklistFilter('bogus')).toBe('all')
    expect(matchesChecklistFilter('in_review', 'review')).toBe(true)
    expect(matchesChecklistFilter('required', 'missing')).toBe(true)
    expect(matchesChecklistFilter('na', 'done')).toBe(true)
    expect(matchesChecklistFilter('completed', 'missing')).toBe(false)
  })
  it('falls back to the overview for an unknown tab', () => {
    expect(fileTab('documents')).toBe('documents')
    expect(fileTab('nope')).toBe('overview')
  })
})

describe('what needs a person on this file', () => {
  it('lists a passed closing, reviews, missing documents, in that order', () => {
    const out = fileAttention({
      propertyKey: 'k',
      stage: 'pending',
      stageDetail: null,
      cycle: cycle({ id: 'c1', kind: 'sale', escrow_closing_date: '2026-09-20' }),
      checklist: [
        { name: 'Sellers Property Disclosure', status: 'in_review' },
        { name: 'FIRPTA Advisory', status: 'required' },
        { name: 'Sale Agreement', status: 'completed' },
      ],
      superuser: true,
      today: '2026-09-24',
    })
    expect(out.map((o) => o.key)).toEqual(['pastclose', 'review', 'missing'])
    expect(out[1]).toMatchObject({ title: '1 document waiting for your review', href: '/admin/deals/k?tab=documents&cycle=c1&filter=review' })
    expect(out[2].context).toBe('FIRPTA Advisory')
  })
  it('shows no warnings on a closed file or a cycle that fell through (Matt 2026-09-24)', () => {
    const checklist = [
      { name: 'Sellers Property Disclosure', status: 'in_review' as const },
      { name: 'FIRPTA Advisory', status: 'required' as const },
    ]
    const closedDeal = fileAttention({ propertyKey: 'k', stage: 'closed', stageDetail: null, cycle: cycle({ id: 'c1', kind: 'sale' }), checklist, superuser: true, today: '2026-09-24' })
    expect(closedDeal).toEqual([])
    // a live deal looking at its older, canceled cycle
    const canceled = fileAttention({
      propertyKey: 'k',
      stage: 'pending',
      stageDetail: null,
      cycle: cycle({ id: 'c0', kind: 'sale', status: 'Canceled/Pend', dead_date: '2026-04-24' }),
      checklist,
      superuser: true,
      today: '2026-09-24',
    })
    expect(canceled).toEqual([])
    expect(isFinishedFile('pending', cycle({ id: 'c2', kind: 'sale', actual_closing_date: '2026-07-09' }))).toBe(true)
    expect(isFinishedFile('pending', cycle({ id: 'c3', kind: 'sale', status: 'Pending' }))).toBe(false)
    expect(isFinishedFile('active_listing', cycle({ id: 'c4', kind: 'listing', status: 'Transaction' }))).toBe(false)
  })
  it('asks to confirm a file the mail sweep opened', () => {
    const out = fileAttention({ propertyKey: 'k', stage: 'pre_contract', stageDetail: 'Opened from email: confirm side and stage', cycle: null, checklist: [], superuser: false, today: '2026-09-24' })
    expect(out[0].key).toBe('confirm')
  })
})

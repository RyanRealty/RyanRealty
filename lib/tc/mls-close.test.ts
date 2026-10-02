/**
 * The MLS close rule (lib/tc/mls-close.ts) on placeholder data shaped like the
 * cases found 2026-10-01: a sale SkySlope let lapse to Expired that the MLS
 * shows closed on its own escrow date (closed), and a listing whose first
 * contract fell through before a second contract closed (left canceled).
 */
import { describe, expect, it } from 'vitest'
import {
  CLOSED_STATUS,
  MLS_CLOSE_WINDOW_DAYS,
  applyMlsCloses,
  daysBetween,
  decideMlsCloses,
  decideStageAfterMlsClose,
  deriveVaultDealStage,
  isOurOffice,
  type MlsCloseCycle,
  type MlsCloseDecision,
  type MlsListingFacts,
} from './mls-close'

const MLS = '000000001'
const OTHER_MLS = '000000002'

function cycle(over: Partial<MlsCloseCycle> & { id: string }): MlsCloseCycle {
  return {
    dealId: 'deal-a',
    kind: 'sale',
    status: 'Pending',
    mlsNumber: MLS,
    contractAcceptanceDate: '2030-03-01',
    escrowClosingDate: '2030-03-20',
    actualClosingDate: null,
    deadDate: null,
    createdOn: '2030-03-02T09:00:00',
    ...over,
  }
}

function listing(over: Partial<MlsListingFacts> = {}): MlsListingFacts {
  return {
    listNumber: MLS,
    status: 'Closed',
    closeDate: '2030-03-20',
    closePrice: 500000,
    purchaseContractDate: '2030-03-01',
    listOfficeName: 'Example Listing Office',
    buyerOfficeName: 'Ryan Realty LLC',
    ...over,
  }
}

const rows = (...ls: MlsListingFacts[]) => new Map(ls.map((l) => [l.listNumber, l]))
const byId = (ds: MlsCloseDecision[], id: string) => ds.find((d) => d.cycleId === id)!

describe('a sale the MLS shows closed on its own escrow date is closed, whatever SkySlope says', () => {
  it('the lapsed folder: Expired in SkySlope, Closed in the MLS on the escrow date', () => {
    const lapsed = cycle({ id: 'c-expired', status: 'Expired' })
    const [d] = decideMlsCloses([lapsed], rows(listing()))
    expect(d).toMatchObject({
      kind: 'close',
      cycleId: 'c-expired',
      set: { status: CLOSED_STATUS, actual_closing_date: '2030-03-20' },
      evidence: { list_number: MLS, mls_close_date: '2030-03-20', escrow_closing_date: '2030-03-20', days_from_escrow_date: 0, mls_close_price: 500000 },
    })
    const stage = decideStageAfterMlsClose({
      vaultStage: 'dead',
      vaultStageDetail: 'All cycles canceled',
      cyclesAfter: applyMlsCloses([lapsed], [d]),
      closedListNumbers: new Set([MLS]),
    })
    expect(stage).toEqual({
      kind: 'update',
      from: { stage: 'dead', stageDetail: 'All cycles canceled' },
      to: { stage: 'closed', stageDetail: 'Closed 2030-03-20' },
    })
  })

  it('a pending sale nobody marked closed', () => {
    const pending = cycle({ id: 'c-pending', status: 'Pending' })
    const [d] = decideMlsCloses([pending], rows(listing({ closeDate: '2030-03-21' })))
    expect(d).toMatchObject({ kind: 'close', set: { status: 'Closed', actual_closing_date: '2030-03-21' }, evidence: { days_from_escrow_date: 1 } })
    expect(
      decideStageAfterMlsClose({ vaultStage: 'pending', vaultStageDetail: 'Under contract — closes 2030-03-20', cyclesAfter: applyMlsCloses([pending], [d]), closedListNumbers: new Set([MLS]) }),
    ).toMatchObject({ kind: 'update', to: { stage: 'closed', stageDetail: 'Closed 2030-03-21' } })
  })

  it('status already Closed but no close date: only the date is written', () => {
    const [d] = decideMlsCloses([cycle({ id: 'c', status: 'Closed' })], rows(listing()))
    expect(d).toMatchObject({ kind: 'close', set: { actual_closing_date: '2030-03-20' } })
    expect((d as Extract<MlsCloseDecision, { kind: 'close' }>).set.status).toBeUndefined()
  })

  it(`allows ${MLS_CLOSE_WINDOW_DAYS} days either way, not one more`, () => {
    const c = cycle({ id: 'c' })
    expect(decideMlsCloses([c], rows(listing({ closeDate: '2030-03-23' })))[0].kind).toBe('close')
    expect(decideMlsCloses([c], rows(listing({ closeDate: '2030-03-17' })))[0].kind).toBe('close')
    expect(decideMlsCloses([c], rows(listing({ closeDate: '2030-03-24' })))[0]).toMatchObject({ kind: 'skip', reason: 'close_outside_window' })
    expect(decideMlsCloses([c], rows(listing({ closeDate: '2030-03-16' })))[0]).toMatchObject({ kind: 'skip', reason: 'close_outside_window' })
  })

  it('counts our listing side as ours too', () => {
    const [d] = decideMlsCloses([cycle({ id: 'c' })], rows(listing({ listOfficeName: 'Ryan Realty LLC', buyerOfficeName: 'Another Brokerage' })))
    expect(d.kind).toBe('close')
  })
})

describe('the first contract fell through and a second contract closed: the first stays canceled', () => {
  // One listing, one MLS number. Contract 1 accepted 2030-01-05, set to close
  // 2030-02-10, canceled 2030-01-25. Contract 2 accepted 2030-02-20 and closed
  // 2030-03-20 (the MLS row).
  const first = cycle({ id: 'c-first', status: 'Canceled/App', contractAcceptanceDate: '2030-01-05', escrowClosingDate: '2030-02-10', deadDate: '2030-01-25', createdOn: '2030-01-05T00:00:00' })

  it('the second contract already closed in the Vault: nothing changes', () => {
    const second = cycle({ id: 'c-second', status: 'Closed', contractAcceptanceDate: '2030-02-20', actualClosingDate: '2030-03-20', createdOn: '2030-02-20T00:00:00' })
    const ds = decideMlsCloses([first, second], rows(listing()))
    expect(byId(ds, 'c-first')).toMatchObject({ kind: 'skip', reason: 'close_outside_window' })
    expect(byId(ds, 'c-second')).toMatchObject({ kind: 'skip', reason: 'already_closed' })
    expect(ds.filter((d) => d.kind === 'close')).toEqual([])
  })

  it('the second contract still Pending in the Vault: only the second closes', () => {
    const second = cycle({ id: 'c-second', status: 'Pending', contractAcceptanceDate: '2030-02-20', escrowClosingDate: '2030-03-20', createdOn: '2030-02-20T00:00:00' })
    const ds = decideMlsCloses([first, second], rows(listing()))
    expect(byId(ds, 'c-first')).toMatchObject({ kind: 'skip' })
    expect(byId(ds, 'c-second')).toMatchObject({ kind: 'close', set: { status: 'Closed', actual_closing_date: '2030-03-20' } })
  })

  it('a canceled first contract set to close near the date the second closed is still left alone when it died first', () => {
    const near = { ...first, escrowClosingDate: '2030-03-18' }
    const [d] = decideMlsCloses([near], rows(listing({ buyerOfficeName: 'Ryan Realty LLC' })))
    expect(d).toMatchObject({ kind: 'skip', reason: 'dead_before_close', detail: 'dead 2030-01-25, MLS closed 2030-03-20' })
  })

  it('a duplicate folder beside the closed one is explained by it', () => {
    const closed = cycle({ id: 'c-closed', status: 'Closed', actualClosingDate: '2030-03-20' })
    const duplicate = cycle({ id: 'c-dup', status: 'Pre-Contract', escrowClosingDate: '2030-03-22' })
    expect(byId(decideMlsCloses([closed, duplicate], rows(listing())), 'c-dup')).toMatchObject({ kind: 'skip', reason: 'explained_by_other_cycle' })
  })

  it('a closed sibling on another MLS number explains a close within the window of its date', () => {
    const closed = cycle({ id: 'c-closed', status: 'Closed', mlsNumber: OTHER_MLS, actualClosingDate: '2030-03-21' })
    const open = cycle({ id: 'c-open', status: 'Expired' })
    expect(byId(decideMlsCloses([closed, open], rows(listing())), 'c-open')).toMatchObject({ kind: 'skip', reason: 'explained_by_other_cycle' })
  })
})

describe('what the MLS close does not decide', () => {
  it('another brokerage on both sides: not our sale', () => {
    const [d] = decideMlsCloses([cycle({ id: 'c', status: 'Canceled/App' })], rows(listing({ listOfficeName: 'Brokerage A', buyerOfficeName: 'Brokerage B' })))
    expect(d).toMatchObject({ kind: 'skip', reason: 'not_our_sale' })
  })

  it('two open cycles that both qualify: neither is closed', () => {
    const ds = decideMlsCloses([cycle({ id: 'c-1' }), cycle({ id: 'c-2', status: 'Expired' })], rows(listing()))
    expect(ds.map((d) => [d.cycleId, d.kind, d.kind === 'skip' ? d.reason : null])).toEqual([
      ['c-1', 'skip', 'ambiguous'],
      ['c-2', 'skip', 'ambiguous'],
    ])
  })

  it('a contract accepted after the close is another sale', () => {
    const [d] = decideMlsCloses([cycle({ id: 'c', contractAcceptanceDate: '2030-03-21', escrowClosingDate: '2030-03-21' })], rows(listing()))
    expect(d).toMatchObject({ kind: 'skip', reason: 'contract_after_close' })
  })

  it('needs the MLS row closed with a date, the cycle’s own number, and an escrow date', () => {
    const c = cycle({ id: 'c' })
    expect(decideMlsCloses([c], rows(listing({ status: 'Pending', closeDate: null })))[0]).toMatchObject({ reason: 'mls_not_closed' })
    expect(decideMlsCloses([c], rows(listing({ closeDate: null })))[0]).toMatchObject({ reason: 'no_mls_close_date' })
    expect(decideMlsCloses([c], new Map())[0]).toMatchObject({ reason: 'no_mls_row' })
    expect(decideMlsCloses([cycle({ id: 'c', mlsNumber: '  ' })], rows(listing()))[0]).toMatchObject({ reason: 'no_mls_number' })
    expect(decideMlsCloses([cycle({ id: 'c', escrowClosingDate: null })], rows(listing()))[0]).toMatchObject({ reason: 'no_escrow_closing_date' })
  })

  it('never touches a listing cycle or a cycle the Vault already closed', () => {
    expect(decideMlsCloses([cycle({ id: 'l', kind: 'listing', status: 'Active' })], rows(listing()))[0]).toMatchObject({ reason: 'not_a_sale' })
    expect(decideMlsCloses([cycle({ id: 'c', status: 'Closed', actualClosingDate: '2030-03-19' })], rows(listing()))[0]).toMatchObject({ reason: 'already_closed' })
  })

  it('matches the MLS number with surrounding spaces', () => {
    expect(decideMlsCloses([cycle({ id: 'c', mlsNumber: ` ${MLS} ` })], rows(listing()))[0].kind).toBe('close')
  })
})

describe('the deal stage that follows', () => {
  it('holds when the house is back on the market under a newer listing', () => {
    const old = cycle({ id: 'c-old', status: 'Expired', createdOn: '2030-03-02' })
    const relist = cycle({ id: 'l-new', kind: 'listing', status: 'Active', mlsNumber: OTHER_MLS, createdOn: '2031-05-01' })
    const [d] = decideMlsCloses([old, relist], rows(listing()))
    expect(d.kind).toBe('close')
    expect(
      decideStageAfterMlsClose({ vaultStage: 'active_listing', vaultStageDetail: 'On market', cyclesAfter: applyMlsCloses([old, relist], [d]), closedListNumbers: new Set([MLS]) }),
    ).toMatchObject({ kind: 'hold', derived: { stage: 'active_listing' } })
  })

  it('holds when a newer sale on the property is under contract', () => {
    const old = cycle({ id: 'c-old', status: 'Expired' })
    const newer = cycle({ id: 'c-new', status: 'Pending', mlsNumber: OTHER_MLS, escrowClosingDate: '2031-06-01', createdOn: '2031-05-01' })
    const ds = decideMlsCloses([old, newer], rows(listing()))
    expect(decideStageAfterMlsClose({ vaultStage: 'pending', vaultStageDetail: 'x', cyclesAfter: applyMlsCloses([old, newer], ds), closedListNumbers: new Set([MLS]) })).toMatchObject({
      kind: 'hold',
      derived: { stage: 'pending' },
    })
  })

  it('a listing cycle still reading Active on the sold MLS number does not outrank its own closed sale', () => {
    const inhouseListing = cycle({ id: 'l', kind: 'listing', status: 'Active', createdOn: '2030-02-01' })
    const sale = cycle({ id: 'c', status: 'Pending' })
    const ds = decideMlsCloses([inhouseListing, sale], rows(listing()))
    expect(deriveVaultDealStage(applyMlsCloses([inhouseListing, sale], ds), new Set([MLS]))).toEqual({ stage: 'closed', stageDetail: 'Closed 2030-03-20' })
  })

  it('is the same when the Vault already reads closed on that date', () => {
    const c = cycle({ id: 'c', status: 'Closed' })
    const ds = decideMlsCloses([c], rows(listing()))
    expect(decideStageAfterMlsClose({ vaultStage: 'closed', vaultStageDetail: 'Closed 2030-03-20', cyclesAfter: applyMlsCloses([c], ds), closedListNumbers: new Set() })).toMatchObject({ kind: 'same' })
  })
})

describe('small pieces', () => {
  it('daysBetween counts calendar days and reads timestamps by their date', () => {
    expect(daysBetween('2030-03-20', '2030-03-23')).toBe(3)
    expect(daysBetween('2030-03-20T00:00:00', '2030-03-17 00:00:00+00')).toBe(-3)
    expect(daysBetween('2030-02-27', '2030-03-02')).toBe(3)
  })
  it('isOurOffice reads the office name the MLS uses', () => {
    expect(isOurOffice('Ryan Realty LLC')).toBe(true)
    expect(isOurOffice('RYAN REALTY')).toBe(true)
    expect(isOurOffice('Bryan Realty Group')).toBe(false)
    expect(isOurOffice(null)).toBe(false)
  })
})

/**
 * The decision the sequence engine takes before every recovery text or email
 * (lib/crm/sequence-relist-guard.ts), with the relist check and the reads faked.
 * The route test (app/api/cron/crm-sequence-engine/relist-guard.test.ts) runs
 * the real check end to end.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  verifyNotRelisted: vi.fn(),
  getRecoveryProspectsForPerson: vi.fn(),
  countTimelineNotesWithKeyPrefix: vi.fn(),
}))

vi.mock('@/lib/data/prospecting/batch', () => ({ verifyNotRelisted: h.verifyNotRelisted }))
vi.mock('@/lib/data/crm/recoveryProspects', () => ({
  getRecoveryProspectsForPerson: h.getRecoveryProspectsForPerson,
  countTimelineNotesWithKeyPrefix: h.countTimelineNotesWithKeyPrefix,
}))

import {
  SEQ_RELIST_MAX_ROW_FAILURES,
  SEQ_RELIST_ROW_RETRY_MS,
  decideRecoveryTouch,
  recoveryKindFor,
} from './sequence-relist-guard'

const NOW = new Date('2026-09-30T18:00:00Z')
const CLEAR = { relisted: false, verifyFailed: false, failureScope: null, reason: null, blockedStatus: null, blockedKey: null, blockedDate: null, source: null }
const HOME = { kind: 'expired', id: 'OLD', streetAddress: '20873 Greenmont', city: 'Bend', postalCode: '97702', offMarketAt: '2026-07-05T05:00:00Z' }
const SECOND = { kind: 'fsbo', id: 'https://fsbo.example/7', streetAddress: '7 Oak St', city: 'Bend', postalCode: null, offMarketAt: '2026-08-01T00:00:00Z' }
const INPUT = { enrollmentId: 31, stepIndex: 1, sequenceName: 'Expired Recovery (auto)', person: { id: 56921, fub_legacy_id: null, name: 'Pat Owner' }, now: NOW }

beforeEach(() => {
  for (const fn of Object.values(h)) fn.mockReset()
  h.getRecoveryProspectsForPerson.mockResolvedValue([HOME])
  h.verifyNotRelisted.mockResolvedValue(CLEAR)
  h.countTimelineNotesWithKeyPrefix.mockResolvedValue(0)
})

describe('recoveryKindFor', () => {
  const none = new Map<number, 'expired' | 'fsbo'>()
  it('the recovery masters by plan id', () => {
    expect(recoveryKindFor({ id: 3, fub_legacy_plan_id: 71 }, { tags: [] }, none)).toBe('expired')
    expect(recoveryKindFor({ id: 4, fub_legacy_plan_id: 72 }, { tags: [] }, none)).toBe('fsbo')
  })
  it('a sequence the intent-tag rules enroll into', () => {
    expect(recoveryKindFor({ id: 9, fub_legacy_plan_id: null }, { tags: [] }, new Map([[9, 'fsbo' as const]]))).toBe('fsbo')
  })
  it('any workflow of an owner we found through their listing', () => {
    expect(recoveryKindFor({ id: 1, fub_legacy_plan_id: 69 }, { tags: ['audience:seller', 'intent:expired-listing'] }, none)).toBe('expired')
  })
  it('not a buyer or an inbound seller', () => {
    expect(recoveryKindFor({ id: 2, fub_legacy_plan_id: 70 }, { tags: ['audience:buyer'] }, none)).toBeNull()
    expect(recoveryKindFor({ id: 1, fub_legacy_plan_id: 69 }, { tags: ['audience:seller', 'source:seller-lp'] }, none)).toBeNull()
  })
})

describe('decideRecoveryTouch', () => {
  it('sends when every linked home is clear, checking each with its own off-market day and ZIP', async () => {
    h.getRecoveryProspectsForPerson.mockResolvedValue([HOME, SECOND])
    const out = await decideRecoveryTouch(INPUT)
    expect(out).toEqual({ action: 'send', checked: 2 })
    expect(h.verifyNotRelisted).toHaveBeenCalledWith('expired', {
      street_address: '20873 Greenmont',
      city: 'Bend',
      postal_code: '97702',
      expiryComparator: '2026-07-05T05:00:00Z',
      listing_key: 'OLD',
      fsbo_url: null,
    })
    expect(h.verifyNotRelisted).toHaveBeenCalledWith('fsbo', expect.objectContaining({ listing_key: null, fsbo_url: 'https://fsbo.example/7' }))
  })

  it('stops when any linked home is listed, naming status, date and listing', async () => {
    h.getRecoveryProspectsForPerson.mockResolvedValue([SECOND, HOME])
    h.verifyNotRelisted.mockResolvedValueOnce(CLEAR).mockResolvedValueOnce({
      ...CLEAR,
      relisted: true,
      reason: 'Spark: 20873 Greenmont, Bend is Active since 2026-07-06 (listing NEW)',
      blockedStatus: 'Active',
      blockedKey: 'NEW',
      blockedDate: '2026-07-06',
      source: 'mls',
    })
    const out = await decideRecoveryTouch(INPUT)
    expect(out).toMatchObject({
      action: 'stop',
      title: 'Workflow "Expired Recovery (auto)" stopped: 20873 Greenmont, Bend is Active on the MLS since 2026-07-06',
    })
    if (out.action === 'stop') expect(out.body).toContain('Listing NEW.')
  })

  it('says sold for a sale', async () => {
    h.verifyNotRelisted.mockResolvedValue({ ...CLEAR, relisted: true, reason: 'Spark: listing OLD is Closed (closed 2026-09-12)', blockedStatus: 'Closed', blockedKey: 'OLD', blockedDate: '2026-09-12', source: 'mls' })
    const out = await decideRecoveryTouch(INPUT)
    expect(out).toMatchObject({ action: 'stop', title: expect.stringContaining('is sold on the MLS since 2026-09-12') })
  })

  it('pauses when no home is linked (never sends blind)', async () => {
    h.getRecoveryProspectsForPerson.mockResolvedValue([])
    const out = await decideRecoveryTouch(INPUT)
    expect(out).toMatchObject({ action: 'pause', alert: null })
    expect(h.verifyNotRelisted).not.toHaveBeenCalled()
  })

  it('holds 30 minutes, uncounted, when the MLS or our table could not answer at all', async () => {
    h.verifyNotRelisted.mockResolvedValue({ ...CLEAR, verifyFailed: true, failureScope: 'global', reason: 'Spark by-key read timed out after 8000 ms' })
    const out = await decideRecoveryTouch(INPUT)
    expect(out).toMatchObject({ action: 'hold', dedupeKey: 'seq-relist-hold:e31:s1', retryAt: new Date(NOW.getTime() + 30 * 60_000) })
    expect(h.countTimelineNotesWithKeyPrefix).not.toHaveBeenCalled()
  })

  it('holds when the linked records cannot be read, or the check throws', async () => {
    h.getRecoveryProspectsForPerson.mockRejectedValue(new Error('expired_listings read failed: timeout'))
    expect(await decideRecoveryTouch(INPUT)).toMatchObject({ action: 'hold' })
    h.getRecoveryProspectsForPerson.mockResolvedValue([HOME])
    h.verifyNotRelisted.mockRejectedValue(new Error('boom'))
    expect(await decideRecoveryTouch(INPUT)).toMatchObject({ action: 'hold' })
  })

  it('an address the check cannot answer: holds an hour, counted, then pauses and texts Matt on the third', async () => {
    h.verifyNotRelisted.mockResolvedValue({ ...CLEAR, verifyFailed: true, failureScope: 'row', reason: 'nothing to ask the MLS: no listing key and no street number on the record' })
    h.countTimelineNotesWithKeyPrefix.mockResolvedValue(0)
    expect(await decideRecoveryTouch(INPUT)).toMatchObject({
      action: 'hold',
      dedupeKey: 'seq-relist-unverified:e31:s1:1',
      retryAt: new Date(NOW.getTime() + SEQ_RELIST_ROW_RETRY_MS),
    })
    expect(h.countTimelineNotesWithKeyPrefix).toHaveBeenCalledWith(56921, 'seq-relist-unverified:e31:s1:')
    h.countTimelineNotesWithKeyPrefix.mockResolvedValue(1)
    expect(await decideRecoveryTouch(INPUT)).toMatchObject({ action: 'hold', dedupeKey: 'seq-relist-unverified:e31:s1:2' })
    h.countTimelineNotesWithKeyPrefix.mockResolvedValue(SEQ_RELIST_MAX_ROW_FAILURES - 1)
    const out = await decideRecoveryTouch(INPUT)
    expect(out).toMatchObject({ action: 'pause' })
    if (out.action === 'pause') {
      expect(out.alert?.key).toBe('seq-relist-e31')
      expect(out.alert?.body).toMatch(/Pat Owner paused: the MLS relist check could not answer for 20873 Greenmont, Bend 3 times/)
      expect(out.alert?.body).toMatch(/Nothing was sent/)
    }
  })

  it('a global failure on one home outranks a row failure on another', async () => {
    h.getRecoveryProspectsForPerson.mockResolvedValue([HOME, SECOND])
    h.verifyNotRelisted
      .mockResolvedValueOnce({ ...CLEAR, verifyFailed: true, failureScope: 'row', reason: 'overflow' })
      .mockResolvedValueOnce({ ...CLEAR, verifyFailed: true, failureScope: 'global', reason: '429' })
    expect(await decideRecoveryTouch(INPUT)).toMatchObject({ action: 'hold', dedupeKey: 'seq-relist-hold:e31:s1' })
  })
})

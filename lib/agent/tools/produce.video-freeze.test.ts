/**
 * The SMS APPROVE of a video job under the video freeze (Matt 2026-10-14):
 * the broker gets one plain sentence, never the internal freeze message with
 * its doc path. Other refusals keep their wording.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VIDEO_FREEZE_MESSAGE } from '@/lib/content/video-freeze'
import type { AgentContext } from '@/lib/agent/types'
import type { BrokerJobRow } from '@/lib/data/agent/actions'

const data = vi.hoisted(() => ({
  jobs: [] as unknown[],
  approve: vi.fn(),
}))

vi.mock('@/lib/data/agent/actions', () => ({
  createActionRow: vi.fn(),
  listBrokerJobs: vi.fn(async () => data.jobs),
  getActionForBroker: vi.fn(async () => null),
  appendChangeRequest: vi.fn(),
  approveAction: data.approve,
  unapproveAction: vi.fn(),
}))
vi.mock('@/lib/agent/listing-state', () => ({ inferListingState: vi.fn() }))
vi.mock('@/lib/data/cma/builderReads', () => ({
  findCmaSubjectByMls: vi.fn(),
  findCmaSubjectByAddress: vi.fn(),
}))

import { produceTools, VIDEO_FROZEN_SMS } from './produce'

const ctx: AgentContext = {
  brokerSlug: 'paul',
  brokerEmail: 'paul@ryan-realty.com',
  brokerDisplayName: 'Paul',
  sessionId: 'session-1',
  brokerCell: '+15415550100',
}

const readyVideoJob: BrokerJobRow = {
  id: '7354d227-b304-4753-88b0-7a22c6592753',
  actionType: 'content:imagine_listing',
  target: 'mls:220189422',
  status: 'ready',
  assignedProducer: 'lib/social/imagine-produce',
  generationReason: null,
  payload: {},
  executorResponse: { media_type: 'video' },
  assignedApprover: 'paul',
  createdAt: '2026-10-14T00:00:00Z',
}

async function textApprove() {
  const tool = produceTools(ctx).find((t) => t.name === 'approve_action')
  if (!tool) throw new Error('approve_action tool is missing')
  return (await tool.handler({}, ctx)) as { result: { ok: boolean; message: string } }
}

beforeEach(() => {
  data.jobs = [readyVideoJob]
  data.approve.mockReset()
})

describe('approve_action under the video freeze', () => {
  it('texts a plain line, with no doc path, when the job is video', async () => {
    data.approve.mockResolvedValue({ ok: false, error: VIDEO_FREEZE_MESSAGE, reason: 'video_frozen' })
    const { result } = await textApprove()
    expect(result).toEqual({ ok: false, message: 'Video posts are paused while the new video process is set up. Nothing was posted.' })
    expect(VIDEO_FROZEN_SMS).toBe(result.message)
    expect(result.message).not.toMatch(/docs\/|\.md|certificate/)
  })

  it('keeps the other refusals as they were', async () => {
    data.approve.mockResolvedValue({ ok: false, error: 'connection reset', reason: 'db_error' })
    expect((await textApprove()).result.message).toBe("Couldn't approve that: connection reset")
  })
})

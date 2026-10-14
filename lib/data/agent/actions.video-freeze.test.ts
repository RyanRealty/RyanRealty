/**
 * approveAction under the video freeze (Matt 2026-10-14). approveAction is the
 * stamp behind the broker SMS APPROVE, the approval-queue server action and
 * Today's Yes, so a row that would post video, or whose media cannot be
 * classified, is refused there. Image posts and rows that post nothing (a
 * CMA) are still approved.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { called, fakeSupabase, type Chain } from '@/test/fake-supabase-chain'
import { VIDEO_FREEZE_MESSAGE } from '@/lib/content/video-freeze'

const state = vi.hoisted(() => ({ row: null as Record<string, unknown> | null, client: null as unknown }))

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => state.client }))

import { approveAction, readActionMediaFacts } from './actions'

let chains: Chain[] = []

beforeEach(() => {
  const fake = fakeSupabase((chain) => {
    if (called(chain, 'update')) return { data: [{ id: 'a1' }], error: null }
    return { data: state.row ? [state.row] : [], error: null }
  })
  state.client = fake.client
  chains = fake.chains
})

const updates = () => chains.filter((c) => called(c, 'update'))

describe('approveAction under the video freeze', () => {
  it('refuses an Imagine listing reel with reason video_frozen and writes nothing', async () => {
    state.row = {
      id: 'a1',
      action_type: 'content:imagine_listing',
      format: 'imagine_listing',
      executor_response: { media_type: 'video', publish_payload: { mediaType: 'reel', mediaUrl: 'https://cdn.test/a1/clip.mp4' } },
    }
    const result = await approveAction('a1', { approvedBy: 'matt@ryan-realty.com' })
    expect(result).toEqual({ ok: false, error: VIDEO_FREEZE_MESSAGE, reason: 'video_frozen' })
    expect(updates()).toHaveLength(0)
  })

  it('fails closed on a publish payload with no media type and no file extension', async () => {
    state.row = {
      id: 'a1',
      action_type: 'content:ig_post',
      format: 'ig_post',
      executor_response: { publish_payload: { mediaUrl: 'https://cdn.test/a1/asset' } },
    }
    const result = await approveAction('a1', { approvedBy: 'matt@ryan-realty.com' })
    expect(result).toMatchObject({ ok: false, reason: 'video_frozen' })
    expect(updates()).toHaveLength(0)
  })

  it('still approves an image post', async () => {
    state.row = {
      id: 'a1',
      action_type: 'content:imagine_gbp',
      format: 'imagine_gbp',
      executor_response: { media_type: 'image', publish_payload: { mediaType: 'image', mediaUrl: 'https://cdn.test/a1/still.jpg' } },
    }
    const result = await approveAction('a1', { approvedBy: 'matt@ryan-realty.com' })
    expect(result).toEqual({ ok: true })
    expect(updates()).toHaveLength(1)
  })

  it('still approves a row that posts nothing (a CMA)', async () => {
    state.row = { id: 'a1', action_type: 'content:cma', format: 'cma', executor_response: null }
    const result = await approveAction('a1', { approvedBy: 'matt@ryan-realty.com' })
    expect(result).toEqual({ ok: true })
    expect(updates()).toHaveLength(1)
  })

  it('readActionMediaFacts asks only for the ids given, deduplicated', async () => {
    state.row = null
    const result = await readActionMediaFacts(['a1', ' a1 ', '', 'a2'])
    expect(result).toEqual({ ok: true, rows: [] })
    const inCall = chains[0].calls.find((c) => c.method === 'in')
    expect(inCall?.args).toEqual(['id', ['a1', 'a2']])
  })
})

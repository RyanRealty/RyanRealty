/**
 * approveStudioDraft under the video freeze (Matt 2026-10-14): a video draft,
 * or one whose media cannot be classified, is never stamped approved, so
 * publisher-sweep never sees it. An image draft is still approved.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { called, fakeSupabase, type Chain } from '@/test/fake-supabase-chain'
import { VIDEO_FREEZE_MESSAGE } from '@/lib/content/video-freeze'

const state = vi.hoisted(() => ({ row: null as Record<string, unknown> | null, client: null as unknown }))

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => state.client }))

import { approveStudioDraft } from './drafts'

const citations = [{ figure: '412', source: 'Supabase', table: 'market_pulse_live' }]

function studioRow(media: { kind?: string; url: string; mediaType?: string }, action_type = 'place_map') {
  return {
    action_type,
    format: action_type,
    status: 'ready',
    payload: { humanApprovedAt: null },
    executor_response: {
      citations,
      media: { kind: media.kind, url: media.url },
      publish_payload: { approved: true, mediaType: media.mediaType, mediaUrl: media.url, platforms: ['instagram'] },
    },
  }
}

let chains: Chain[] = []

beforeEach(() => {
  const fake = fakeSupabase((chain) => {
    if (called(chain, 'update')) return { data: [{ id: 'd1' }], error: null }
    return { data: state.row, error: null }
  })
  state.client = fake.client
  chains = fake.chains
})

const updates = () => chains.filter((c) => called(c, 'update'))

describe('approveStudioDraft under the video freeze', () => {
  it('refuses a video draft and writes nothing', async () => {
    state.row = studioRow({ kind: 'video', url: 'https://cdn.test/studio/d1/final.mp4', mediaType: 'reel' })
    const result = await approveStudioDraft({ id: 'd1', approvedBy: 'matt' })
    expect(result).toEqual({ ok: false, error: VIDEO_FREEZE_MESSAGE })
    expect(updates()).toHaveLength(0)
  })

  it('fails closed: a draft whose media cannot be classified is refused', async () => {
    state.row = studioRow({ url: 'https://cdn.test/studio/d1/asset' }, 'answer_room')
    const result = await approveStudioDraft({ id: 'd1', approvedBy: 'matt' })
    expect(result).toEqual({ ok: false, error: VIDEO_FREEZE_MESSAGE })
    expect(updates()).toHaveLength(0)
  })

  it('still approves an image draft', async () => {
    state.row = studioRow(
      { kind: 'image', url: 'https://cdn.test/studio/d2/hero.jpg', mediaType: 'image' },
      'trend_reactive',
    )
    const result = await approveStudioDraft({ id: 'd2', approvedBy: 'matt' })
    expect(result).toEqual({ ok: true })
    expect(updates()).toHaveLength(1)
    const patch = updates()[0].calls.find((c) => c.method === 'update')?.args[0] as Record<string, unknown>
    expect(patch.status).toBe('approved')
  })
})

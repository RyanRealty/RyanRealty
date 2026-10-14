/**
 * publisher-sweep under the video freeze (Matt 2026-10-14): an approved video
 * row, or one whose media cannot be classified, is held and logged and never
 * POSTed to /api/social/publish; the image row behind it still posts, and
 * held rows do not use up maxRows.
 */
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { argOf, called, fakeSupabase, type Chain } from '@/test/fake-supabase-chain'
import { VIDEO_FREEZE_MESSAGE } from '@/lib/content/video-freeze'

type Row = { id: string; action_type: string; executor_response: Record<string, unknown> | null; failure_log: unknown }

const state = vi.hoisted(() => ({ rows: [] as Row[], client: null as unknown }))

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => state.client }))
vi.mock('@/lib/auth/cron-auth', () => ({ requireCronAuth: () => null }))
vi.mock('@/lib/site-origin', () => ({ configuredSiteOrigin: () => 'https://ryan-realty.com' }))

import { GET } from './route'

const videoRow = (id: string): Row => ({
  id,
  action_type: 'place_map',
  failure_log: [],
  executor_response: {
    citations: [{ figure: '1' }],
    media: { kind: 'video', url: `https://cdn.test/studio/${id}/final.mp4` },
    publish_payload: { approved: true, platforms: ['instagram'], mediaType: 'reel', mediaUrl: `https://cdn.test/studio/${id}/final.mp4` },
  },
})
const IMAGE: Row = {
  id: 'image-1',
  action_type: 'trend_reactive',
  failure_log: [],
  executor_response: {
    citations: [{ figure: '1' }],
    media: { kind: 'image', url: 'https://cdn.test/studio/image-1/hero.jpg' },
    publish_payload: { approved: true, platforms: ['instagram'], mediaType: 'image', mediaUrl: 'https://cdn.test/studio/image-1/hero.jpg' },
  },
}
const UNKNOWN: Row = {
  id: 'unknown-1',
  action_type: 'content:ig_post',
  failure_log: [],
  executor_response: { publish_payload: { approved: true, platforms: ['instagram'], mediaUrl: 'https://cdn.test/u/asset' } },
}

let chains: Chain[] = []
const fetchMock = vi.fn()

beforeEach(() => {
  const fake = fakeSupabase((chain) => {
    if (chain.table === 'marketing_brain_actions' && called(chain, 'update')) {
      const id = chain.calls.find((c) => c.method === 'eq' && c.args[0] === 'id')?.args[1]
      return { data: [{ id }], error: null }
    }
    if (chain.table === 'marketing_brain_actions') return { data: state.rows, error: null }
    return { data: null, error: null }
  })
  state.client = fake.client
  chains = fake.chains
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () =>
    new Response(JSON.stringify({ success: true, results: { instagram: { success: true, externalPostId: 'ig-1' } } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function sweep(query = '') {
  return GET(new NextRequest(`https://ryan-realty.com/api/cron/publisher-sweep${query}`))
}

const postedIds = () =>
  fetchMock.mock.calls.map((call) => (JSON.parse(String((call[1] as RequestInit).body)) as { approvalRef: { actionId: string } }).approvalRef.actionId)

describe('publisher-sweep under the video freeze', () => {
  it('holds the video and the unknown-media rows and still posts the image row', async () => {
    state.rows = [videoRow('video-1'), UNKNOWN, IMAGE]
    const res = await sweep()
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(postedIds()).toEqual(['image-1'])
    expect(json.published_count).toBe(1)
    expect(json.video_frozen_count).toBe(2)
    expect(json.video_frozen).toEqual([
      { action_id: 'video-1', action_type: 'place_map', reason: VIDEO_FREEZE_MESSAGE },
      { action_id: 'unknown-1', action_type: 'content:ig_post', reason: VIDEO_FREEZE_MESSAGE },
    ])
    // Held rows are left as they were: the only row moved to executed is the image.
    const executed = chains.filter((c) => called(c, 'update'))
    expect(executed).toHaveLength(1)
    expect(executed[0].calls.find((c) => c.method === 'eq' && c.args[0] === 'id')?.args[1]).toBe('image-1')
  })

  it('held rows do not use up maxRows, so they cannot starve an image post', async () => {
    state.rows = [videoRow('v1'), videoRow('v2'), videoRow('v3'), IMAGE]
    const json = await (await sweep('?maxRows=1')).json()
    expect(postedIds()).toEqual(['image-1'])
    expect(json.rows_processed).toBe(1)
    expect(json.video_frozen_count).toBe(3)
  })

  it('a dry run marks which candidates are held', async () => {
    state.rows = [videoRow('video-1'), IMAGE]
    const json = await (await sweep('?dryRun=true')).json()
    expect(json.candidates).toEqual([
      { id: 'video-1', action_type: 'place_map', has_publish_payload: true, video_frozen: true },
      { id: 'image-1', action_type: 'trend_reactive', has_publish_payload: true, video_frozen: false },
    ])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

/**
 * A row that carries no media at all (prod has ops:meta_budget,
 * analyze:metric_decomposition and ops:fub_tag_fix rows like this at ready)
 * is not video. Approved, it must behave exactly as before the freeze: POSTed,
 * refused by the publish route, failure-logged, and killed after two retries.
 * It is never held as "video frozen".
 */
describe('publisher-sweep: an approved row with no media behaves as before the freeze', () => {
  const opsRow = (failures: number): Row => ({
    id: 'afc3a9b6-8e97-4d5e-8915-9e8e013829b2',
    action_type: 'ops:meta_budget',
    failure_log: Array.from({ length: failures }, (_, i) => ({ phase: 'publish', error: 'HTTP 400', at: `2026-10-1${i}T00:00:00Z` })),
    executor_response: { publish_payload: { status: 'killed', platforms: [], action_type: 'ops:meta_budget' } },
  })

  beforeEach(() => {
    // What the publish route answers a payload with no media.
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ error: 'Publish blocked: approved must be true' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    )
  })

  it('is POSTed, refused, and failure-logged, not held', async () => {
    state.rows = [opsRow(0)]
    const json = await (await sweep()).json()
    expect(postedIds()).toEqual(['afc3a9b6-8e97-4d5e-8915-9e8e013829b2'])
    expect(json.video_frozen_count).toBe(0)
    expect(json.errors).toEqual([
      { action_id: 'afc3a9b6-8e97-4d5e-8915-9e8e013829b2', phase: 'publish', error: 'Publish blocked: approved must be true' },
    ])
    // recordPublishFailure: the failure_log update and the failures-table row.
    const failureLog = chains.find((c) => c.table === 'marketing_brain_actions' && called(c, 'update'))
    expect(Object.keys(argOf(failureLog as Chain, 'update') as Record<string, unknown>)).toEqual(['failure_log'])
    expect(chains.some((c) => c.table === 'producer_execution_failures' && called(c, 'insert'))).toBe(true)
  })

  it('is killed after two failed retries, without another POST', async () => {
    state.rows = [opsRow(2)]
    const json = await (await sweep()).json()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(json.video_frozen_count).toBe(0)
    expect(json.errors).toEqual([
      { action_id: 'afc3a9b6-8e97-4d5e-8915-9e8e013829b2', phase: 'publish', error: 'killed after max retries' },
    ])
    const kill = chains.find((c) => c.table === 'marketing_brain_actions' && called(c, 'update'))
    expect(argOf(kill as Chain, 'update')).toMatchObject({ status: 'killed' })
  })

  it('a dry run does not mark it held', async () => {
    state.rows = [opsRow(0)]
    const json = await (await sweep('?dryRun=true')).json()
    expect(json.candidates[0]).toMatchObject({ id: 'afc3a9b6-8e97-4d5e-8915-9e8e013829b2', video_frozen: false })
  })
})

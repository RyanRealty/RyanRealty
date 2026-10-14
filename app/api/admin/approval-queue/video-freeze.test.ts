/**
 * The approval-queue approve routes under the video freeze (Matt 2026-10-14):
 * a row that would post video is refused 423 Locked, single or bulk, and an
 * image post is still approved. In a mixed bulk selection only the image rows
 * are stamped; the held video ids come back as `frozen`.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { argOf, called, fakeSupabase, type Chain } from '@/test/fake-supabase-chain'
import { VIDEO_FREEZE_MESSAGE } from '@/lib/content/video-freeze'

type Row = { id: string; action_type: string; format: string; executor_response: Record<string, unknown> | null }

const state = vi.hoisted(() => ({ rows: [] as Row[], client: null as unknown }))

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => state.client }))
vi.mock('@/lib/admin/require-admin', () => ({
  requireAdminRoute: vi.fn(async () => ({ email: 'matt@ryan-realty.com', role: 'superuser' })),
}))
vi.mock('@/app/actions/log-admin-action', () => ({ logAdminAction: vi.fn(async () => ({ ok: true })) }))

import { POST as single } from './[id]/action/route'
import { POST as bulk } from './bulk-action/route'

const VIDEO: Row = {
  id: '11111111-1111-1111-1111-111111111111',
  action_type: 'place_map',
  format: 'place_map',
  executor_response: {
    media: { kind: 'video', url: 'https://cdn.test/studio/v/final.mp4' },
    publish_payload: { mediaType: 'reel', mediaUrl: 'https://cdn.test/studio/v/final.mp4' },
  },
}
const IMAGE: Row = {
  id: '22222222-2222-2222-2222-222222222222',
  action_type: 'content:imagine_gbp',
  format: 'imagine_gbp',
  executor_response: { media_type: 'image', publish_payload: { mediaType: 'image', mediaUrl: 'https://cdn.test/g/still.jpg' } },
}
const UNKNOWN: Row = {
  id: '33333333-3333-3333-3333-333333333333',
  action_type: 'content:ig_post',
  format: 'ig_post',
  executor_response: { publish_payload: { mediaUrl: 'https://cdn.test/u/asset' } },
}

let chains: Chain[] = []

beforeEach(() => {
  state.rows = [VIDEO, IMAGE, UNKNOWN]
  const fake = fakeSupabase((chain) => {
    const idFilter = chain.calls.find((c) => c.method === 'in' && c.args[0] === 'id')?.args[1] as string[] | undefined
    const eqId = chain.calls.find((c) => c.method === 'eq' && c.args[0] === 'id')?.args[1] as string | undefined
    const ids = idFilter ?? (eqId ? [eqId] : [])
    const hit = state.rows.filter((r) => ids.includes(r.id))
    if (called(chain, 'update')) return { data: hit.map((r) => ({ id: r.id })), error: null }
    return { data: hit, error: null }
  })
  state.client = fake.client
  chains = fake.chains
})

const updates = () => chains.filter((c) => called(c, 'update'))

function post(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

async function approveOne(row: Row, action: Record<string, unknown> = { action: 'approve_now' }) {
  return single(post(`https://ryan-realty.com/api/admin/approval-queue/${row.id}/action`, action), {
    params: Promise.resolve({ id: row.id }),
  })
}

describe('POST /api/admin/approval-queue/[id]/action under the video freeze', () => {
  it('approve_now refuses a video row, 423, and writes nothing', async () => {
    const res = await approveOne(VIDEO)
    expect(res.status).toBe(423)
    expect((await res.json()).error).toBe(VIDEO_FREEZE_MESSAGE)
    expect(updates()).toHaveLength(0)
  })

  it('approve_schedule refuses a video row too', async () => {
    const res = await approveOne(VIDEO, { action: 'approve_schedule', scheduled_for: '2026-10-20T16:03:00Z' })
    expect(res.status).toBe(423)
    expect(updates()).toHaveLength(0)
  })

  it('fails closed on a row whose media cannot be classified', async () => {
    const res = await approveOne(UNKNOWN)
    expect(res.status).toBe(423)
    expect(updates()).toHaveLength(0)
  })

  it('still approves an image row', async () => {
    const res = await approveOne(IMAGE)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, status: 'approved' })
    expect(updates()).toHaveLength(1)
    expect((argOf(updates()[0], 'update') as Record<string, unknown>).status).toBe('approved')
  })
})

describe('POST /api/admin/approval-queue/bulk-action under the video freeze', () => {
  const url = 'https://ryan-realty.com/api/admin/approval-queue/bulk-action'

  it('stamps only the image rows of a mixed selection and names the held ones', async () => {
    const res = await bulk(post(url, { action: 'approve_now', ids: [VIDEO.id, IMAGE.id, UNKNOWN.id] }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.affected).toBe(1)
    expect(json.frozen).toEqual([VIDEO.id, UNKNOWN.id])
    expect(json.notice).toBe(VIDEO_FREEZE_MESSAGE)
    expect(updates()).toHaveLength(1)
    const idScope = updates()[0].calls.find((c) => c.method === 'in' && c.args[0] === 'id')
    expect(idScope?.args[1]).toEqual([IMAGE.id])
    // The status scope ci:bulk-approval-wired holds is still on the write.
    expect(updates()[0].calls.some((c) => c.method === 'in' && c.args[0] === 'status')).toBe(true)
  })

  it('refuses an all-video selection, 423, and writes nothing', async () => {
    const res = await bulk(post(url, { action: 'approve_now', ids: [VIDEO.id, UNKNOWN.id] }))
    expect(res.status).toBe(423)
    expect((await res.json()).error).toBe(VIDEO_FREEZE_MESSAGE)
    expect(updates()).toHaveLength(0)
  })

  it('bulk reject is untouched by the freeze', async () => {
    const res = await bulk(post(url, { action: 'reject', ids: [VIDEO.id], killed_reason: 'no' }))
    expect(res.status).toBe(200)
    expect((argOf(updates()[0], 'update') as Record<string, unknown>).status).toBe('killed')
  })
})

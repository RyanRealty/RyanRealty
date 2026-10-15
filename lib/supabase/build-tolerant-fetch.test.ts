import { describe, expect, it, vi } from 'vitest'
import { BUILD_FETCH_RETRY_DELAYS_MS, createBuildTolerantFetch } from '@/lib/supabase/build-tolerant-fetch'

const URL_WITH_FILTERS =
  'https://example.supabase.co/rest/v1/market_metric?select=geo_slug&geo_type=eq.neighborhood&geo_slug=in.(tetherow)'

const PGRST002 = JSON.stringify({
  code: 'PGRST002',
  details: null,
  hint: null,
  message: 'Could not query the database for the schema cache. Retrying.',
})

/** Answers in order; the last answer repeats. */
function answers(...queue: Array<Response | Error>) {
  let i = 0
  return vi.fn(async () => {
    const next = queue[Math.min(i, queue.length - 1)]!
    i += 1
    if (next instanceof Error) throw next
    return next.clone()
  })
}

function harness(fetchImpl: ReturnType<typeof answers>, inBuild = true) {
  const sleeps: number[] = []
  const lines: string[] = []
  const tolerant = createBuildTolerantFetch({
    fetch: fetchImpl as unknown as typeof fetch,
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    inBuild: () => inBuild,
    log: (line) => lines.push(line),
  })
  return { tolerant, sleeps, lines }
}

describe('build-tolerant fetch', () => {
  it('waits out a schema-cache reload during the build and hands back the real answer', async () => {
    // 0a9c47645, /housing-market/sisters, 00:03:31Z: getMetrics threw on this
    // 503 and took the deploy with it.
    const f = answers(new Response(PGRST002, { status: 503 }), new Response(PGRST002, { status: 503 }), new Response('[{"geo_slug":"tetherow"}]', { status: 200 }))
    const { tolerant, sleeps, lines } = harness(f)
    const res = await tolerant(URL_WITH_FILTERS)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ geo_slug: 'tetherow' }])
    expect(f).toHaveBeenCalledTimes(3)
    expect(sleeps).toEqual([1_000, 2_000])
    // The path, never the filters.
    expect(lines[0]).toBe(
      '[build-tolerant-fetch] /rest/v1/market_metric: PGRST002, PostgREST schema cache unavailable; retry 1 of 5 in 1000 ms',
    )
    expect(lines.join(' ')).not.toContain('tetherow')
  })

  it('retries a PGRST002 POST too: PostgREST refused it before running anything', async () => {
    const f = answers(new Response(PGRST002, { status: 503 }), new Response('{}', { status: 200 }))
    const { tolerant } = harness(f)
    const res = await tolerant('https://example.supabase.co/rest/v1/rpc/boundary_geojson', { method: 'POST', body: '{}' })
    expect(res.status).toBe(200)
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('gives up after 30 s of waits and hands back the last answer, as before', async () => {
    const f = answers(new Response(PGRST002, { status: 503 }))
    const { tolerant, sleeps } = harness(f)
    const res = await tolerant(URL_WITH_FILTERS)
    expect(res.status).toBe(503)
    expect(await res.text()).toContain('PGRST002')
    expect(f).toHaveBeenCalledTimes(BUILD_FETCH_RETRY_DELAYS_MS.length + 1)
    expect(sleeps.reduce((a, b) => a + b, 0)).toBe(30_000)
  })

  it('retries an origin error or a dropped connection on a read, never on a write', async () => {
    // b70e1f9ad, /housing-market/bend, 22:21Z: a Cloudflare 520 while the
    // database restarted.
    const readF = answers(new Response('<html>520</html>', { status: 520 }), new TypeError('fetch failed'), new Response('[]', { status: 200 }))
    const read = harness(readF)
    expect((await read.tolerant(URL_WITH_FILTERS)).status).toBe(200)
    expect(readF).toHaveBeenCalledTimes(3)

    const writeF = answers(new Response('<html>520</html>', { status: 520 }))
    const write = harness(writeF)
    expect((await write.tolerant('https://example.supabase.co/rest/v1/visitor_events', { method: 'POST', body: '{}' })).status).toBe(520)
    expect(writeF).toHaveBeenCalledTimes(1)

    const thrownF = answers(new TypeError('fetch failed'))
    const thrown = harness(thrownF)
    await expect(thrown.tolerant('https://example.supabase.co/rest/v1/visitor_events', { method: 'POST', body: '{}' })).rejects.toThrow('fetch failed')
    expect(thrownF).toHaveBeenCalledTimes(1)
  })

  it('does not retry the database answering: a pool timeout, a statement timeout, a 4xx, a plain 503', async () => {
    for (const res of [
      new Response('{"code":"PGRST003","message":"Timed out acquiring connection from connection pool."}', { status: 504 }),
      new Response('{"code":"57014","message":"canceling statement due to statement timeout"}', { status: 500 }),
      new Response('{"code":"PGRST116"}', { status: 406 }),
      new Response('Service Unavailable', { status: 503 }),
    ]) {
      const f = answers(res)
      const { tolerant } = harness(f)
      expect((await tolerant(URL_WITH_FILTERS)).status).toBe(res.status)
      expect(f).toHaveBeenCalledTimes(1)
    }
  })

  it('does not retry an aborted request', async () => {
    const abort = new Error('This operation was aborted')
    abort.name = 'AbortError'
    const f = answers(abort)
    const { tolerant } = harness(f)
    await expect(tolerant(URL_WITH_FILTERS)).rejects.toThrow('aborted')
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('is the plain fetch outside the build: a runtime render never waits', async () => {
    const f = answers(new Response(PGRST002, { status: 503 }))
    const { tolerant, sleeps } = harness(f, false)
    expect((await tolerant(URL_WITH_FILTERS)).status).toBe(503)
    expect(f).toHaveBeenCalledTimes(1)
    expect(sleeps).toEqual([])
  })
})

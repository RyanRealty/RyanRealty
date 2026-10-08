import { afterEach, describe, expect, it, vi } from 'vitest'
import { installRemoteMediaProxy, MAX_FULFILL_BYTES } from '../lib/remote-media-proxy.mjs'

const PAGE = 'http://127.0.0.1:3000'

/** A context stand-in that keeps the route handler the proxy installs. */
async function proxied() {
  let handler = null
  const stats = await installRemoteMediaProxy({ route: async (_pattern, fn) => { handler = fn } }, PAGE)
  return { stats, handle: (route) => handler(route) }
}

function fakeRoute(url, resourceType) {
  const calls = { continued: 0, fulfilled: null }
  return {
    calls,
    route: {
      request: () => ({ url: () => url, resourceType: () => resourceType }),
      continue: async () => { calls.continued += 1 },
      fulfill: async (res) => { calls.fulfilled = res },
    },
  }
}

function okResponse(bytes, headers = {}) {
  const cancel = vi.fn(async () => {})
  return {
    cancel,
    response: {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/jpeg', ...headers }),
      body: { cancel },
      arrayBuffer: async () => new Uint8Array(bytes).buffer,
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('installRemoteMediaProxy', () => {
  it('serves a cross-origin photo from Node, the same bytes the CDN sent', async () => {
    const { response } = okResponse(1024)
    const fetchMock = vi.fn(async () => response)
    vi.stubGlobal('fetch', fetchMock)
    const { stats, handle } = await proxied()
    const { route, calls } = fakeRoute('https://cdn.example.com/photo-1.jpg', 'image')
    await handle(route)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(calls.fulfilled?.body.length).toBe(1024)
    expect(calls.fulfilled?.contentType).toBe('image/jpeg')
    expect(stats.served).toBe(1)
  })

  it('hands a video back to the browser without fetching it (a 79 MB reel closed Chromium, 2026-10-03)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { stats, handle } = await proxied()
    const { route, calls } = fakeRoute('https://s3.example.com/renders/out.mp4', 'media')
    await handle(route)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(calls.continued).toBe(1)
    expect(calls.fulfilled).toBeNull()
    expect(stats.served).toBe(0)
  })

  it('hands a body declared over the limit back to the browser and stops reading it', async () => {
    const { response, cancel } = okResponse(0, { 'content-length': String(MAX_FULFILL_BYTES + 1) })
    vi.stubGlobal('fetch', vi.fn(async () => response))
    const { handle } = await proxied()
    const { route, calls } = fakeRoute('https://cdn.example.com/huge-declared.jpg', 'image')
    await handle(route)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(calls.continued).toBe(1)
    expect(calls.fulfilled).toBeNull()
  })

  it('hands a body that turns out over the limit back to the browser when no length was declared', async () => {
    const { response } = okResponse(MAX_FULFILL_BYTES + 1)
    vi.stubGlobal('fetch', vi.fn(async () => response))
    const { handle } = await proxied()
    const { route, calls } = fakeRoute('https://cdn.example.com/huge-undeclared.jpg', 'image')
    await handle(route)
    expect(calls.continued).toBe(1)
    expect(calls.fulfilled).toBeNull()
  })

  it('leaves a same-origin request alone', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { handle } = await proxied()
    const { route, calls } = fakeRoute(`${PAGE}/_next/image?url=x`, 'image')
    await handle(route)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(calls.continued).toBe(1)
  })
})

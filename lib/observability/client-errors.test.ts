import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { captureInBrowser } = vi.hoisted(() => ({ captureInBrowser: vi.fn() }))
vi.mock('./sentry-browser', () => ({ captureInBrowser }))

describe('reportClientError', () => {
  beforeEach(() => {
    vi.resetModules()
    captureInBrowser.mockClear()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('never loads the SDK when no DSN is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '')
    const { reportClientError } = await import('./client-errors')
    reportClientError(new Error('dropped'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(captureInBrowser).not.toHaveBeenCalled()
  })

  it('loads the SDK on the first error and reports every error in order', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://key@o1.ingest.us.sentry.io/1')
    const { reportClientError } = await import('./client-errors')
    const first = new Error('first')
    const second = new Error('second')
    reportClientError(first)
    reportClientError(second)
    await vi.waitFor(() => expect(captureInBrowser).toHaveBeenCalledTimes(2))
    expect(captureInBrowser).toHaveBeenNthCalledWith(1, first)
    expect(captureInBrowser).toHaveBeenNthCalledWith(2, second)
  })
})

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const WORKER_SRC = readFileSync(new URL('./worker.ts', import.meta.url), 'utf8')

describe('cma worker Cursor transport for expired Auto-CMA', () => {
  it('forces runWithGrokTransportAsync(cursor) when requestSource is expired-listing-cron', () => {
    expect(WORKER_SRC).toMatch(/runWithGrokTransportAsync/)
    expect(WORKER_SRC).toMatch(/expired-listing-cron/)
    expect(WORKER_SRC).toMatch(
      /requestSource === 'expired-listing-cron'[\s\S]*runWithGrokTransportAsync\('cursor'/,
    )
  })

  it('documents that manual admin rebuilds keep default xAI transport', () => {
    expect(WORKER_SRC).toMatch(/Manual \/admin\/cmas rebuilds keep default xAI/)
  })
})

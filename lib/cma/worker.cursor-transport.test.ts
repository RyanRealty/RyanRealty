import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { cmaBuildGrokTransport, EXPIRED_AUTO_CMA_SOURCE } from './build-transport'

const WORKER_SRC = readFileSync(new URL('./worker.ts', import.meta.url), 'utf8')

const present = () => true
const absent = () => false

describe('cmaBuildGrokTransport: which bill pays for the judge and audit', () => {
  it('uses the Cursor subscription for the expired Auto-CMA build when cursor-agent is installed', () => {
    expect(cmaBuildGrokTransport(EXPIRED_AUTO_CMA_SOURCE, present)).toBe('cursor')
  })

  // The 2026-09-29 defect: Vercel has no cursor-agent, so forcing Cursor there
  // made grokConfigured() false and skipped the judge and audit on every build.
  it('falls back to the default (xAI) transport when cursor-agent is not on the host', () => {
    expect(cmaBuildGrokTransport(EXPIRED_AUTO_CMA_SOURCE, absent)).toBeNull()
  })

  it('never forces a transport for manual rebuilds or any other source', () => {
    for (const source of ['brain-queue', 'seller-lp', 'admin-rebuild', '', null, undefined]) {
      expect(cmaBuildGrokTransport(source, present)).toBeNull()
      expect(cmaBuildGrokTransport(source, absent)).toBeNull()
    }
  })

  it('does not probe the host for sources that never use Cursor', () => {
    let probes = 0
    cmaBuildGrokTransport('brain-queue', () => {
      probes++
      return true
    })
    expect(probes).toBe(0)
  })
})

describe('cma worker routes every build through cmaBuildGrokTransport', () => {
  it('asks the policy instead of hard-coding a transport', () => {
    expect(WORKER_SRC).toMatch(/cmaBuildGrokTransport\(requestSource\)/)
    expect(WORKER_SRC).not.toMatch(/runWithGrokTransportAsync\(\s*'cursor'/)
    expect(WORKER_SRC).not.toMatch(/runWithGrokTransportAsync\(\s*'xai'/)
  })
})

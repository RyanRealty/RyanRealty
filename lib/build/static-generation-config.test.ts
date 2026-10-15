import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import nextConfig from '@/next.config'

/*
 * The production build's static generation runs against one Supabase
 * project. Its concurrency and its per-page attempts are set in
 * next.config.ts (2026-10-14, the reasons are there); these pin both values
 * and the Next behaviour they lean on, so a Next upgrade that renames or
 * re-means either knob fails here instead of in a production build.
 */

const WORKER_JS = readFileSync(join(process.cwd(), 'node_modules/next/dist/export/worker.js'), 'utf8')

describe('static generation against one database', () => {
  it('renders three pages at a time per export worker, not eight', () => {
    expect(nextConfig.experimental?.staticGenerationMaxConcurrency).toBe(3)
    // 7 workers on the production build machine: 21 pages in flight, not 56.
    expect(7 * (nextConfig.experimental?.staticGenerationMaxConcurrency ?? 8)).toBeLessThanOrEqual(21)
  })

  it('gives a page three attempts before it fails the build', () => {
    expect(nextConfig.experimental?.staticGenerationRetryCount).toBe(3)
  })

  it('Next still reads both knobs the way next.config.ts says it does', () => {
    // Batches of `staticGenerationMaxConcurrency` pages, default 8.
    expect(WORKER_JS).toContain('nextConfig.experimental.staticGenerationMaxConcurrency ?? 8')
    // The value is the number of attempts (maxAttempts), default 1.
    expect(WORKER_JS).toMatch(/exportPageWithRetry\(exportPath, nextConfig\.experimental\.staticGenerationRetryCount \?\? 1\)/)
    expect(WORKER_JS).toContain('while(attempt < maxAttempts)')
  })
})

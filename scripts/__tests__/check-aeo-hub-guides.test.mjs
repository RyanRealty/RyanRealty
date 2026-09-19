import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('ci:aeo-hub-guides', () => {
  it('passes on the wired tree', () => {
    const result = spawnSync(process.execPath, ['scripts/check-aeo-hub-guides.mjs'], {
      encoding: 'utf8',
    })
    expect(result.status, result.stderr || result.stdout).toBe(0)
    expect(result.stdout).toMatch(/ci:aeo-hub-guides — OK/)
  })
})

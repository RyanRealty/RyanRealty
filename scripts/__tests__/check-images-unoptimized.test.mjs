import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

describe('ci:images-unoptimized', () => {
  it('refuses next.config without images.unoptimized: true', () => {
    const out = execFileSync(process.execPath, [resolve('scripts/check-images-unoptimized.mjs')], {
      encoding: 'utf8',
      cwd: resolve('.'),
    })
    expect(out).toMatch(/OK/)
  })
})

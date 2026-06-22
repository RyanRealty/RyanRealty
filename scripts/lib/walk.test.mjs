import { describe, it, expect } from 'vitest'
import { walkFiles, DEFAULT_EXT, DEFAULT_SKIP_DIRS } from './walk.mjs'

// Shared gate file-walker (audit p3.x). Tested against the stable lib/format dir.
describe('walkFiles', () => {
  it('finds .ts/.tsx files recursively (default ext)', () => {
    const files = walkFiles('lib/format')
    expect(files).toContain('lib/format/money.ts')
    expect(files).toContain('lib/format/date.ts')
    // .test.ts also ends in .ts, so the default ext includes them
    expect(files).toContain('lib/format/money.test.ts')
    expect(files.every((f) => DEFAULT_EXT.test(f))).toBe(true)
  })
  it('honors a custom ext filter', () => {
    const onlyTests = walkFiles('lib/format', { ext: /\.test\.ts$/ })
    expect(onlyTests).toContain('lib/format/money.test.ts')
    expect(onlyTests).not.toContain('lib/format/money.ts')
  })
  it('returns [] for a non-existent directory (no throw)', () => {
    expect(walkFiles('lib/this-dir-does-not-exist-xyz')).toEqual([])
  })
  it('skip regex excludes node_modules/.next/.git by default', () => {
    expect(DEFAULT_SKIP_DIRS.test('app/node_modules/x')).toBe(true)
    expect(DEFAULT_SKIP_DIRS.test('.next/static')).toBe(true)
    expect(DEFAULT_SKIP_DIRS.test('lib/format')).toBe(false)
  })
})

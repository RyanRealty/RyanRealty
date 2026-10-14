import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('ci.yml changes job', () => {
  it('classifies app PRs with product-diff, not a docs/-only grep', () => {
    const yml = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8')
    expect(yml).toContain('scripts/ci-pr-app-change.mjs')
    expect(yml).toContain('GITHUB_BASE_SHA')
    expect(yml).not.toContain("grep -cv '^docs/'")
  })
})

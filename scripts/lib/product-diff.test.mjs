import { describe, it, expect } from 'vitest'
import {
  isVercelSkippable,
  isReleaseSkippable,
  isUsableSha,
  classifyDiff,
} from './product-diff.mjs'

describe('isUsableSha', () => {
  it('rejects empty and all-zero GitHub before SHAs', () => {
    expect(isUsableSha('')).toBe(false)
    expect(isUsableSha('0000000000000000000000000000000000000000')).toBe(false)
    expect(isUsableSha('abc1234')).toBe(true)
  })
})

describe('isVercelSkippable / isReleaseSkippable', () => {
  it('skips docs, skills, plans, agent protocol, and images outside app/', () => {
    const docsOnly = [
      'docs/plans/CROSS_AGENT_HANDOFF.md',
      '.cursor/rules/git-commit.mdc',
      '.claude/skills/voice-canon/SKILL.md',
      'marketing_brain_skills/run/SKILL.md',
      'CLAUDE.md',
      'AGENTS.md',
      'CHANGELOG.md',
      'scripts/check-foo.mjs',
      '.github/workflows/quality.yml',
      '.husky/pre-push',
    ]
    for (const f of docsOnly) {
      expect(isVercelSkippable(f), f).toBe(true)
      expect(isReleaseSkippable(f), f).toBe(true)
    }
  })

  it('does not skip Next runtime files', () => {
    const product = [
      'app/page.tsx',
      'app/contact/page.tsx',
      'lib/env.ts',
      'components/ui/button.tsx',
      'package.json',
      'vercel.json',
      'next.config.ts',
    ]
    for (const f of product) {
      expect(isVercelSkippable(f), f).toBe(false)
      expect(isReleaseSkippable(f), f).toBe(false)
    }
  })

  it('treats hosted migrations as a product release but not a Next rebuild', () => {
    const mig = 'supabase/migrations/20260818120000_example.sql'
    expect(isVercelSkippable(mig)).toBe(true)
    expect(isReleaseSkippable(mig)).toBe(false)
  })
})

describe('classifyDiff', () => {
  it('skips a docs-only push and builds when any runtime file is present', () => {
    expect(classifyDiff(['docs/a.md', 'CLAUDE.md']).status).toBe('skip')
    expect(classifyDiff(['docs/a.md', 'app/page.tsx']).status).toBe('build')
    expect(classifyDiff(['docs/a.md', 'app/page.tsx']).blockers).toEqual(['app/page.tsx'])
  })

  it('unknown git state is unknown (caller must not skip a product release)', () => {
    expect(classifyDiff(null).status).toBe('unknown')
  })

  it('release mode still tags a migration-only push', () => {
    const files = ['supabase/migrations/20260818120000_example.sql']
    expect(classifyDiff(files).status).toBe('skip')
    expect(classifyDiff(files, { skippable: isReleaseSkippable }).status).toBe('build')
  })
})

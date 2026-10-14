import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  isVercelSkippable,
  isReleaseSkippable,
  isUsableSha,
  classifyDiff,
  listChangedFiles,
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

  it('skips unit tests and the repo-root test/ harness, not live /test routes', () => {
    const skip = [
      'lib/crm/import.test.ts',
      'app/zip/[zip]/page.test.ts',
      'components/site/foo.test.tsx',
      'test/next-cache-cli-stub.ts',
      'test/next-fetch-cache-harness.ts',
    ]
    for (const f of skip) {
      expect(isVercelSkippable(f), f).toBe(true)
      expect(isReleaseSkippable(f), f).toBe(true)
    }
    const live = [
      'app/api/push/test/route.ts',
      'app/api/google-business-profile/test/route.ts',
    ]
    for (const f of live) {
      expect(isVercelSkippable(f), f).toBe(false)
      expect(isReleaseSkippable(f), f).toBe(false)
    }
    expect(classifyDiff(['lib/crm/import.test.ts', 'test/server-only-stub.ts']).status).toBe('skip')
    expect(classifyDiff(['app/zip/[zip]/page.test.ts', 'app/zip/[zip]/page.tsx']).blockers).toEqual([
      'app/zip/[zip]/page.tsx',
    ])
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

describe('listChangedFiles (no prev): the commit asked for, a merge against its first parent', () => {
  let dir = ''
  const shas = {}
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  const commit = (file, msg) => {
    mkdirSync(join(dir, file, '..'), { recursive: true })
    writeFileSync(join(dir, file), `${msg}\n`)
    git('add', file)
    git('commit', '-q', '-m', msg)
    return git('rev-parse', 'HEAD')
  }

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'product-diff-'))
    git('init', '-q', '-b', 'main')
    commit('README.md', 'root')
    git('checkout', '-q', '-b', 'feature')
    shas.feature = commit('app/page.tsx', 'product change')
    git('checkout', '-q', 'main')
    shas.docs = commit('docs/notes.md', 'docs change on main')
    git('merge', '-q', '--no-ff', '-m', 'Merge feature', 'feature')
    shas.merge = git('rev-parse', 'HEAD')
  })
  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('a merge commit lists what it brought in, so it is not an empty, skippable diff', () => {
    const files = listChangedFiles({ prev: '', head: shas.merge, cwd: dir })
    expect(files).toEqual(['app/page.tsx'])
    expect(classifyDiff(files).status).toBe('build')
  })

  it('reads the commit named by head, not the checkout HEAD', () => {
    expect(listChangedFiles({ prev: '', head: shas.docs, cwd: dir })).toEqual(['docs/notes.md'])
    expect(listChangedFiles({ prev: '', head: shas.feature, cwd: dir })).toEqual(['app/page.tsx'])
  })

  it('a commit git cannot read is unknown, never an empty diff', () => {
    expect(listChangedFiles({ prev: '', head: 'f'.repeat(40), cwd: dir })).toBeNull()
  })
})

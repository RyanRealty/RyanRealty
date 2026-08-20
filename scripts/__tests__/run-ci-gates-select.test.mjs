import { describe, it, expect } from 'vitest'
import {
  parseChain,
  matchGlob,
  selectGates,
  loadLanes,
  listChangedFiles,
} from '../lib/ci-gates-select.mjs'

const tinyPkg = {
  scripts: {
    'ci:gates:chain': 'npm run ci:alpha && npm run ci:beta && npm run ci:gamma',
    'ci:alpha': 'node -e "process.exit(0)"',
    'ci:beta': 'node -e "process.exit(0)"',
    'ci:gamma': 'node -e "process.exit(0)"',
  },
}

const lanes = {
  version: 1,
  always: ['ci:dal-boundary', 'ci:commit-compiles'],
  path: {
    'ci:cma-routing': ['lib/cma/**', 'lib/pricing/**'],
    'ci:process-canon': [
      'docs/plans/**',
      'docs/DEVELOPMENT_PROCESS.md',
      'CLAUDE.md',
      'AGENTS.md',
    ],
  },
  nightly: ['ci:lighthouse'],
  cert: ['ci:version-manifest'],
}

const chain = [
  'ci:dal-boundary',
  'ci:commit-compiles',
  'ci:cma-routing',
  'ci:process-canon',
  'ci:lighthouse',
  'ci:version-manifest',
]

function names(result) {
  return result.selected
}

describe('parseChain', () => {
  it('parses a tiny fake chain of 3 and does not throw for length < 150', () => {
    expect(parseChain(tinyPkg)).toEqual(['ci:alpha', 'ci:beta', 'ci:gamma'])
  })

  it('refuses a missing or empty chain string', () => {
    expect(() => parseChain({ scripts: {} })).toThrow(/ci:gates:chain/)
    expect(() => parseChain({ scripts: { 'ci:gates:chain': '   ' } })).toThrow(/ci:gates:chain/)
  })

  it('dedupes and still requires at least one unique gate', () => {
    const pkg = {
      scripts: {
        'ci:gates:chain': 'npm run ci:alpha && npm run ci:alpha',
        'ci:alpha': 'true',
      },
    }
    expect(parseChain(pkg)).toEqual(['ci:alpha'])
  })
})

describe('matchGlob', () => {
  it('matches ** across nested path segments', () => {
    expect(matchGlob('lib/cma/**', 'lib/cma/render.ts')).toBe(true)
    expect(matchGlob('lib/cma/**', 'lib/cma/foo/bar.ts')).toBe(true)
    expect(matchGlob('lib/cma/**', 'docs/foo.md')).toBe(false)
    expect(matchGlob('lib/cma/**', 'lib/cma-other/x.ts')).toBe(false)
  })

  it('matches a middle ** and a single-segment *', () => {
    expect(matchGlob('app/**/page.tsx', 'app/page.tsx')).toBe(true)
    expect(matchGlob('app/**/page.tsx', 'app/cities/bend/page.tsx')).toBe(true)
    expect(matchGlob('lib/*.ts', 'lib/cma.ts')).toBe(true)
    expect(matchGlob('lib/*.ts', 'lib/cma/render.ts')).toBe(false)
  })

  it('treats Next [slug] brackets as literals, not character classes', () => {
    expect(matchGlob('app/cities/[slug]/page.tsx', 'app/cities/[slug]/page.tsx')).toBe(true)
    expect(matchGlob('app/cities/[slug]/page.tsx', 'app/cities/bend/page.tsx')).toBe(false)
    expect(matchGlob('app/**/page.tsx', 'app/cities/[slug]/page.tsx')).toBe(true)
  })
})

describe('selectGates', () => {
  it('selecting with only docs/foo.md does not include a cma path gate', () => {
    const { selected, skipped } = selectGates({
      chain,
      lanes,
      changedFiles: ['docs/foo.md'],
    })
    expect(selected).toEqual(['ci:dal-boundary', 'ci:commit-compiles'])
    expect(selected).not.toContain('ci:cma-routing')
    expect(skipped).toContain('ci:cma-routing')
    expect(skipped).toContain('ci:lighthouse')
    expect(skipped).toContain('ci:version-manifest')
  })

  it('selecting with lib/cma/render.ts includes cma path gates if listed', () => {
    const { selected } = selectGates({
      chain,
      lanes,
      changedFiles: ['lib/cma/render.ts'],
    })
    expect(selected).toContain('ci:cma-routing')
    expect(selected).toEqual([
      'ci:dal-boundary',
      'ci:commit-compiles',
      'ci:cma-routing',
    ])
  })

  it('never selects nightly or cert on the ci:gates path', () => {
    const { selected } = selectGates({
      chain,
      lanes,
      changedFiles: ['app/page.tsx', 'docs/plans/ENTERPRISE_MAP/VERSION-1.md'],
    })
    expect(selected).not.toContain('ci:lighthouse')
    expect(selected).not.toContain('ci:version-manifest')
  })

  it('adds ci:process-canon when docs/plans or DEVELOPMENT_PROCESS.md changed', () => {
    expect(
      names(
        selectGates({
          chain,
          lanes,
          changedFiles: ['docs/plans/CROSS_AGENT_HANDOFF.md'],
        }),
      ),
    ).toContain('ci:process-canon')
    expect(
      names(
        selectGates({
          chain,
          lanes,
          changedFiles: ['docs/DEVELOPMENT_PROCESS.md'],
        }),
      ),
    ).toContain('ci:process-canon')
  })

  it('runs the full parseChain list when lanes are missing', () => {
    const { selected, skipped } = selectGates({
      chain,
      lanes: null,
      changedFiles: ['docs/foo.md'],
    })
    expect(selected).toEqual(chain)
    expect(skipped).toEqual([])
  })

  it('selects always plus every path key when changed-file discovery fails', () => {
    const { selected } = selectGates({
      chain,
      lanes,
      changedFiles: null,
    })
    expect(selected).toEqual([
      'ci:dal-boundary',
      'ci:commit-compiles',
      'ci:cma-routing',
      'ci:process-canon',
    ])
    expect(selected).not.toContain('ci:lighthouse')
    expect(selected).not.toContain('ci:version-manifest')
  })

  it('still runs always when nothing matches (pure docs with empty always falls back to always)', () => {
    const emptyAlways = { ...lanes, always: [] }
    const { selected } = selectGates({
      chain,
      lanes: emptyAlways,
      changedFiles: ['docs/foo.md'],
    })
    expect(selected).toEqual([])
    const withAlways = selectGates({
      chain,
      lanes,
      changedFiles: ['README.md'],
    })
    expect(withAlways.selected).toEqual(['ci:dal-boundary', 'ci:commit-compiles'])
  })

  it('selects only the nightly lane members that are in the chain', () => {
    const { selected, skipped } = selectGates({
      chain,
      lanes,
      changedFiles: ['app/page.tsx'],
      mode: 'nightly',
    })
    expect(selected).toEqual(['ci:lighthouse'])
    expect(skipped).not.toContain('ci:lighthouse')
    expect(selected).not.toContain('ci:dal-boundary')
    expect(selected).not.toContain('ci:version-manifest')
  })

  it('selects only the cert lane on --lane=cert', () => {
    const { selected } = selectGates({
      chain,
      lanes,
      mode: 'cert',
    })
    expect(selected).toEqual(['ci:version-manifest'])
  })
})

describe('loadLanes', () => {
  it('returns null when scripts/ci-lanes.json is absent', () => {
    const lanesFile = loadLanes('/tmp/no-such-ci-lanes-root', {
      existsSync: () => false,
    })
    expect(lanesFile).toBeNull()
  })

  it('parses always / path / nightly / cert from disk', () => {
    const parsed = loadLanes('/repo', {
      existsSync: () => true,
      readFileSync: () => JSON.stringify(lanes),
    })
    expect(parsed.always).toEqual(lanes.always)
    expect(parsed.path['ci:cma-routing']).toEqual(['lib/cma/**', 'lib/pricing/**'])
    expect(parsed.nightly).toEqual(['ci:lighthouse'])
    expect(parsed.cert).toEqual(['ci:version-manifest'])
  })
})

describe('listChangedFiles', () => {
  it('uses @{u}...HEAD when upstream exists and unions dirty + untracked', () => {
    const calls = []
    const files = listChangedFiles({
      env: {},
      runGit(args) {
        calls.push(args.join(' '))
        const key = args.join(' ')
        if (key === 'rev-parse --abbrev-ref @{u}') return 'origin/main\n'
        if (key === 'diff --name-only @{u}...HEAD') return 'lib/a.ts\n'
        if (key === 'diff --name-only') return 'lib/b.ts\n'
        if (key === 'diff --name-only --cached') return 'lib/d.ts\n'
        if (key === 'ls-files --others --exclude-standard') return 'lib/c.ts\n'
        return null
      },
    })
    expect(files).toEqual(['lib/a.ts', 'lib/b.ts', 'lib/d.ts', 'lib/c.ts'])
    expect(calls[0]).toBe('rev-parse --abbrev-ref @{u}')
    expect(calls).toContain('diff --name-only @{u}...HEAD')
    expect(calls).toContain('diff --name-only')
    expect(calls).toContain('diff --name-only --cached')
    expect(calls).toContain('ls-files --others --exclude-standard')
  })

  it('falls back to diff-tree HEAD when upstream is missing', () => {
    const calls = []
    const files = listChangedFiles({
      env: {},
      runGit(args) {
        calls.push(args.join(' '))
        const key = args.join(' ')
        if (key === 'rev-parse --abbrev-ref @{u}') return null
        if (key === 'diff-tree --no-commit-id --name-only -r HEAD') return 'app/page.tsx\n'
        if (key === 'diff --name-only') return ''
        if (key === 'ls-files --others --exclude-standard') return ''
        return null
      },
    })
    expect(files).toEqual(['app/page.tsx'])
    expect(calls).toContain('diff-tree --no-commit-id --name-only -r HEAD')
    expect(calls).not.toContain('diff --name-only @{u}...HEAD')
  })

  it('returns null when the committed diff fails (caller selects always+path)', () => {
    const files = listChangedFiles({
      env: {},
      runGit(args) {
        const key = args.join(' ')
        if (key === 'rev-parse --abbrev-ref @{u}') return 'origin/main\n'
        return null
      },
    })
    expect(files).toBeNull()
  })

  it('on GitHub push uses GITHUB_EVENT_BEFORE...GITHUB_SHA, not empty @{u}...HEAD', () => {
    const calls = []
    const files = listChangedFiles({
      env: {
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_BEFORE: 'aaa111',
        GITHUB_SHA: 'bbb222',
      },
      runGit(args) {
        calls.push(args.join(' '))
        const key = args.join(' ')
        if (key === 'diff --name-only aaa111...bbb222') return 'docs/plans/ENTERPRISE_MAP/VERSION-1.md\n'
        if (key === 'diff --name-only') return ''
        if (key === 'ls-files --others --exclude-standard') return ''
        return null
      },
    })
    expect(files).toEqual(['docs/plans/ENTERPRISE_MAP/VERSION-1.md'])
    expect(calls).toContain('diff --name-only aaa111...bbb222')
    expect(calls).not.toContain('diff --name-only @{u}...HEAD')
  })

  it('on GitHub with no before-sha falls back to diff-tree HEAD, not empty @{u} range', () => {
    const files = listChangedFiles({
      env: { GITHUB_ACTIONS: 'true' },
      runGit(args) {
        const key = args.join(' ')
        if (key === 'diff-tree --no-commit-id --name-only -r HEAD') return 'app/cities/[slug]/page.tsx\n'
        if (key === 'rev-parse --abbrev-ref @{u}') return 'origin/main\n'
        if (key === 'diff --name-only @{u}...HEAD') return ''
        if (key === 'diff --name-only') return ''
        if (key === 'ls-files --others --exclude-standard') return ''
        return null
      },
    })
    expect(files).toEqual(['app/cities/[slug]/page.tsx'])
  })

  it('local empty @{u}...HEAD stays empty so a clean tracking tree is always-only', () => {
    const files = listChangedFiles({
      env: {},
      runGit(args) {
        const key = args.join(' ')
        if (key === 'rev-parse --abbrev-ref @{u}') return 'origin/main\n'
        if (key === 'diff --name-only @{u}...HEAD') return ''
        if (key === 'diff --name-only') return ''
        if (key === 'ls-files --others --exclude-standard') return ''
        return null
      },
    })
    expect(files).toEqual([])
  })
})

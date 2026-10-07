import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ALIAS_HOST,
  ALLOWLIST,
  HELPER_PATH,
  checkFile,
  checkHelper,
  findAliasLiterals,
  findReads,
  isLiteralScannedPath,
  isScannedPath,
  run,
} from '../check-site-origin.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HELPER_SRC = readFileSync(join(REPO, HELPER_PATH), 'utf8')
const KEY = 'NEXT_PUBLIC_SITE_URL'

describe('findReads', () => {
  it('flags every shape of a direct read (R1)', () => {
    const shapes = [
      `const a = process.env.${KEY} ?? 'https://ryan-realty.com'`,
      `const b = process.env?.${KEY}`,
      `const c = process.env['${KEY}']`,
      `const d = env().${KEY}`,
      `const { ${KEY} } = process.env`,
      `const { ${KEY}: site } = process.env`,
      'const e = `${process.env.' + KEY + '}/contact`',
    ]
    for (const src of shapes) {
      const hits = findReads('app/x.ts', src)
      expect(hits, src).toHaveLength(1)
      expect(hits[0].key).toBe(KEY)
    }
  })

  it('flags a Vercel host variable (R2)', () => {
    expect(findReads('lib/x.ts', 'const u = `https://${process.env.VERCEL_URL}`')[0].key).toBe('VERCEL_URL')
    expect(findReads('lib/x.ts', 'const u = process.env.VERCEL_PROJECT_PRODUCTION_URL')[0].key).toBe(
      'VERCEL_PROJECT_PRODUCTION_URL',
    )
    expect(findReads('lib/x.tsx', 'const u = process.env.NEXT_PUBLIC_VERCEL_URL')[0].key).toBe('NEXT_PUBLIC_VERCEL_URL')
  })

  it('ignores comments, prose strings and the env schema key', () => {
    const src = [
      `// process.env.${KEY} used to be the alias`,
      `/** reads process.env.${KEY} */`,
      `const note = 'set ${KEY} in Vercel'`,
      `export const EnvSchema = z.object({ ${KEY}: z.string().optional() })`,
      `export const optional = ['${KEY}']`,
    ].join('\n')
    expect(findReads('lib/env.ts', src)).toEqual([])
  })

  it('reports the line of the read', () => {
    const hits = findReads('app/x.tsx', `import x from 'y'\n\nconst s = process.env.${KEY}\n`)
    expect(hits[0].line).toBe(3)
  })
})

describe('checkFile', () => {
  it('lets the helper module read the variable', () => {
    expect(checkFile(HELPER_PATH, HELPER_SRC).violations).toEqual([])
  })

  it('fails a read anywhere else, with the rule named', () => {
    const { violations } = checkFile('app/page.tsx', `const s = (process.env.${KEY} ?? 'x').replace(/\\/$/, '')`)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({ rule: 'R1', file: 'app/page.tsx', key: KEY })
  })

  it('honors an allowlist entry for that file and key only', () => {
    const src = 'const u = `https://${process.env.VERCEL_URL}`'
    const allow = new Map([['app/api/cron/x/route.ts::VERCEL_URL', 'self-call']])
    const ok = checkFile('app/api/cron/x/route.ts', src, allow)
    expect(ok.violations).toEqual([])
    expect([...ok.allowUsed]).toEqual(['app/api/cron/x/route.ts::VERCEL_URL'])
    const other = checkFile('app/api/cron/y/route.ts', src, allow)
    expect(other.violations[0]).toMatchObject({ rule: 'R2', key: 'VERCEL_URL' })
  })

  it('every shipped allowlist entry carries a reason', () => {
    for (const [k, reason] of ALLOWLIST) {
      expect(k).toMatch(/::[A-Z_]+$/)
      expect(String(reason).length).toBeGreaterThan(20)
    }
  })
})

describe('checkHelper (R3)', () => {
  it('passes the real helper', () => {
    expect(checkHelper(HELPER_SRC)).toEqual([])
  })

  it('fails when the helper is missing', () => {
    expect(checkHelper(null)[0]).toMatch(/missing/)
  })

  it('fails when the alias is dropped from the production hosts', () => {
    const broken = HELPER_SRC.replace(/\n\s*'ryanrealty\.vercel\.app',[^\n]*/, '')
    expect(broken).not.toBe(HELPER_SRC)
    expect(checkHelper(broken).join('\n')).toMatch(/ryanrealty\.vercel\.app/)
  })

  it('fails when the canonical origin changes', () => {
    const broken = HELPER_SRC.replace(
      "CANONICAL_SITE_ORIGIN = 'https://ryan-realty.com'",
      "CANONICAL_SITE_ORIGIN = 'https://example.com'",
    )
    expect(checkHelper(broken).join('\n')).toMatch(/CANONICAL_SITE_ORIGIN/)
  })
})

describe('isScannedPath', () => {
  it('scans source under app, lib, components and middleware, never tests', () => {
    expect(isScannedPath('app/(x)/page.tsx')).toBe(true)
    expect(isScannedPath('lib/a/b.ts')).toBe(true)
    expect(isScannedPath('components/C.tsx')).toBe(true)
    expect(isScannedPath('middleware.ts')).toBe(true)
    expect(isScannedPath('lib/a/b.test.ts')).toBe(false)
    expect(isScannedPath('lib/__tests__/b.ts')).toBe(false)
    expect(isScannedPath('scripts/x.mjs')).toBe(false)
    expect(isScannedPath('lib/types.d.ts')).toBe(false)
  })
})

describe('findAliasLiterals (R5)', () => {
  it('builds the alias host it hunts for', () => {
    expect(ALIAS_HOST).toBe('ryanrealty' + '.vercel.app')
  })

  it('flags the alias in a string, a template, a JSX attribute and JSX text', () => {
    const shapes = [
      ['lib/x.ts', `export const u = 'https://${ALIAS_HOST}/contact'`],
      ['lib/x.ts', `export const u = "${ALIAS_HOST.toUpperCase()}"`],
      ['lib/x.ts', 'export const u = `https://' + ALIAS_HOST + '/listing/${id}`'],
      ['lib/x.ts', 'export const u = `${base}/a?next=https://' + ALIAS_HOST + '`'],
      ['components/X.tsx', `export const X = () => <a href="https://${ALIAS_HOST}/sell">Sell</a>`],
      ['components/X.tsx', `export const X = () => <p>Visit ${ALIAS_HOST} today</p>`],
      ['scripts/x.mjs', `const BASE = 'https://${ALIAS_HOST}'`],
    ]
    for (const [file, src] of shapes) {
      expect(findAliasLiterals(file, src), src).toHaveLength(1)
    }
  })

  it('reports one hit per line with its line number', () => {
    const src = `import a from 'b'\nif (h === '${ALIAS_HOST}') return '${ALIAS_HOST}'\n`
    expect(findAliasLiterals('app/x.ts', src)).toEqual([
      { line: 2, text: `if (h === '${ALIAS_HOST}') return '${ALIAS_HOST}'` },
    ])
  })

  it('ignores comments, a regex that matches the alias, other vercel.app hosts and the apex', () => {
    const src = [
      `// never ${ALIAS_HOST} (Matt 2026-10-07)`,
      `/** the alias ${ALIAS_HOST} 308s pages to the apex */`,
      `const re = /https?:\\/\\/ryanrealty\\.vercel\\.app/gi`,
      `const p = 'https://ryanrealty-git-x-team.vercel.app'`,
      `const ok = 'https://ryan-realty.com'`,
    ].join('\n')
    expect(findAliasLiterals('lib/x.ts', src)).toEqual([])
  })

  it('honors the staging-host-ok marker on the line or the line directly above, nowhere else', () => {
    const same = `const s = new Set(['${ALIAS_HOST}']) // staging-host-ok: incoming host`
    expect(findAliasLiterals('middleware.ts', same)).toEqual([])
    const above = `// staging-host-ok: incoming host\nconst s = new Set(['${ALIAS_HOST}'])`
    expect(findAliasLiterals('middleware.ts', above)).toEqual([])
    const tooFar = `// staging-host-ok: incoming host\n\nconst s = new Set(['${ALIAS_HOST}'])`
    expect(findAliasLiterals('middleware.ts', tooFar)).toHaveLength(1)
  })
})

describe('isLiteralScannedPath', () => {
  it('adds scripts/ to the R5 scan, still never tests', () => {
    expect(isLiteralScannedPath('scripts/x.mjs')).toBe(true)
    expect(isLiteralScannedPath('scripts/lib/y.ts')).toBe(true)
    expect(isLiteralScannedPath('app/page.tsx')).toBe(true)
    expect(isLiteralScannedPath('middleware.ts')).toBe(true)
    expect(isLiteralScannedPath('scripts/__tests__/x.test.mjs')).toBe(false)
    expect(isLiteralScannedPath('scripts/lib/y.test.mjs')).toBe(false)
    expect(isLiteralScannedPath('scripts/notes.md')).toBe(false)
    expect(isLiteralScannedPath('docs/x.ts')).toBe(false)
  })
})

describe('run (sandbox tree)', () => {
  const root = mkdtempSync(join(tmpdir(), 'site-origin-gate-'))
  afterAll(() => rmSync(root, { recursive: true, force: true }))
  const put = (rel, src) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), src)
  }

  it('is green on a clean tree, red on a read, red on a stale allowlist entry', () => {
    put(HELPER_PATH, HELPER_SRC)
    put('app/page.tsx', "import { siteOrigin } from '@/lib/site-origin'\nexport const u = siteOrigin()\n")
    put('lib/a.test.ts', `process.env.${KEY} = 'https://example.com'\n`)
    let res = run(root, new Map())
    expect(res.violations).toEqual([])
    expect(res.helperProblems).toEqual([])
    expect(res.stale).toEqual([])

    put('components/Bad.tsx', `export const u = process.env.${KEY}\n`)
    res = run(root, new Map())
    expect(res.violations.map((v) => `${v.rule} ${v.file}`)).toEqual(['R1 components/Bad.tsx'])

    rmSync(join(root, 'components/Bad.tsx'))
    res = run(root, new Map([['app/gone.ts::VERCEL_URL', 'self-call that no longer exists']]))
    expect(res.stale).toEqual(['app/gone.ts::VERCEL_URL'])
  })

  it('is red on an alias literal in scripts/ (R5), green once marked', () => {
    put(HELPER_PATH, HELPER_SRC)
    put('scripts/probe.mjs', `const BASE = 'https://${ALIAS_HOST}'\n`)
    let res = run(root, new Map())
    expect(res.violations.map((v) => `${v.rule} ${v.file}:${v.line}`)).toEqual(['R5 scripts/probe.mjs:1'])

    put('scripts/probe.mjs', `const HOSTS = ['${ALIAS_HOST}'] // staging-host-ok: incoming host filter\n`)
    put('scripts/__tests__/probe.test.mjs', `expect(x).toBe('https://${ALIAS_HOST}')\n`)
    res = run(root, new Map())
    expect(res.violations).toEqual([])
  })

  it('passes on the real repository', () => {
    const res = run(REPO)
    expect(res.violations).toEqual([])
    expect(res.helperProblems).toEqual([])
    expect(res.stale).toEqual([])
  })
})

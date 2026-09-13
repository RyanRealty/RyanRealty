import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { PUBLIC_ISR_TTLS } from '../check-public-isr-ttl.mjs'

/**
 * Break-tests for ci:public-isr-ttl (scripts/check-public-isr-ttl.mjs).
 *
 * Copies the listed public pages + the gate into a sandbox, then mutates
 * exactly one TTL and asserts the gate fails.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const SANDBOX = join(tmpdir(), `rr-public-isr-ttl-${process.pid}-${Math.random().toString(16).slice(2)}`)
const GATE = join(SANDBOX, 'scripts/check-public-isr-ttl.mjs')

const FILES = ['scripts/check-public-isr-ttl.mjs', ...PUBLIC_ISR_TTLS.map(([rel]) => rel)]

function reset() {
  rmSync(SANDBOX, { recursive: true, force: true })
  for (const rel of FILES) {
    const dest = join(SANDBOX, rel)
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(join(REPO, rel), dest)
  }
}

function run() {
  try {
    const stdout = execFileSync('node', [GATE], { cwd: SANDBOX, encoding: 'utf8' })
    return { code: 0, out: stdout }
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

describe('ci:public-isr-ttl', () => {
  afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

  it('passes on the untouched listed pages', () => {
    reset()
    const r = run()
    expect(r.out).toContain('OK')
    expect(r.code).toBe(0)
  })

  it('fails when a listed page drops back to 60', () => {
    reset()
    const file = join(SANDBOX, 'app/search/page.tsx')
    writeFileSync(file, readFileSync(file, 'utf8').replace('export const revalidate = 300', 'export const revalidate = 60'))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('app/search/page.tsx')
    expect(r.out).toContain('60')
  })

  it('fails when a listed page drops its revalidate export', () => {
    reset()
    const file = join(SANDBOX, 'app/zip/[zip]/page.tsx')
    writeFileSync(file, readFileSync(file, 'utf8').replace('export const revalidate = 300', ''))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('app/zip/[zip]/page.tsx')
    expect(r.out).toContain('lost ISR')
  })

  it('fails when a leftover unlisted public page still exports 60', () => {
    reset()
    const extra = join(SANDBOX, 'app/buy/page.tsx')
    mkdirSync(dirname(extra), { recursive: true })
    writeFileSync(extra, 'export const revalidate = 60\nexport default function Page() { return null }\n')
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('app/buy/page.tsx')
    expect(r.out).toContain('leftover')
  })

  it('fails when the team broker page is not 1800', () => {
    reset()
    const file = join(SANDBOX, 'app/team/[slug]/page.tsx')
    writeFileSync(file, readFileSync(file, 'utf8').replace('export const revalidate = 1800', 'export const revalidate = 300'))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('app/team/[slug]/page.tsx')
    expect(r.out).toContain('1800')
  })
})

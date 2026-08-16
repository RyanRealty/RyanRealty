import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sentinel = readFileSync('lib/data/loop/sentinel.ts', 'utf8')
const status = readFileSync('lib/data/loop/status.ts', 'utf8')
const admin = readFileSync('app/admin/(protected)/loop/page.tsx', 'utf8')

describe('loop sentinel — no daily launch cap (Matt 2026-08-16)', () => {
  it('does not skip on a numeric daily launch cap', () => {
    expect(sentinel).not.toMatch(/DAILY_LAUNCH_CAP/)
    expect(sentinel).not.toMatch(/daily launch cap reached/)
    expect(sentinel).not.toMatch(/12\/24h/)
  })

  it('status and /admin/loop do not report a remaining cap', () => {
    expect(status).not.toMatch(/SENTINEL_DAILY_CAP/)
    expect(status).not.toMatch(/cap:\s*SENTINEL/)
    expect(admin).toMatch(/no daily cap/)
    expect(admin).not.toMatch(/daily cost cap/)
  })
})

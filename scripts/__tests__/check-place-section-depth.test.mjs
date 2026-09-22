import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const GATE = join(process.cwd(), 'scripts/check-place-section-depth.mjs')

function run() {
  try {
    const out = execFileSync('node', [GATE], { cwd: process.cwd(), encoding: 'utf8' })
    return { ok: true, out }
  } catch (err) {
    return { ok: false, out: String(err.stdout ?? '') + String(err.stderr ?? '') }
  }
}

describe('ci:place-section-depth', () => {
  it('holds named place sections and the community amenity mount', () => {
    const r = run()
    expect(r.ok, r.out).toBe(true)
    expect(r.out).toMatch(/ci:place-section-depth OK/)
    expect(r.out).toMatch(/place routes hold their named sections/)
  })
})

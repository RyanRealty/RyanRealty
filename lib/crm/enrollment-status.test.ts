import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ENROLLMENT_STATUSES, isEnrollmentStatus } from './enrollment-status'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

/** The status list of the newest migration that (re)defines the CHECK. */
function newestCheckList(): { file: string; statuses: string[] } {
  const dir = path.join(ROOT, 'supabase', 'migrations')
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files.reverse()) {
    const sql = readFileSync(path.join(dir, file), 'utf8')
    const m = /ADD CONSTRAINT crm_sequence_enrollments_status_check\s+CHECK\s*\(\s*status IN \(([^)]*)\)/i.exec(sql)
    if (m) return { file, statuses: [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) }
  }
  throw new Error('no migration defines crm_sequence_enrollments_status_check')
}

/** Quoted statuses inside `const <name> = [ ... ]` in a source file. */
function listLiteral(src: string, name: string): string[] {
  const m = new RegExp(`const ${name}\\s*=\\s*\\[([^\\]]*)\\]`).exec(src)
  if (!m) throw new Error(`const ${name} not found`)
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
}

describe('crm_sequence_enrollments status list', () => {
  it('equals the newest migration CHECK', () => {
    const { file, statuses } = newestCheckList()
    expect(file >= '20260924052000', file).toBe(true)
    expect([...statuses].sort()).toEqual([...ENROLLMENT_STATUSES].sort())
  })

  it('holds every status the sequence engine writes', () => {
    const src = read('app/api/cron/crm-sequence-engine/route.ts')
    const written = [...src.matchAll(/finish\(\{[^}]*status: '([a-z_]+)'/g)].map((m) => m[1])
    expect(written).toContain('awaiting_broker_next')
    for (const status of written) expect(isEnrollmentStatus(status), status).toBe(true)
  })

  it('holds every status the broker action writes', () => {
    const src = read('app/actions/crm.ts')
    const block = src.slice(src.indexOf('async function setEnrollment'))
    const written = [...block.matchAll(/setEnrollment\([\s\S]*?\)/g)]
      .flatMap((m) => [...m[0].matchAll(/status: '([a-z_]+)'/g)].map((x) => x[1]))
    for (const status of written) expect(isEnrollmentStatus(status), status).toBe(true)
  })

  it('holds every live-enrollment list the CRM reads', () => {
    const lists: Array<[string, string]> = [
      ['app/actions/crm-membership.ts', 'LIVE_ENROLLMENT_STATUSES'],
      ['lib/crm/merge-people.ts', 'LIVE'],
      ['lib/data/prospecting/drip.ts', 'LIVE_DRIP_STATUSES'],
    ]
    for (const [file, name] of lists) {
      for (const status of listLiteral(read(file), name)) expect(isEnrollmentStatus(status), `${file} ${status}`).toBe(true)
    }
  })

  it('rejects a status the table would refuse', () => {
    expect(isEnrollmentStatus('awaiting_broker_next')).toBe(true)
    expect(isEnrollmentStatus('active')).toBe(false)
    expect(isEnrollmentStatus(undefined)).toBe(false)
  })
})

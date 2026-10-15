import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logRejectedWrite, PG_CHECK_VIOLATION, PG_UNIQUE_VIOLATION } from './rejected-write'

/**
 * A refused database write has to leave one greppable line naming the table,
 * the column and the value, and nothing that identifies a person. The three
 * writers that lost rows in production (crm_timeline x2, sync_history) all
 * swallowed the refusal; this is the line they now write.
 */
let spy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  spy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => spy.mockRestore())

const checkViolation = {
  code: PG_CHECK_VIOLATION,
  message: 'new row for relation "crm_timeline" violates check constraint "crm_timeline_kind_check"',
}

describe('logRejectedWrite', () => {
  it('names the table, the column, the refused value and the SQLSTATE', () => {
    expect(
      logRejectedWrite('resend-webhook', {
        table: 'crm_timeline',
        column: 'kind',
        value: 'email_delivered',
        error: checkViolation,
      }),
    ).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
    const line = String(spy.mock.calls[0][0])
    expect(line).toContain('[resend-webhook]')
    expect(line).toContain('table=crm_timeline')
    expect(line).toContain('column=kind')
    expect(line).toContain('value=email_delivered')
    expect(line).toContain(`code=${PG_CHECK_VIOLATION}`)
    expect(line).toContain('crm_timeline_kind_check')
  })

  it('logs once per (table, column, value, code) when given a per-request Set', () => {
    const seen = new Set<string>()
    const w = { table: 'crm_timeline', column: 'kind', value: 'email_bounce', error: checkViolation }
    expect(logRejectedWrite('resend-webhook', w, seen)).toBe(true)
    expect(logRejectedWrite('resend-webhook', w, seen)).toBe(false)
    expect(logRejectedWrite('resend-webhook', w, seen)).toBe(false)
    expect(spy).toHaveBeenCalledTimes(1)
    // A different refused value is a different problem and is logged.
    expect(logRejectedWrite('resend-webhook', { ...w, value: 'email_delivered' }, seen)).toBe(true)
    // So is a different SQLSTATE for the same value.
    expect(
      logRejectedWrite('resend-webhook', { ...w, error: { code: PG_UNIQUE_VIOLATION, message: 'dup' } }, seen),
    ).toBe(true)
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it('without a Set every call logs', () => {
    const w = { table: 'sync_history', column: 'run_type', value: 'delta', error: checkViolation }
    logRejectedWrite('sync-history', w)
    logRejectedWrite('sync-history', w)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('never prints the PostgREST details string (it carries the whole failing row)', () => {
    logRejectedWrite('resend-webhook', {
      table: 'crm_timeline',
      column: 'kind',
      value: 'email_delivered',
      // supabase-js errors also carry `details` / `hint`; only code + message are read.
      error: {
        ...checkViolation,
        details: 'Failing row contains (1, 2, email_delivered, {"email": "someone@example.com"})',
      } as never,
    })
    const line = String(spy.mock.calls[0][0])
    expect(line).not.toContain('someone@example.com')
    expect(line).not.toContain('Failing row')
  })

  it('caps the message and tolerates a missing error', () => {
    logRejectedWrite('x', { table: 't', column: 'c', value: 'v', error: { code: 'XX000', message: 'a'.repeat(5000) } })
    expect(String(spy.mock.calls[0][0]).length).toBeLessThan(400)
    logRejectedWrite('x', { table: 't', column: 'c', value: 'v', error: null })
    expect(String(spy.mock.calls[1][0])).toContain('code=unknown')
  })
})

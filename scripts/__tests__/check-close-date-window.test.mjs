import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { castWindowWithoutRawBound, latestDefinitions } from '../check-close-date-window.mjs'

/**
 * ci:close-date-window (scripts/check-close-date-window.mjs). Founding cases:
 * the admin report RPCs (20260925090000) and analytics_financing_mix_co
 * (SITE-211), each windowing on "CloseDate"::date where no index could serve it.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')

describe('a body that windows on the date cast', () => {
  it('fails with no raw bound', () => {
    expect(castWindowWithoutRawBound(`WHERE l."CloseDate"::date BETWEEN p_from AND p_to`)).toBe(true)
    expect(castWindowWithoutRawBound(`WHERE p_from <= l."CloseDate"::date`)).toBe(true)
  })

  it('passes with a raw bound beside it', () => {
    expect(
      castWindowWithoutRawBound(
        `WHERE l."CloseDate"::date BETWEEN p_from AND p_to AND l."CloseDate" >= p_from::timestamptz AND l."CloseDate" < (p_to + 1)::timestamptz`,
      ),
    ).toBe(false)
    expect(castWindowWithoutRawBound(`WHERE close_lo <= l."CloseDate" AND l."CloseDate"::date <= p_to`)).toBe(false)
  })

  it('does not count a comparison with another column as a bound', () => {
    expect(castWindowWithoutRawBound(`WHERE m."CloseDate"::date BETWEEN a AND b AND "CloseDate" > "ListDate"`)).toBe(true)
    expect(castWindowWithoutRawBound(`WHERE "ListDate" < "CloseDate" AND x."CloseDate"::date >= d`)).toBe(true)
    expect(castWindowWithoutRawBound(`WHERE l."CloseDate" <> x AND l."CloseDate"::date <= x`)).toBe(true)
  })

  it('leaves a cast that is only selected alone', () => {
    expect(castWindowWithoutRawBound(`SELECT l."CloseDate"::date AS close_date FROM listings l`)).toBe(false)
  })
})

describe('the newest definitions across migrations', () => {
  const files = [
    { name: '001.sql', sql: `CREATE OR REPLACE FUNCTION public.f(p date) RETURNS int LANGUAGE sql AS $$ SELECT 1 FROM listings l WHERE l."CloseDate"::date >= p $$;` },
    { name: '002.sql', sql: `CREATE OR REPLACE FUNCTION public.f(p date) RETURNS int LANGUAGE sql AS $fn$ SELECT 1 FROM listings l WHERE l."CloseDate"::date >= p AND l."CloseDate" >= p::timestamptz $fn$;` },
    { name: '003.sql', sql: `-- "CloseDate"::date BETWEEN in a comment is not code\nCREATE VIEW public.v AS SELECT 1 FROM listings l WHERE l."CloseDate"::date <= CURRENT_DATE;\nCREATE FUNCTION public.g() RETURNS int LANGUAGE sql AS $$ SELECT 1 FROM listings l WHERE l."CloseDate"::date = CURRENT_DATE $$;\nDROP FUNCTION IF EXISTS public.g();` },
  ]
  const defs = latestDefinitions(files)

  it('reads the newest definition of each and forgets a dropped one', () => {
    expect(defs.get('f')?.file).toBe('002.sql')
    expect(castWindowWithoutRawBound(defs.get('f').body)).toBe(false)
    expect(defs.has('g')).toBe(false)
  })

  it('reads views to their end', () => {
    expect(defs.get('v')?.kind).toBe('view')
    expect(castWindowWithoutRawBound(defs.get('v').body)).toBe(true)
  })
})

describe('the gate on this tree', () => {
  it('passes: every date-cast window has a raw bound or is held in the baseline', () => {
    const out = execFileSync('node', ['scripts/check-close-date-window.mjs'], { cwd: REPO, encoding: 'utf8' })
    expect(out).toMatch(/OK: every date-cast window also bounds the raw "CloseDate"/)
  })
})

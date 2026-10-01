#!/usr/bin/env node
// scripts/check-close-date-window.mjs
//
// G-close-date-window — a SQL function or view that windows on
// "CloseDate"::date must also bound the raw "CloseDate" column.
//
// THE BUG CLASS. "CloseDate" is timestamptz. A test written on its date cast
// ("CloseDate"::date BETWEEN a AND b, "CloseDate"::date >= x) cannot use any
// close-date index, so the planner reads every closed sale the other filters
// let through and drops all but the window. analytics_financing_mix_co read
// every closed Bend sale ever that way (18 s, against anon's 3 s statement
// timeout: 1,124 failed calls on 2026-09-30, SITE-211), five days after the
// same shape was fixed in the admin report RPCs (20260925090000). The fix both
// times keeps the date test for its exact meaning and adds a range on the raw
// column ("CloseDate" >= x::timestamptz AND "CloseDate" < (y + 1)::timestamptz),
// which the index serves.
//
// THE GATE. supabase/migrations/*.sql in name order; the newest definition of
// every function (CREATE [OR REPLACE] FUNCTION ... AS $tag$ body $tag$) and
// view (CREATE [OR REPLACE] [MATERIALIZED] VIEW ... ;), dropped ones removed.
// A definition fails when it compares "CloseDate"::date (either side of the
// operator, or BETWEEN) and nowhere compares the raw "CloseDate". Known
// offenders sit in scripts/close-date-window-baseline.json with a reason; the
// baseline only shrinks (an entry that no longer offends fails too).
//
// It reads text, so it cannot see through a view: a window on a view column
// that is itself the cast (analytics_v_closed_sale_co.close_date) passes here.
// That view carries close_ts, the raw column, for exactly this (20261001010000).
//
// Run: npm run ci:close-date-window

import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve('.')
const MIGRATIONS = join(ROOT, 'supabase/migrations')
const BASELINE = join(ROOT, 'scripts/close-date-window-baseline.json')

const FN = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?\s*\(/gi
const VIEW = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?/gi
const DROP = /DROP\s+(?:FUNCTION|VIEW|MATERIALIZED\s+VIEW)\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?/gi

/** A comparison on the date cast: "CloseDate"::date >= x, x <= l."CloseDate"::date, ... BETWEEN. */
const CAST_TEST = /"CloseDate"\s*::\s*date\s*(?:>=|<=|<>|!=|>|<|=|BETWEEN\b)|(?:>=|<=|<>|!=|>|<|=)\s*(?:[A-Za-z_][A-Za-z0-9_]*\.)?"CloseDate"\s*::\s*date/i
/**
 * A bound on the raw column, which an index on "CloseDate" can serve: compared
 * with a value, not with another quoted column ("CloseDate" > "ListDate" bounds
 * nothing).
 */
const OP = '(?:>=|<=|>(?!=)|<(?![=>]))'
const RAW_TEST = new RegExp(
  `"CloseDate"\\s*(?:${OP}(?!\\s*(?:[A-Za-z_][A-Za-z0-9_]*\\.)?"[A-Za-z])|BETWEEN\\b)` +
    `|(?<!"\\s{0,3})${OP}\\s*(?:[A-Za-z_][A-Za-z0-9_]*\\.)?"CloseDate"(?!\\s*::)`,
  'i',
)

/** Strip -- line comments so a comment quoting the bad shape is not read as code. */
function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, '')
}

/** Newest definition of each function and view across the migrations, in file order. */
export function latestDefinitions(files) {
  const defs = new Map()
  for (const { name: file, sql: raw } of files) {
    const sql = stripComments(raw)
    const events = []
    let m
    FN.lastIndex = 0
    while ((m = FN.exec(sql))) {
      const rest = sql.slice(m.index)
      const tag = /\bAS\s+(\$[A-Za-z_]*\$)/i.exec(rest)
      if (!tag) continue
      const open = tag.index + tag[0].length
      const close = rest.indexOf(tag[1], open)
      events.push({ at: m.index, kind: 'function', name: m[1].toLowerCase(), body: rest.slice(open, close < 0 ? undefined : close) })
    }
    VIEW.lastIndex = 0
    while ((m = VIEW.exec(sql))) {
      const rest = sql.slice(m.index)
      const end = rest.search(/;\s*(\n|$)/)
      events.push({ at: m.index, kind: 'view', name: m[1].toLowerCase(), body: rest.slice(0, end < 0 ? undefined : end) })
    }
    DROP.lastIndex = 0
    while ((m = DROP.exec(sql))) events.push({ at: m.index, kind: 'drop', name: m[1].toLowerCase() })
    events.sort((a, b) => a.at - b.at)
    for (const e of events) {
      if (e.kind === 'drop') defs.delete(e.name)
      else defs.set(e.name, { file, kind: e.kind, body: e.body })
    }
  }
  return defs
}

/** True when a body windows on the date cast and never bounds the raw column. */
export function castWindowWithoutRawBound(body) {
  return CAST_TEST.test(body) && !RAW_TEST.test(body)
}

function main() {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS, name), 'utf8') }))
  const defs = latestDefinitions(files)
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).entries ?? {}
  const offenders = [...defs].filter(([, d]) => castWindowWithoutRawBound(d.body))
  const fresh = offenders.filter(([name]) => !(name in baseline))
  const stale = Object.keys(baseline).filter((name) => !offenders.some(([n]) => n === name))
  console.log('"CloseDate"::date windows (G-close-date-window)')
  console.log(`${defs.size} functions and views (newest definitions) · ${offenders.length} window on the date cast alone · ${offenders.length - fresh.length} held in the baseline`)
  if (fresh.length === 0 && stale.length === 0) {
    console.log('OK: every date-cast window also bounds the raw "CloseDate", or is held in the baseline with its reason.')
    return 0
  }
  for (const [name, d] of fresh) {
    console.error(`FAIL: ${d.kind} ${name} (${d.file}) windows on "CloseDate"::date and never bounds the raw "CloseDate".`)
  }
  if (fresh.length > 0) {
    console.error('')
    console.error('No close-date index can serve a test on the cast. Keep it for its meaning and add the raw range beside it:')
    console.error('  AND l."CloseDate" >= p_from::timestamptz AND l."CloseDate" < (p_to + 1)::timestamptz')
    console.error('(a date cast to timestamptz is midnight in the session time zone, the zone the ::date cast uses).')
  }
  for (const name of stale) {
    console.error(`FAIL: baseline entry ${name} no longer offends (or no longer exists); the baseline only shrinks, so delete it.`)
  }
  return 1
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main())

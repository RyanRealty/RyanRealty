import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { RESEND_TIMELINE_KIND } from '@/lib/crm/resend-webhook'

/**
 * A CHECK constraint is a closed vocabulary the app has to stay inside, and
 * the app can drift out of it without a single test failing: the writer gets a
 * new word, the constraint is never told, and Postgres refuses the row while
 * the caller reads `error` as nothing. That is how 418 crm_timeline rows and 94
 * sync_history rows a day were lost (2026-10-15):
 *   - email_delivered / email_bounce / email_complaint / email_unsubscribe
 *     (Resend webhook) and cma_replied (CMA reply stamp) were never added to
 *     crm_timeline_kind_check;
 *   - 'delta' was added to sync_history_run_type_check by a back-dated
 *     migration file the hosted apply skipped.
 *
 * This test reads the NEWEST migration that defines each constraint and fails
 * when a value the code writes is not in it. It sees literal values (and a
 * constant defined in the same file); a value built at runtime is out of reach
 * and still has to be reasoned about by whoever adds it.
 *
 * What it does NOT catch: a migration file that exists but never reached
 * production. 20260809191000_sync_history_delta_run_type.sql defined 'delta'
 * and this test would have passed on it; the hosted apply skipped it because
 * its version was older than what production had already applied. A new
 * constraint change therefore needs a version newer than every applied one.
 */
const ROOT = path.resolve(__dirname, '../..')
const MIGRATIONS = path.join(ROOT, 'supabase/migrations')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(full)
  }
  return out
}

/** The quoted words of the list in the newest `add constraint <name>` in migrations. */
function newestVocabulary(constraint: string, listAfter: RegExp): { file: string; words: Set<string> } {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (let i = files.length - 1; i >= 0; i--) {
    const sql = readFileSync(path.join(MIGRATIONS, files[i]), 'utf8')
    const at = sql.search(new RegExp(`add\\s+constraint\\s+${constraint}\\b`, 'i'))
    if (at < 0) continue
    const tail = sql.slice(at)
    const m = tail.match(listAfter)
    if (!m) continue
    const words = new Set([...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]))
    return { file: files[i], words }
  }
  throw new Error(`no migration defines ${constraint}`)
}

describe('crm_timeline_kind_check covers every kind the code writes', () => {
  const { file, words } = newestVocabulary('crm_timeline_kind_check', /array\s*\[([\s\S]*?)\]/i)

  // `.from('crm_timeline').insert|upsert(` followed within the same call by `kind: 'x'`
  // or `kind: SOME_CONST` (resolved from `const SOME_CONST = 'x'` in the same file).
  const written = new Map<string, Set<string>>()
  for (const full of [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'lib'))]) {
    const src = readFileSync(full, 'utf8')
    if (!src.includes('crm_timeline')) continue
    for (const m of src.matchAll(/from\(\s*['"]crm_timeline['"]\s*\)\s*\.(?:insert|upsert)\(/g)) {
      const call = src.slice(m.index! + m[0].length, m.index! + m[0].length + 900)
      const rel = path.relative(ROOT, full)
      for (const k of call.matchAll(/\bkind:\s*'([a-z_]+)'/g)) {
        ;(written.get(rel) ?? written.set(rel, new Set()).get(rel)!).add(k[1])
      }
      for (const k of call.matchAll(/\bkind:\s*([A-Z][A-Z0-9_]+)\s*[,}\n]/g)) {
        const def = src.match(new RegExp(`const\\s+${k[1]}\\s*=\\s*'([a-z_]+)'`))
        if (def) (written.get(rel) ?? written.set(rel, new Set()).get(rel)!).add(def[1])
      }
    }
  }

  it('found the writers (a broken scan must not pass for a clean one)', () => {
    const all = new Set([...written.values()].flatMap((s) => [...s]))
    for (const k of ['email_out', 'sms_out', 'system', 'email_bounce', 'cma_replied']) {
      expect(all.has(k), `scan no longer sees kind '${k}'`).toBe(true)
    }
    expect(words.has('note') && words.has('email_out'), 'migration list did not parse').toBe(true)
  })

  it(`every literal kind written to crm_timeline is in ${file}`, () => {
    const missing: string[] = []
    for (const [rel, kinds] of written) {
      for (const k of kinds) if (!words.has(k)) missing.push(`${rel} writes kind '${k}'`)
    }
    expect(
      missing,
      `crm_timeline_kind_check (newest definition: ${file}) refuses these. Add a NEW migration that recreates the constraint with the value (newer than every file in supabase/migrations):\n${missing.join('\n')}`,
    ).toEqual([])
  })

  it('every kind the Resend webhook can write is in the constraint', () => {
    const missing = Object.entries(RESEND_TIMELINE_KIND)
      .filter(([, kind]) => !words.has(kind))
      .map(([event, kind]) => `${event} -> ${kind}`)
    expect(missing, `Resend event kinds missing from ${file}`).toEqual([])
  })
})

describe('sync_history_run_type_check covers every run type the code records', () => {
  const { file, words } = newestVocabulary('sync_history_run_type_check', /\bin\s*\(([^)]*)\)/i)

  it('SyncRunType (app/actions/sync-history.ts) is inside the newest definition', () => {
    const src = readFileSync(path.join(ROOT, 'app/actions/sync-history.ts'), 'utf8')
    const union = src.match(/export type SyncRunType =([^\n]+)/)
    expect(union, 'SyncRunType declaration not found').not.toBeNull()
    const types = [...union![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    expect(types).toContain('delta')
    const missing = types.filter((t) => !words.has(t))
    expect(
      missing,
      `sync_history_run_type_check (newest definition: ${file}) refuses these. Add a NEW migration, newer than every applied version, that recreates it:`,
    ).toEqual([])
  })

  it('every literal runType passed to recordSyncRun is allowed', () => {
    const missing: string[] = []
    let seen = 0
    for (const full of [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'lib'))]) {
      const src = readFileSync(full, 'utf8')
      if (!src.includes('recordSyncRun(')) continue
      for (const m of src.matchAll(/recordSyncRun\(\s*\{[\s\S]{0,200}?\brunType:\s*'([a-z_]+)'/g)) {
        seen++
        if (!words.has(m[1])) missing.push(`${path.relative(ROOT, full)} records run_type '${m[1]}'`)
      }
    }
    expect(seen, 'scan no longer sees any recordSyncRun call').toBeGreaterThan(1)
    expect(missing).toEqual([])
  })
})

/**
 * Environment loading that behaves the same on the Mac mini and on a cloud VM.
 *
 * The rule: REAL environment variables always win. `.env.local` is a local
 * convenience, not a requirement. A cloud session has no `.env.local` at all —
 * its secrets come from the environment's variable list — so any script that
 * does `readFileSync('.env.local')` crashes there. Use this instead.
 *
 *   import { loadEnv, requireEnv } from '../lib/platform/env.mjs'
 *   await loadEnv()
 *   const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Repo root, resolved from this file — never a hardcoded /Users path. */
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

let loaded = false

/**
 * Merge `.env.local` into process.env WITHOUT overwriting anything already set.
 * Missing file is not an error — that is the normal cloud case.
 *
 * @param {string} [file] optional explicit path, defaults to <repoRoot>/.env.local
 * @returns {Promise<{source: 'env-only'|'dotenv', added: number}>}
 */
export async function loadEnv(file) {
  if (loaded && !file) return { source: 'cached', added: 0 }
  const target = file ?? path.join(repoRoot, '.env.local')
  const raw = await fs.readFile(target, 'utf8').catch(() => null)
  if (raw === null) {
    loaded = true
    return { source: 'env-only', added: 0 }
  }

  let added = 0
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    // Strip surrounding quotes. Cloud environment variables are stored raw, so
    // this keeps both sources producing the same value for the same key.
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (process.env[k] === undefined) {
      process.env[k] = v
      added++
    }
  }
  loaded = true
  return { source: 'dotenv', added }
}

/** Read a required variable, failing loudly with the name rather than a null deref. */
export function requireEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required environment variable: ${name}`)
  return v
}

/** Read an optional variable with a default. */
export function env(name, fallback = undefined) {
  return process.env[name] ?? fallback
}

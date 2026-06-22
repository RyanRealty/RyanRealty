import { describe, it, expect, afterEach } from 'vitest'
import {
  EnvSchema,
  requiredForBuild,
  requiredForRuntime,
  optional,
  validateEnv,
  validateEnvRuntime,
  getValidatedEnv,
} from './env'

// Save/restore every env key the schema knows about so these tests can mutate
// process.env freely without leaking into other suites.
const ALL_KEYS = Object.keys(EnvSchema.shape)
const saved: Record<string, string | undefined> = {}
for (const k of ALL_KEYS) saved[k] = process.env[k]

afterEach(() => {
  for (const k of ALL_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

function setAll(value = 'x') {
  for (const k of ALL_KEYS) process.env[k] = value
}

describe('env partition coverage guard (Stage-2 prerequisite)', () => {
  it('classifies every EnvSchema key into exactly one of build/runtime/optional', () => {
    const listed = [...requiredForBuild, ...requiredForRuntime, ...optional]
    // No key appears in two lists.
    expect(new Set(listed).size).toBe(listed.length)
    // The three lists exactly cover the schema keys (no orphan, no stray).
    expect(new Set(listed)).toEqual(new Set(ALL_KEYS))
  })

  it('lists only keys that exist in the schema', () => {
    for (const k of [...requiredForBuild, ...requiredForRuntime, ...optional]) {
      expect(ALL_KEYS).toContain(k)
    }
  })
})

describe('validateEnv (build-required)', () => {
  it('ok when both build-required vars are set', () => {
    setAll()
    const r = validateEnv()
    expect(r.ok).toBe(true)
    expect(r.missing).toEqual([])
  })

  it('reports the missing build-required var', () => {
    setAll()
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const r = validateEnv()
    expect(r.ok).toBe(false)
    expect(r.missing).toContain('NEXT_PUBLIC_SUPABASE_URL')
    // Runtime-only vars must NOT be required at build.
    expect(r.missing).not.toContain('SPARK_API_KEY')
  })
})

describe('validateEnvRuntime (build + runtime required)', () => {
  it('ok when build + runtime vars are set', () => {
    setAll()
    expect(validateEnvRuntime().ok).toBe(true)
  })

  it('reports a missing runtime-required var', () => {
    setAll()
    delete process.env.SPARK_API_KEY
    const r = validateEnvRuntime()
    expect(r.ok).toBe(false)
    expect(r.missing).toContain('SPARK_API_KEY')
  })
})

describe('getValidatedEnv', () => {
  it('never throws on a partial environment', () => {
    for (const k of ALL_KEYS) delete process.env[k]
    expect(() => getValidatedEnv()).not.toThrow()
    expect(typeof getValidatedEnv()).toBe('object')
  })
})

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { canonicalJson, hashFile, hashJson, sha256Hex } from './canonical'

describe('canonicalJson', () => {
  it('sorts keys at every level and writes no whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { y: 1, x: 2 }], c: 'z' } })).toBe('{"a":{"c":"z","d":[3,{"x":2,"y":1}]},"b":1}')
  })

  it('gives the same bytes whatever order the keys were written in', () => {
    expect(hashJson({ a: 1, b: [1, 2] })).toBe(hashJson({ b: [1, 2], a: 1 }))
    expect(hashJson({ a: 1 })).not.toBe(hashJson({ a: 2 }))
  })

  it('drops an undefined key, and refuses what JSON cannot carry', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}')
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(/not a JSON number/)
    expect(() => canonicalJson([1, undefined])).toThrow(/undefined inside an array/)
    expect(() => canonicalJson({ f: () => 1 })).toThrow(/not JSON/)
  })

  it('hashes a string as its sha256', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('hashFile', () => {
  it('hashes a file and answers null for one that is not there', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rr-canon-'))
    try {
      writeFileSync(join(dir, 'a.txt'), 'abc')
      expect(hashFile(join(dir, 'a.txt'))).toBe(sha256Hex('abc'))
      expect(hashFile(join(dir, 'missing.txt'))).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

/**
 * lib/content/process/canonical.ts - the one way a stamp hashes anything.
 *
 * canonicalJson writes a value with its keys sorted and no spaces, so the same
 * data always has the same bytes whatever order a file listed its keys in.
 * Every hash in a stamp (inputsSha256, outputsSha256, rulesVersion) is the
 * sha256 of canonical JSON or of a file's own bytes.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

/** JSON with sorted keys and no whitespace. Throws on a value JSON cannot carry (a function, NaN, an undefined array item). */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value)
    case 'number':
      if (!Number.isFinite(value)) throw new Error(`canonicalJson: ${value} is not a JSON number`)
      return JSON.stringify(value)
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value
          .map((v) => {
            if (v === undefined) throw new Error('canonicalJson: undefined inside an array')
            return canonicalJson(v)
          })
          .join(',')}]`
      }
      const o = value as Record<string, unknown>
      return `{${Object.keys(o)
        .filter((k) => o[k] !== undefined)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
        .join(',')}}`
    }
    default:
      throw new Error(`canonicalJson: a ${typeof value} is not JSON`)
  }
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

/** The sha256 of a value's canonical JSON. */
export function hashJson(value: unknown): string {
  return sha256Hex(canonicalJson(value))
}

/** The sha256 of a file's bytes, or null when it cannot be read. */
export function hashFile(path: string): string | null {
  try {
    return sha256Hex(readFileSync(path))
  } catch {
    return null
  }
}

/**
 * Encrypt-at-rest for the raw e-signature token so a later send can re-use the
 * SAME signing link instead of minting a new one and killing the link already
 * emailed (tc_envelope_recipients.auth_token_hash is one-way sha256 — it can
 * confirm a token that comes back in, never reproduce the token that went out).
 *
 * AES-256-GCM. The key is HKDF-SHA256-derived from an env secret so no new key
 * material has to be provisioned: SIGNING_TOKEN_KEY when set, else the service
 * role key already trusted for every other server-only TC operation. The fixed
 * info string domain-separates this from any other HKDF use of the same
 * secret, so a derived signing-token key can never collide with a key some
 * other feature derives from the same input.
 *
 * Server-only: never imported by the public signing page or any client code.
 */
import 'server-only'

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const KEY_LEN = 32 // bytes (AES-256)
const IV_LEN = 12 // bytes (96-bit GCM nonce, the standard size)
const TAG_LEN = 16 // bytes (GCM auth tag)
const HKDF_INFO = 'rr-signing-token-v1'
const FORMAT_VERSION = 'v1'

function sourceSecret(): string {
  const dedicated = process.env.SIGNING_TOKEN_KEY?.trim()
  if (dedicated) return dedicated
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (serviceRole) return serviceRole
  throw new Error(
    'signing-token-vault: neither SIGNING_TOKEN_KEY nor SUPABASE_SERVICE_ROLE_KEY is set',
  )
}

/**
 * Derives the AES key fresh on every call (never memoized) — a key rotation
 * only needs a new env var, not a redeploy-and-clear-cache dance, and it keeps
 * the derivation testable (set the env, call, done).
 */
function deriveKey(): Buffer {
  const ikm = Buffer.from(sourceSecret(), 'utf8')
  const info = Buffer.from(HKDF_INFO, 'utf8')
  return Buffer.from(hkdfSync('sha256', ikm, Buffer.alloc(0), info, KEY_LEN))
}

/**
 * Encrypt a raw signing token for storage. Format: `v1.<iv>.<ciphertext+tag>`,
 * both segments base64url so the column is a plain single-line string.
 */
export function sealSigningToken(token: string): string {
  const key = deriveKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  const payload = Buffer.concat([ciphertext, authTag])
  return [FORMAT_VERSION, iv.toString('base64url'), payload.toString('base64url')].join('.')
}

/**
 * Decrypt a sealed token. Never throws — a bad format, a tampered payload, a
 * key that no longer matches (rotated SIGNING_TOKEN_KEY, wrong env), or an
 * unrecognized format version all come back null so a caller can fall through
 * to minting a fresh token instead of 500ing.
 */
export function openSigningToken(enc: string | null | undefined): string | null {
  if (!enc) return null
  try {
    const parts = enc.split('.')
    if (parts.length !== 3) return null
    const [version, ivB64, payloadB64] = parts
    if (version !== FORMAT_VERSION) return null
    const iv = Buffer.from(ivB64, 'base64url')
    const payload = Buffer.from(payloadB64, 'base64url')
    if (iv.length !== IV_LEN || payload.length <= TAG_LEN) return null
    const ciphertext = payload.subarray(0, payload.length - TAG_LEN)
    const authTag = payload.subarray(payload.length - TAG_LEN)
    const key = deriveKey()
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(authTag)
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return plain.toString('utf8')
  } catch {
    return null
  }
}

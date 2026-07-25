/**
 * web-push — VAPID (RFC 8292) + aes128gcm payload encryption (RFC 8291 over
 * RFC 8188), implemented on node:crypto with no third-party dependency.
 *
 * Why hand-rolled: the `web-push` npm package would be the obvious choice, but
 * adding a runtime dependency for ~150 lines of standard-library crypto buys a
 * supply-chain surface we don't need. Every primitive used here (ECDH P-256,
 * HMAC-SHA256, AES-128-GCM, ES256 signing) ships with Node.
 *
 * Correctness is not asserted by inspection — web-push.test.ts round-trips a
 * real encryption through a real UA keypair and decrypts it back, which is only
 * possible if every HKDF label, info block, and byte offset below is right.
 *
 * Wire format produced by encryptPayload (RFC 8188 §2.1, single record):
 *
 *   salt(16) | rs(4, BE) | idlen(1 = 65) | as_public(65) | ciphertext+tag
 *
 * Nothing in this module reads the queue or the database — it is pure crypto +
 * one fetch. The delivery policy lives in ./deliver.ts.
 */
import crypto from 'node:crypto'

/** Uncompressed P-256 point length (0x04 || X(32) || Y(32)). */
const P256_POINT_BYTES = 65
/** Single-record size. Broker alert bodies are <= 600 chars, so one record always suffices. */
const RECORD_SIZE = 4096
/** Max plaintext that fits one record: rs - 16 (GCM tag) - 1 (padding delimiter). */
export const MAX_PAYLOAD_BYTES = RECORD_SIZE - 16 - 1

export interface PushSubscriptionKeys {
  /** UA public key, base64url, uncompressed P-256 point. */
  p256dh: string
  /** UA auth secret, base64url, 16 bytes. */
  auth: string
}

export interface VapidConfig {
  publicKey: string
  privateKey: string
  subject: string
}

export function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

export function bufToB64url(b: Buffer): string {
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * The VAPID keypair from the environment, or null when it is not provisioned.
 *
 * Returning null is the DEGRADE signal: callers must surface "unconfigured"
 * rather than treating a missing key as "nothing to send". A silent no-op here
 * is exactly how a notification channel goes dark without anyone noticing.
 */
export function vapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? ''
  if (!publicKey.trim() || !privateKey.trim()) return null
  return {
    publicKey: publicKey.trim(),
    privateKey: privateKey.trim(),
    subject: (process.env.VAPID_SUBJECT ?? 'mailto:matt@ryan-realty.com').trim(),
  }
}

/** True when the browser can be handed a public key to subscribe with. */
export function vapidPublicKey(): string | null {
  const k = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
  return k.trim() ? k.trim() : null
}

/** Build a node KeyObject from the raw base64url VAPID keypair (JWK route). */
function vapidPrivateKeyObject(cfg: VapidConfig): crypto.KeyObject {
  const pub = b64urlToBuf(cfg.publicKey)
  if (pub.length !== P256_POINT_BYTES) {
    throw new Error(`VAPID public key must be ${P256_POINT_BYTES} raw bytes, got ${pub.length}`)
  }
  const d = b64urlToBuf(cfg.privateKey)
  if (d.length !== 32) throw new Error(`VAPID private key must be 32 raw bytes, got ${d.length}`)
  return crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: bufToB64url(pub.subarray(1, 33)),
      y: bufToB64url(pub.subarray(33, 65)),
      d: bufToB64url(d),
    },
    format: 'jwk',
  })
}

/**
 * `Authorization: vapid t=<ES256 JWT>, k=<public key>` for one push endpoint.
 * The JWT audience is the endpoint ORIGIN — a token minted for FCM is not
 * valid at Mozilla's autopush, so this is computed per send.
 */
export function vapidAuthorization(endpoint: string, cfg: VapidConfig, nowSec = Math.floor(Date.now() / 1000)): string {
  const aud = new URL(endpoint).origin
  const header = bufToB64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const body = bufToB64url(
    Buffer.from(JSON.stringify({ aud, exp: nowSec + 12 * 60 * 60, sub: cfg.subject })),
  )
  const signingInput = `${header}.${body}`
  const sig = crypto.sign('sha256', Buffer.from(signingInput), {
    key: vapidPrivateKeyObject(cfg),
    dsaEncoding: 'ieee-p1363', // raw r||s, what JWS ES256 requires (not DER)
  })
  return `vapid t=${signingInput}.${bufToB64url(sig)}, k=${cfg.publicKey}`
}

function hmac(key: Buffer, data: Buffer): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest()
}

/** HKDF-SHA256 with a single output block (every label here is <= 32 bytes out). */
function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, length: number): Buffer {
  const prk = hmac(salt, ikm)
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, length)
}

/** The RFC 8291 §3.3 combined-secret derivation, shared by encrypt and the test's decrypt. */
export function deriveContentKeys(params: {
  sharedSecret: Buffer
  authSecret: Buffer
  uaPublic: Buffer
  asPublic: Buffer
  salt: Buffer
}): { cek: Buffer; nonce: Buffer } {
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    params.uaPublic,
    params.asPublic,
  ])
  const ikm = hkdf(params.authSecret, params.sharedSecret, keyInfo, 32)
  return {
    cek: hkdf(params.salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16),
    nonce: hkdf(params.salt, ikm, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12),
  }
}

/** Encrypt one payload for one subscription. Returns the aes128gcm request body. */
export function encryptPayload(payload: string, keys: PushSubscriptionKeys): Buffer {
  const plaintextBody = Buffer.from(payload, 'utf8')
  if (plaintextBody.length > MAX_PAYLOAD_BYTES) {
    throw new Error(`push payload ${plaintextBody.length}B exceeds one-record max ${MAX_PAYLOAD_BYTES}B`)
  }
  const uaPublic = b64urlToBuf(keys.p256dh)
  if (uaPublic.length !== P256_POINT_BYTES) {
    throw new Error(`subscription p256dh must be ${P256_POINT_BYTES} bytes, got ${uaPublic.length}`)
  }
  const authSecret = b64urlToBuf(keys.auth)
  if (authSecret.length !== 16) {
    throw new Error(`subscription auth secret must be 16 bytes, got ${authSecret.length}`)
  }

  const ecdh = crypto.createECDH('prime256v1')
  ecdh.generateKeys()
  const asPublic = ecdh.getPublicKey()
  const sharedSecret = ecdh.computeSecret(uaPublic)
  const salt = crypto.randomBytes(16)
  const { cek, nonce } = deriveContentKeys({ sharedSecret, authSecret, uaPublic, asPublic, salt })

  // RFC 8188 §2: the final record is padded with a 0x02 delimiter.
  const plaintext = Buffer.concat([plaintextBody, Buffer.from([2])])
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()])

  const header = Buffer.alloc(5)
  header.writeUInt32BE(RECORD_SIZE, 0)
  header.writeUInt8(P256_POINT_BYTES, 4)
  return Buffer.concat([salt, header, asPublic, ciphertext])
}

export interface PushSendResult {
  ok: boolean
  status: number
  /** 404/410 — the subscription is dead and must be disabled, never retried. */
  gone: boolean
  error?: string
}

/** POST one encrypted payload to one push service endpoint. */
export async function sendWebPush(
  sub: { endpoint: string; keys: PushSubscriptionKeys },
  payload: string,
  cfg: VapidConfig,
  ttlSeconds = 86400,
): Promise<PushSendResult> {
  let body: Buffer
  let authorization: string
  try {
    body = encryptPayload(payload, sub.keys)
    authorization = vapidAuthorization(sub.endpoint, cfg)
  } catch (err) {
    return { ok: false, status: 0, gone: false, error: err instanceof Error ? err.message : 'encrypt failed' }
  }
  try {
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        TTL: String(ttlSeconds),
        Urgency: 'high',
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(body.length),
        Authorization: authorization,
      },
      body: new Uint8Array(body),
    })
    const gone = res.status === 404 || res.status === 410
    if (res.ok) return { ok: true, status: res.status, gone: false }
    return {
      ok: false,
      status: res.status,
      gone,
      error: `${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`,
    }
  } catch (err) {
    return { ok: false, status: 0, gone: false, error: err instanceof Error ? err.message : 'fetch failed' }
  }
}

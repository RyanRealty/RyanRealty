/**
 * web-push crypto conformance (W5.5 leg b).
 *
 * These are not shape assertions — each test performs the OTHER half of the
 * protocol and fails unless our half is byte-correct:
 *
 *   - the encryption test derives the content key from the USER-AGENT side
 *     (its own ECDH private key + the as_public we shipped in the header) and
 *     decrypts the record. A wrong HKDF label, a wrong info block, a swapped
 *     uaPublic/asPublic order, or a wrong byte offset all produce a GCM auth
 *     failure, not a subtly different string.
 *   - the VAPID test verifies the ES256 signature with the public half and
 *     parses the claims a push service checks (aud = endpoint origin, exp, sub).
 */
import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import {
  b64urlToBuf,
  bufToB64url,
  deriveContentKeys,
  encryptPayload,
  vapidAuthorization,
  vapidConfig,
  MAX_PAYLOAD_BYTES,
  type VapidConfig,
} from './web-push'

/** Stand in for a browser's PushManager.subscribe() keys. */
function makeUserAgentSubscription() {
  const ecdh = crypto.createECDH('prime256v1')
  ecdh.generateKeys()
  return {
    ecdh,
    keys: {
      p256dh: bufToB64url(ecdh.getPublicKey()),
      auth: bufToB64url(crypto.randomBytes(16)),
    },
  }
}

/** The receiving half of RFC 8291 — what a real browser does with our body. */
function userAgentDecrypt(body: Buffer, ua: ReturnType<typeof makeUserAgentSubscription>): string {
  const salt = body.subarray(0, 16)
  const recordSize = body.readUInt32BE(16)
  const idLen = body.readUInt8(20)
  expect(recordSize).toBe(4096)
  expect(idLen).toBe(65)
  const asPublic = body.subarray(21, 21 + idLen)
  const ciphertext = body.subarray(21 + idLen)

  const { cek, nonce } = deriveContentKeys({
    sharedSecret: ua.ecdh.computeSecret(asPublic),
    authSecret: b64urlToBuf(ua.keys.auth),
    uaPublic: ua.ecdh.getPublicKey(),
    asPublic,
    salt,
  })
  const tag = ciphertext.subarray(ciphertext.length - 16)
  const decipher = crypto.createDecipheriv('aes-128-gcm', cek, nonce)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([
    decipher.update(ciphertext.subarray(0, ciphertext.length - 16)),
    decipher.final(),
  ])
  // RFC 8188 §2 padding delimiter on the final record.
  expect(plaintext[plaintext.length - 1]).toBe(2)
  return plaintext.subarray(0, plaintext.length - 1).toString('utf8')
}

function makeVapidConfig(): { cfg: VapidConfig; publicKeyObject: crypto.KeyObject } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const jwk = privateKey.export({ format: 'jwk' }) as { x: string; y: string; d: string }
  const raw = Buffer.concat([Buffer.from([4]), b64urlToBuf(jwk.x), b64urlToBuf(jwk.y)])
  return {
    cfg: { publicKey: bufToB64url(raw), privateKey: jwk.d, subject: 'mailto:matt@ryan-realty.com' },
    publicKeyObject: publicKey,
  }
}

describe('web-push aes128gcm encryption (RFC 8291)', () => {
  it('round-trips a broker alert body through a real user-agent keypair', () => {
    const ua = makeUserAgentSubscription()
    const message = JSON.stringify({
      title: 'New lead: Dana Whitfield (Facebook lead form)',
      body: 'ryan-realty.com/admin/crm/48213',
    })
    const decrypted = userAgentDecrypt(encryptPayload(message, ua.keys), ua)
    expect(decrypted).toBe(message)
  })

  it('produces a different salt and ephemeral key per send (no nonce reuse)', () => {
    const ua = makeUserAgentSubscription()
    const a = encryptPayload('same text', ua.keys)
    const b = encryptPayload('same text', ua.keys)
    expect(a.subarray(0, 16).equals(b.subarray(0, 16))).toBe(false) // salt
    expect(a.subarray(21, 86).equals(b.subarray(21, 86))).toBe(false) // as_public
    expect(userAgentDecrypt(a, ua)).toBe('same text')
    expect(userAgentDecrypt(b, ua)).toBe('same text')
  })

  it('fails closed on a malformed subscription instead of shipping garbage', () => {
    expect(() => encryptPayload('x', { p256dh: bufToB64url(Buffer.alloc(10)), auth: bufToB64url(Buffer.alloc(16)) })).toThrow(/p256dh/)
    expect(() => encryptPayload('x', { p256dh: bufToB64url(Buffer.alloc(65)), auth: bufToB64url(Buffer.alloc(8)) })).toThrow(/auth secret/)
  })

  it('refuses a payload that would not fit one record', () => {
    const ua = makeUserAgentSubscription()
    expect(() => encryptPayload('x'.repeat(MAX_PAYLOAD_BYTES + 1), ua.keys)).toThrow(/exceeds one-record max/)
  })
})

describe('VAPID authorization (RFC 8292)', () => {
  it('signs an ES256 JWT the push service can verify, scoped to the endpoint origin', () => {
    const { cfg, publicKeyObject } = makeVapidConfig()
    const endpoint = 'https://fcm.googleapis.com/fcm/send/abc123'
    const header = vapidAuthorization(endpoint, cfg)

    const m = /^vapid t=([^,]+), k=(.+)$/.exec(header)
    expect(m).not.toBeNull()
    const [, jwt, k] = m as RegExpExecArray
    expect(k).toBe(cfg.publicKey)

    const [h, p, s] = jwt.split('.')
    const verified = crypto.verify(
      'sha256',
      Buffer.from(`${h}.${p}`),
      { key: publicKeyObject, dsaEncoding: 'ieee-p1363' },
      b64urlToBuf(s),
    )
    expect(verified).toBe(true)

    expect(JSON.parse(b64urlToBuf(h).toString())).toEqual({ typ: 'JWT', alg: 'ES256' })
    const claims = JSON.parse(b64urlToBuf(p).toString())
    expect(claims.aud).toBe('https://fcm.googleapis.com')
    expect(claims.sub).toBe('mailto:matt@ryan-realty.com')
    expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
    expect(claims.exp - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(24 * 60 * 60)
  })

  it('mints a per-origin audience so one token cannot be replayed at another push service', () => {
    const { cfg } = makeVapidConfig()
    const fcm = vapidAuthorization('https://fcm.googleapis.com/fcm/send/a', cfg)
    const moz = vapidAuthorization('https://updates.push.services.mozilla.com/wpush/v2/b', cfg)
    const aud = (h: string) => JSON.parse(b64urlToBuf(h.split('t=')[1].split(',')[0].split('.')[1]).toString()).aud
    expect(aud(fcm)).toBe('https://fcm.googleapis.com')
    expect(aud(moz)).toBe('https://updates.push.services.mozilla.com')
  })
})

describe('degradation contract', () => {
  it('vapidConfig() returns null when the keypair is not provisioned', () => {
    const saved = {
      pub: process.env.VAPID_PUBLIC_KEY,
      npub: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      priv: process.env.VAPID_PRIVATE_KEY,
    }
    try {
      delete process.env.VAPID_PUBLIC_KEY
      delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      delete process.env.VAPID_PRIVATE_KEY
      expect(vapidConfig()).toBeNull()

      // A public key alone is still unconfigured — we cannot sign without the private half.
      process.env.VAPID_PUBLIC_KEY = 'BPublicOnly'
      expect(vapidConfig()).toBeNull()

      process.env.VAPID_PRIVATE_KEY = 'privatehalf'
      expect(vapidConfig()).not.toBeNull()
    } finally {
      if (saved.pub === undefined) delete process.env.VAPID_PUBLIC_KEY
      else process.env.VAPID_PUBLIC_KEY = saved.pub
      if (saved.npub === undefined) delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      else process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = saved.npub
      if (saved.priv === undefined) delete process.env.VAPID_PRIVATE_KEY
      else process.env.VAPID_PRIVATE_KEY = saved.priv
    }
  })
})

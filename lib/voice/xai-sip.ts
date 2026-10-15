import { createHmac, timingSafeEqual } from 'node:crypto'

/** Standard Webhooks signature check for xAI `realtime.call.incoming` events. */
export function verifyXaiWebhook(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers
  if (!secret || !id || !timestamp || !signature) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > 300) return false
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest()
  return signature.split(' ').some((part) => {
    const sig = part.includes(',') ? part.split(',')[1] : part
    const got = Buffer.from(sig ?? '', 'base64')
    return got.length === expected.length && timingSafeEqual(got, expected)
  })
}

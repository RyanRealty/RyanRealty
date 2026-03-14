/**
 * Web push subscriptions and send. Step 22 Task 5.
 * Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in env.
 * Use subscribeToPush() from client after permission; store subscription in push_subscriptions via API.
 */

export interface PushKeys {
  p256dh: string
  auth: string
}

export interface PushSubscriptionPayload {
  endpoint: string
  keys: PushKeys
  user_id?: string
}

/**
 * Request notification permission and subscribe to push.
 * Returns the subscription object to send to your API for storing in push_subscriptions.
 */
export async function subscribeToPush(): Promise<PushSubscriptionPayload | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!key?.trim()) return null

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    })

    const keys = sub.getKey('p256dh')
    const auth = sub.getKey('auth')
    if (!keys || !auth) return null

    return {
      endpoint: sub.endpoint,
      keys: {
        p256dh: bufferToBase64(keys),
        auth: bufferToBase64(auth),
      },
    }
  } catch {
    return null
  }
}

function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(raw)
  const buf = new ArrayBuffer(bin.length)
  const out = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bufferToBase64(arr: Uint8Array | ArrayBuffer): string {
  const view = arr instanceof ArrayBuffer ? new Uint8Array(arr) : arr
  return btoa(String.fromCharCode(...view))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

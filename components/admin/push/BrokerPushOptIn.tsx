'use client'

/**
 * BrokerPushOptIn — the broker-facing control for the durable web-push alert
 * channel (W5.5 leg b). Mounted on /admin/settings next to the SMS toggle.
 *
 * What it does, in order:
 *   1. registers /sw.js (the push service worker, root scope)
 *   2. asks for notification permission on an explicit click, never on load
 *   3. subscribes with the VAPID public key served by /api/push/subscribe
 *   4. POSTs the endpoint + keys to that route, which files it under the
 *      signed-in broker
 *
 * It never claims the channel is live when it is not: if the deployment has no
 * VAPID keypair, the card says so and the button stays disabled instead of
 * failing on click.
 */

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/admin/v2'
import { formatDate } from '@/lib/format/date'

const QUIET = { color: 'var(--a-text-2)' }

interface Device {
  endpoint: string
  label: string | null
  created_at: string
  last_success_at: string | null
}

interface State {
  broker: string | null
  configured: boolean
  vapidPublicKey: string | null
  reason: string | null
  devices: Device[]
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

function deviceLabel(): string {
  const ua = navigator.userAgent
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Device'
  const browser = /CriOS|Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'Browser'
  return `${os} ${browser}`
}

export default function BrokerPushOptIn() {
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [supported, setSupported] = useState(true)
  const [thisEndpoint, setThisEndpoint] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/push/subscribe', { cache: 'no-store' })
    if (!res.ok) return
    setState(await res.json())
  }, [])

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window,
    )
    void load()
    // Report whether THIS browser already holds a subscription, so the card can
    // say "this device is on" rather than only listing endpoints.
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistration('/')
        .then((reg) => reg?.pushManager.getSubscription())
        .then((sub) => setThisEndpoint(sub?.endpoint ?? null))
        .catch(() => setThisEndpoint(null))
    }
  }, [load])

  async function enable() {
    if (!state?.vapidPublicKey) return
    setBusy(true)
    setMessage(null)
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setMessage({ ok: false, text: 'Your browser blocked notifications. Allow them for ryan-realty.com and try again.' })
        return
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(state.vapidPublicKey) as BufferSource,
        }))
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, label: deviceLabel() }),
      })
      const payload = await res.json()
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? `register failed (${res.status})`)
      setThisEndpoint(json.endpoint ?? null)
      setMessage({ ok: true, text: 'This device will now receive lead alerts.' })
      await load()
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not turn on notifications.' })
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    setMessage(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/')
      const sub = await reg?.pushManager.getSubscription()
      const endpoint = sub?.endpoint ?? thisEndpoint
      if (sub) await sub.unsubscribe()
      if (endpoint) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        })
      }
      setThisEndpoint(null)
      setMessage({ ok: true, text: 'This device will no longer receive alerts.' })
      await load()
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not turn off notifications.' })
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const payload = await res.json()
      setMessage(
        payload.ok
          ? { ok: true, text: `Test sent to ${payload.delivered} of ${payload.devices} device(s).` }
          : { ok: false, text: payload.error ?? 'Test send failed.' },
      )
    } finally {
      setBusy(false)
    }
  }

  const enabledHere = Boolean(thisEndpoint && state?.devices.some((d) => d.endpoint === thisEndpoint))

  return (
    <div className="mt-8">
      {/* The shadcn <Separator> was a radix decorative rule; a hairline in the
          border token is the same thing in this language. */}
      <div className="mb-8 h-px w-full" style={{ background: 'var(--a-border)' }} role="none" />
      <h2 className="text-base font-semibold" style={{ color: 'var(--a-text)' }}>Push alerts on this device</h2>
      <p className="mt-1 text-sm" style={QUIET}>
        A lead alert arrives as a phone notification, from the same queue that sends the text. It keeps working when the
        text channel is off.
      </p>

      {!supported ? (
        <p className="mt-4 text-sm" style={QUIET}>
          This browser does not support push notifications. On iPhone, add the site to your Home Screen first.
        </p>
      ) : !state ? (
        <p className="mt-4 text-sm" style={QUIET}>Checking this device.</p>
      ) : !state.broker ? (
        <p className="mt-4 text-sm" style={QUIET}>
          Alerts are routed per broker and this account has no broker profile.
        </p>
      ) : !state.configured ? (
        <p className="mt-4 text-sm" style={QUIET}>{state.reason}</p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {enabledHere ? (
              <>
                <Button type="button" variant="quiet" onClick={disable} disabled={busy}>
                  Turn off on this device
                </Button>
                <Button type="button" variant="quiet" onClick={sendTest} disabled={busy}>
                  Send a test
                </Button>
              </>
            ) : (
              <Button type="button" onClick={enable} disabled={busy}>
                Turn on alerts here
              </Button>
            )}
          </div>
          {state.devices.length > 0 && (
            <ul className="text-sm" style={QUIET}>
              {state.devices.map((d) => (
                <li key={d.endpoint} className="tabular-nums">
                  {d.label ?? 'Device'}
                  {d.endpoint === thisEndpoint ? ' (this device)' : ''}
                  {d.last_success_at ? ` · last alert ${formatDate(d.last_success_at)}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {message && (
        <p className="mt-3 text-sm" style={{ color: message.ok ? 'var(--a-ok)' : 'var(--a-danger)' }}>{message.text}</p>
      )}
    </div>
  )
}

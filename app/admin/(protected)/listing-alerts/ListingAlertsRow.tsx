'use client'

/**
 * Inline admin actions for a listing-alerts subscriber row.
 *
 * Calls the existing /api/listing-alerts/* endpoints to pause / unpause /
 * unsubscribe / re-trigger the digest for a single subscriber.
 */
import * as React from 'react'

import { Button } from '@/components/ui/button'

type Status = 'active' | 'paused' | 'unsubscribed'

export function ListingAlertsRow({
  alertId,
  email,
  status,
}: {
  alertId: string
  email: string
  status: Status
}) {
  const [busy, setBusy] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function pause() {
    setBusy('pause')
    setError(null)
    try {
      const res = await fetch('/api/listing-alerts/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reason: 'admin-manual-pause', duration_days: 14 }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDone('Paused (refresh to see)')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pause failed')
    } finally {
      setBusy(null)
    }
  }

  async function unsubscribe() {
    if (!confirm(`Unsubscribe ${email} from listing alerts?`)) return
    setBusy('unsub')
    setError(null)
    try {
      const res = await fetch('/api/listing-alerts/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alertId, status: 'unsubscribed' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDone('Unsubscribed (refresh)')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unsubscribe failed')
    } finally {
      setBusy(null)
    }
  }

  async function reactivate() {
    setBusy('reactivate')
    setError(null)
    try {
      const res = await fetch('/api/listing-alerts/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: alertId,
          status: 'active',
          paused_until: null,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDone('Reactivated (refresh)')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reactivate failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex justify-end gap-2">
      {status === 'active' && (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={pause}
            disabled={busy !== null}
          >
            {busy === 'pause' ? 'Pausing…' : 'Pause 14d'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={unsubscribe}
            disabled={busy !== null}
          >
            {busy === 'unsub' ? 'Unsub…' : 'Unsub'}
          </Button>
        </>
      )}
      {status === 'paused' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={reactivate}
          disabled={busy !== null}
        >
          {busy === 'reactivate' ? 'Reactivating…' : 'Reactivate'}
        </Button>
      )}
      {status === 'unsubscribed' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={reactivate}
          disabled={busy !== null}
        >
          {busy === 'reactivate' ? 'Resubscribing…' : 'Resubscribe'}
        </Button>
      )}
      {done && <span className="text-xs text-success">{done}</span>}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

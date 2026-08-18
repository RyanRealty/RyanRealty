'use client'

/**
 * TriggerDeltaSyncButton — one-shot "Run ingest now" on the sync advanced panel.
 *
 * 11F: taken off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — the POST to
 * /api/admin/sync/delta (live runDeltaSync, same core as /api/cron/sync-delta),
 * the loading latch, and the success/error message shape. The shadcn
 * success-green Button becomes the v2 primary Button (color is reserved for
 * status, not chrome); message colours map to var(--a-ok) / var(--a-danger).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/admin/v2'

export default function TriggerDeltaSyncButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleClick() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/sync/delta', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ type: 'error', text: (data.error as string) || `HTTP ${res.status}` })
        return
      }
      const text =
        (typeof data.summary === 'string' && data.summary) ||
        (typeof data.message === 'string' && data.message) ||
        'Delta sync completed'
      setMessage({ type: data.ok === false ? 'error' : 'success', text })
      router.refresh()
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Request failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button type="button" onClick={handleClick} disabled={loading}>
        {loading ? 'Syncing…' : 'Run ingest now'}
      </Button>
      {message && (
        <span
          style={{
            fontSize: 'var(--a-text-sm)',
            color: message.type === 'success' ? 'var(--a-ok)' : 'var(--a-danger)',
          }}
        >
          {message.text}
        </span>
      )}
    </div>
  )
}

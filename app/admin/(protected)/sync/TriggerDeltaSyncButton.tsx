'use client'

/**
 * TriggerDeltaSyncButton — one-shot "Run ingest now" on the sync advanced panel.
 *
 * 11F: taken off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — the POST to
 * /api/admin/sync/delta, the loading latch, the success/error message shape and
 * every string are untouched. The shadcn success-green Button becomes the v2
 * primary Button (color is reserved for status, not chrome); message colours
 * map to var(--a-ok) / var(--a-danger).
 */

import { useState } from 'react'
import { Button } from '@/components/admin/v2'

export default function TriggerDeltaSyncButton() {
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
      setMessage({ type: 'success', text: 'Delta sync triggered. It may take a minute to appear in the log.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Request failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button type="button" onClick={handleClick} disabled={loading}>
        {loading ? 'Starting…' : 'Run ingest now'}
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

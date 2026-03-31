'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"

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
      <Button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-success-foreground hover:bg-success/85 disabled:opacity-50"
      >
        {loading ? 'Starting…' : 'Run ingest now'}
      </Button>
      {message && (
        <span className={message.type === 'success' ? 'text-sm text-success' : 'text-sm text-destructive'}>
          {message.text}
        </span>
      )}
    </div>
  )
}

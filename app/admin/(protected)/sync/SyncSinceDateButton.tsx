'use client'

/**
 * SyncSinceDateButton — date-bounded delta sync on the advanced panel.
 *
 * 11F: taken off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — runDeltaSyncSince,
 * date→ISO conversion, the loading latch, router.refresh() and every string
 * are untouched. Input/Label/Button → SearchField (compact toolbar date) +
 * plain label + v2 Button. Success/error map to var(--a-ok) / var(--a-danger).
 */

import { useState } from 'react'
import { runDeltaSyncSince } from '@/app/actions/sync-full-cron'
import { useRouter } from 'next/navigation'
import { Button, SearchField } from '@/components/admin/v2'

function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateToStartOfDayIso(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00.000Z')
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}

const DEFAULT_DAYS_AGO = 2

export default function SyncSinceDateButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const defaultDate = toLocalDateString(new Date(Date.now() - DEFAULT_DAYS_AGO * 24 * 60 * 60 * 1000))
  const [dateValue, setDateValue] = useState(defaultDate)

  async function handleClick() {
    const sinceIso = dateToStartOfDayIso(dateValue)
    if (!sinceIso) {
      setMessage({ type: 'error', text: 'Please pick a valid date.' })
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const res = await runDeltaSyncSince(sinceIso)
      if (!res.ok) {
        setMessage({ type: 'error', text: res.error ?? res.message })
        return
      }
      setMessage({ type: 'success', text: res.message })
      router.refresh()
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Request failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        <span>Sync changes since:</span>
        <SearchField
          type="date"
          aria-label="Sync changes since date"
          value={dateValue}
          onChange={(e) => setDateValue(e.target.value)}
          disabled={loading}
        />
      </label>
      <Button type="button" onClick={handleClick} disabled={loading}>
        {loading ? 'Syncing…' : 'Sync since this date'}
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

'use client'

import { useState } from 'react'
import { runDeltaSyncSince } from '@/app/actions/sync-full-cron'
import { useRouter } from 'next/navigation'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

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
      <Label className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Sync changes since:</span>
        <Input
          type="date"
          value={dateValue}
          onChange={(e) => setDateValue(e.target.value)}
          disabled={loading}
          className="rounded border border-border px-2 py-1.5 text-sm disabled:opacity-50"
        />
      </Label>
      <Button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary disabled:opacity-50"
      >
        {loading ? 'Syncing…' : 'Sync since this date'}
      </Button>
      {message && (
        <span className={message.type === 'success' ? 'text-sm text-success' : 'text-sm text-destructive'}>
          {message.text}
        </span>
      )}
    </div>
  )
}

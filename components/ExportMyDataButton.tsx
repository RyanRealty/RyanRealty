'use client'

import { useState } from 'react'
import { exportMyData } from '@/app/actions/export-my-data'
import { Button } from "@/components/ui/button"

type Props = { className?: string }

export default function ExportMyDataButton({ className }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setError(null)
    setLoading(true)
    try {
      const result = await exportMyData()
      if ('error' in result) {
        setError(result.error)
        return
      }
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ryan-realty-data-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        {loading ? 'Preparing…' : 'Export my data (JSON)'}
      </Button>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  )
}

'use client'

import { useState } from 'react'
import Image from 'next/image'

const STYLES = [
  { id: 'modern', label: 'Modern' },
  { id: 'warm', label: 'Warm' },
  { id: 'staged', label: 'Staged' },
  { id: 'mountain', label: 'Mountain' },
] as const

type Props = {
  photoUrl: string
  listingKey: string
}

export function RoomRestyle({ photoUrl, listingKey }: Props) {
  const [style, setStyle] = useState<(typeof STYLES)[number]['id']>('modern')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [disclaimer, setDisclaimer] = useState('')

  async function run() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/room-restyle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: photoUrl, style, listingKey }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        url?: string | null
        dataUrl?: string | null
        disclaimer?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        setError(data.error || 'Could not restyle this photo.')
        return
      }
      setResultUrl(data.url || data.dataUrl || null)
      setDisclaimer(data.disclaimer || '')
    } catch {
      setError('Could not restyle this photo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Imagine this room
      </p>
      <p className="mt-1 text-sm text-foreground">
        AI visualization from this listing photo. Not the listed condition.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStyle(s.id)}
            className={
              style === s.id
                ? 'border border-primary bg-primary px-3 py-1.5 text-xs text-primary-foreground'
                : 'border border-border px-3 py-1.5 text-xs'
            }
          >
            {s.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="mt-3 border border-primary bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Restyle photo'}
      </button>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {resultUrl ? (
        <div className="mt-4 space-y-2">
          <div className="relative aspect-[4/3] w-full overflow-hidden border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resultUrl} alt="AI restyled room visualization" className="h-full w-full object-cover" />
          </div>
          <p className="text-xs text-muted-foreground">{disclaimer}</p>
        </div>
      ) : null}
      {!resultUrl && photoUrl ? (
        <div className="relative mt-4 aspect-[4/3] w-full overflow-hidden border border-border opacity-80">
          <Image src={photoUrl} alt="Original listing photo" fill className="object-cover" unoptimized />
        </div>
      ) : null}
    </div>
  )
}

'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import VoiceSearchButton from '@/components/VoiceSearchButton'
import { searchHrefForQuery } from '@/lib/parse-search-query'

export function HoodDSearch({
  placeName,
  emptyHref,
}: {
  placeName: string
  emptyHref: string
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const routeFor = (raw: string) => {
    const query = raw.trim()
    router.push(query ? searchHrefForQuery(query) : emptyHref)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    routeFor(q)
  }

  return (
    <div className="hood-d-search-band">
      <div className="hood-d-wrap">
        <form className="hood-d-search" role="search" onSubmit={submit}>
          <Input
            className="hood-d-search-input"
            type="text"
            autoComplete="off"
            aria-label={`Search an address or homes in ${placeName}`}
            placeholder={`Address or in ${placeName}`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <VoiceSearchButton
            className="hood-d-search-mic"
            onTranscript={(t) => {
              setQ(t)
              routeFor(t)
            }}
          />
          <Button type="submit" className="hood-d-search-go">
            Go
          </Button>
        </form>
      </div>
    </div>
  )
}

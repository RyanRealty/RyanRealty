'use client'

/**
 * HomepageCineSearch — the hero search bar on the cinematic homepage.
 * Same wiring as every prior hero: keyword search via /search (canonical
 * redirect to /homes-for-sale), full filter UI available on landing.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function HomepageCineSearch() {
  const router = useRouter()
  const [q, setQ] = useState('')

  return (
    <form
      className="cine-search cine-rise cine-rise-4"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const query = q.trim()
        router.push(query ? `/search?keywords=${encodeURIComponent(query)}` : '/search')
      }}
    >
      <Input
        type="text"
        className="cine-search-input"
        placeholder="City, neighborhood, or address"
        aria-label="Search Central Oregon real estate"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <Button type="submit" className="cine-search-btn">
        Search
      </Button>
    </form>
  )
}

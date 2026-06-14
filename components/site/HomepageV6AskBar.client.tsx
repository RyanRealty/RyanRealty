'use client'

/**
 * HomepageV6AskBar — natural-language ask bar in the v6 hero.
 *
 * Submits to the existing keyword search path (/search?keywords=) — the
 * same wiring HomepageHeroV3 used, so queries land on the live search
 * surface with the full filter UI available.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function HomepageV6AskBar() {
  const router = useRouter()
  const [q, setQ] = useState('')

  return (
    <form
      className="v6-ask v6-panel"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const query = q.trim()
        router.push(query ? `/search?keywords=${encodeURIComponent(query)}` : '/search')
      }}
    >
      <Input
        type="text"
        className="v6-ask-input"
        placeholder="Which Tetherow streets back the fairway?"
        aria-label="Search Central Oregon real estate"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <Button type="submit" className="v6-ask-btn">
        Ask
      </Button>
    </form>
  )
}

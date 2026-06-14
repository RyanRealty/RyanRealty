'use client'

/**
 * HomepageV6AskBar — keyword search bar in the v6 hero.
 *
 * Navigates directly to /homes-for-sale?keywords=<query>, which is the
 * real search surface (app/search/page.tsx via the Next.js rewrite).
 * Bypasses the /search → /homes-for-sale 308 redirect so the keywords
 * param is never at risk of being dropped by a browser's redirect cache.
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
        router.push(
          query
            ? `/homes-for-sale?keywords=${encodeURIComponent(query)}`
            : '/homes-for-sale',
        )
      }}
    >
      <Input
        type="text"
        className="v6-ask-input"
        placeholder="Search by city, neighborhood, or address"
        aria-label="Search Central Oregon real estate"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <Button type="submit" className="v6-ask-btn">
        Search
      </Button>
    </form>
  )
}

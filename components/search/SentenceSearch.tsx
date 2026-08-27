'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { mergeSentenceParams, sentenceToParams } from '@/lib/search/sentence-to-params'
import './search-ledger.css'

/**
 * Apply a typed or spoken sentence to the current /search URL.
 * VoiceSearchButton can pass this as `onTranscript` later.
 */
export function useApplySentenceSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return useCallback(
    (sentence: string) => {
      const text = sentence.trim()
      if (!text) return
      const parsed = sentenceToParams(text)
      if ([...parsed.keys()].length === 0) return
      const next = mergeSentenceParams(searchParams ?? new URLSearchParams(), text)
      const qs = next.toString()
      const path = pathname || '/homes-for-sale'
      router.replace(qs ? `${path}?${qs}` : path, { scroll: false })
    },
    [pathname, router, searchParams],
  )
}

export type SentenceSearchProps = {
  className?: string
  /** Spoken sentence. Same apply path as submit. */
  transcript?: string
}

export function SentenceSearch({ className, transcript }: SentenceSearchProps) {
  const apply = useApplySentenceSearch()
  const [value, setValue] = useState('')

  useEffect(() => {
    const text = transcript?.trim()
    if (!text) return
    setValue(text)
    apply(text)
  }, [apply, transcript])

  return (
    <form
      className={cn('flex items-center gap-2 px-4 pb-2 sm:px-6', className)}
      onSubmit={(event) => {
        event.preventDefault()
        apply(value)
      }}
    >
      <Label htmlFor="sentence-search" className="sr-only">
        Search listings
      </Label>
      <Input
        id="sentence-search"
        type="search"
        name="sentence"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="3 bed under 800 in Tetherow"
        autoComplete="off"
        enterKeyHint="search"
        className="srch-square h-9 min-w-0 flex-1"
      />
      <Button type="submit" size="sm" className="srch-chip h-9">
        Search
      </Button>
    </form>
  )
}

export default SentenceSearch

'use client'

import { useState } from 'react'
import type { BrokerRow } from '@/app/actions/brokers'
import BrokerCardCompact from './BrokerCardCompact'
import { Button } from "@/components/ui/button"

type Props = {
  brokers: BrokerRow[]
}

/** Cycle through broker cards (one at a time) with prev/next. */
export default function BrokerCardCarousel({ brokers }: Props) {
  const [index, setIndex] = useState(0)

  if (brokers.length === 0) return null
  if (brokers.length === 1) return <BrokerCardCompact broker={brokers[0]!} />

  const current = brokers[index] ?? brokers[0]!
  const prev = () => setIndex((i) => (i === 0 ? brokers.length - 1 : i - 1))
  const next = () => setIndex((i) => (i === brokers.length - 1 ? 0 : i + 1))

  return (
    <div className="space-y-3">
      <BrokerCardCompact broker={current} />
      <div className="flex items-center justify-between">
        <Button
          type="button"
          onClick={prev}
          variant="outline"
          size="sm"
          aria-label="Previous broker"
        >
          ← Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          {index + 1} of {brokers.length}
        </span>
        <Button
          type="button"
          onClick={next}
          variant="outline"
          size="sm"
          aria-label="Next broker"
        >
          Next →
        </Button>
      </div>
    </div>
  )
}

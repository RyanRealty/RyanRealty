'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"

type Props = {
  publicRemarks?: string
  directions?: string
}

const TRUNCATE_LEN = 300

export default function ListingDescription({ publicRemarks, directions }: Props) {
  const [expanded, setExpanded] = useState(false)
  const text = (publicRemarks ?? '').trim()
  const truncated = text.length > TRUNCATE_LEN ? text.slice(0, TRUNCATE_LEN) : null
  const showReadMore = truncated != null && text.length > TRUNCATE_LEN

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-primary">About This Home</h2>
      {text ? (
        <div className="text-primary whitespace-pre-line">
          {expanded ? text : (truncated ?? text)}
          {showReadMore && !expanded && (
            <Button
              type="button"
              onClick={() => setExpanded(true)}
              className="ml-1 text-accent-foreground font-medium hover:underline"
            >
              Read More
            </Button>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">No description available.</p>
      )}
      {directions?.trim() && (
        <div>
          <h3 className="text-sm font-semibold text-primary mb-1">Directions</h3>
          <p className="text-primary whitespace-pre-line text-sm">{directions.trim()}</p>
        </div>
      )}
    </section>
  )
}

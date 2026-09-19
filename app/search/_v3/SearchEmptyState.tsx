'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'

export function SearchEmptyState({
  kind,
}: {
  kind: 'empty' | 'degraded'
}) {
  if (kind === 'degraded') {
    return (
      <Empty className="srch-panel border-dashed">
        <EmptyHeader>
          <EmptyTitle>We could not load listings in time</EmptyTitle>
          <EmptyDescription>
            This is a connection or timeout problem, not an empty market. Try again.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            type="button"
            variant="outline"
            className="srch-chip"
            onClick={() => {
              if (typeof window !== 'undefined') window.location.reload()
            }}
          >
            Reload page
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <Empty className="srch-panel border-dashed">
      <EmptyHeader>
        <EmptyTitle>No homes match these filters</EmptyTitle>
        <EmptyDescription>Loosen a filter, or view every Central Oregon listing.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline" className="srch-chip">
          <Link href="/homes-for-sale">View all listings</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}

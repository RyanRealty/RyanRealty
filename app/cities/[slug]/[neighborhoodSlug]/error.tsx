'use client'

import { useEffect } from 'react'
import { V3_ROOT_CLASS, V3Button, V3Quiet } from '@/components/site/v3'

export default function NeighborhoodError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className={V3_ROOT_CLASS}>
      <V3Quiet
        heading="This neighborhood did not load"
        headingLevel={1}
        items={[
          {
            kind: 'prose',
            body: 'We could not load this neighborhood. Try again, or see the city list.',
          },
        ]}
      />
      <div className="flex flex-wrap gap-3 px-5 pb-16">
        <V3Button type="button" onClick={reset}>
          Try again
        </V3Button>
        <V3Button href="/cities" variant="ghost">
          See all cities
        </V3Button>
      </div>
    </main>
  )
}

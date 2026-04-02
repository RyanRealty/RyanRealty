'use client'

import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'

export function SentryExampleTrigger() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button
        type="button"
        variant="destructive"
        onClick={() => {
          throw new Error('Sentry example client error')
        }}
      >
        Throw sample error
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          Sentry.captureException(new Error('Sentry example captured exception'))
        }}
      >
        Send captured exception
      </Button>
    </div>
  )
}

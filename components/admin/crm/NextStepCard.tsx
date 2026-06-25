'use client'

/**
 * NextStepCard — the headline "what to do next with this contact" card. Shows
 * one recommended step with a single primary action:
 *   - kind 'cma'       -> "Send CMA" (cmaAction builds + queues a CMA draft)
 *   - kind 'newsletter'-> "Send newsletter" (newsletterAction sends the next issue)
 *
 * When a CMA is already queued awaiting broker review (the `pending` prop), the
 * card switches to a "Review & Send CMA" state and posts to pending.sendAction.
 *
 * Presentational + form-only. Actions are server actions passed in as props;
 * this island never queries the database.
 */
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type NextStep = {
  kind: 'cma' | 'newsletter'
  label: string
  description: string
}

export type NextStepCardProps = {
  step: NextStep
  cmaAction?: (fd: FormData) => Promise<void>
  newsletterAction?: (fd: FormData) => Promise<void>
  pending?: {
    kind: 'cma'
    deliveryId: string
    sendAction: (fd: FormData) => Promise<void>
  } | null
  className?: string
}

export default function NextStepCard({
  step,
  cmaAction,
  newsletterAction,
  pending,
  className,
}: NextStepCardProps) {
  const [isPending, startTransition] = useTransition()

  function run(action: (fd: FormData) => Promise<void>, fd: FormData) {
    startTransition(async () => {
      await action(fd)
    })
  }

  // A CMA queued and awaiting review takes priority over the generic next step.
  const reviewing = pending && pending.kind === 'cma'

  let actionNode: React.ReactNode = null

  if (reviewing) {
    actionNode = (
      <form
        action={(fd) => run(pending!.sendAction, fd)}
        className="w-full"
      >
        <input type="hidden" name="deliveryId" value={pending!.deliveryId} />
        <Button type="submit" disabled={isPending} className="min-h-11 w-full sm:w-auto">
          {isPending ? 'Sending' : 'Review & Send CMA'}
        </Button>
      </form>
    )
  } else if (step.kind === 'cma' && cmaAction) {
    actionNode = (
      <form action={(fd) => run(cmaAction, fd)} className="w-full">
        <Button type="submit" disabled={isPending} className="min-h-11 w-full sm:w-auto">
          {isPending ? 'Building' : 'Send CMA'}
        </Button>
      </form>
    )
  } else if (step.kind === 'newsletter' && newsletterAction) {
    actionNode = (
      <form action={(fd) => run(newsletterAction, fd)} className="w-full">
        <Button type="submit" disabled={isPending} className="min-h-11 w-full sm:w-auto">
          {isPending ? 'Sending' : 'Send newsletter'}
        </Button>
      </form>
    )
  }

  return (
    <Card className={cn('border-primary/20', className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
            Next step
          </Badge>
          {reviewing ? (
            <Badge variant="outline" className="border-warning/50 bg-warning/15 text-foreground">
              Awaiting review
            </Badge>
          ) : null}
        </div>
        <CardTitle className="text-base">{reviewing ? 'CMA ready to review' : step.label}</CardTitle>
        <CardDescription>
          {reviewing ? 'A CMA draft is queued. Review it, then send.' : step.description}
        </CardDescription>
      </CardHeader>
      <CardContent>{actionNode}</CardContent>
    </Card>
  )
}

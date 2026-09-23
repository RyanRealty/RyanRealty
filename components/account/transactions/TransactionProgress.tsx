import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format/date'
import { Card } from '@/components/ui/card'
import type { Milestone } from '@/lib/tc/client-portal'

/**
 * The deal's milestones as a stepper: vertical on phones, horizontal on
 * desktop (two separate markup blocks, toggled with `lg:hidden` / `hidden
 * lg:flex`, rather than one block that reorients itself — simpler to reason
 * about than a single flex-direction-swapping layout).
 *
 * Purely presentational. Every label, date, and state (done/current/upcoming)
 * comes from lib/tc/client-portal.ts clientMilestones(), computed server-side
 * from the deal's real dates — nothing here invents or estimates a date (§0).
 */
export function TransactionProgress({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) return null

  return (
    <Card className="p-4 sm:p-6">
      {/* Phones: vertical */}
      <ol className="lg:hidden" aria-label="Transaction progress">
        {milestones.map((m, i) => {
          const isLast = i === milestones.length - 1
          return (
            <li
              key={m.key}
              aria-current={m.state === 'current' ? 'step' : undefined}
              className="flex gap-3"
            >
              <div className="flex flex-col items-center">
                <StepDot state={m.state} index={i} />
                {!isLast ? (
                  <span
                    aria-hidden="true"
                    className={cn('mt-1 min-h-6 w-px flex-1', m.state === 'done' ? 'bg-primary' : 'bg-border')}
                  />
                ) : null}
              </div>
              <div className={cn('min-w-0', isLast ? 'pb-0' : 'pb-6')}>
                <p
                  className={cn(
                    'text-sm font-medium',
                    m.state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {m.label}
                  <StateLabel state={m.state} />
                </p>
                {m.date ? <p className="text-xs text-muted-foreground">{formatDate(m.date)}</p> : null}
              </div>
            </li>
          )
        })}
      </ol>

      {/* Desktop: horizontal */}
      <ol className="hidden lg:flex lg:items-start" aria-label="Transaction progress">
        {milestones.map((m, i) => {
          const isFirst = i === 0
          const isLast = i === milestones.length - 1
          return (
            <li
              key={m.key}
              aria-current={m.state === 'current' ? 'step' : undefined}
              className="flex flex-1 flex-col items-center text-center"
            >
              <div className="flex w-full items-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-px flex-1',
                    isFirst ? 'invisible' : m.state !== 'upcoming' ? 'bg-primary' : 'bg-border',
                  )}
                />
                <StepDot state={m.state} index={i} />
                <span
                  aria-hidden="true"
                  className={cn('h-px flex-1', isLast ? 'invisible' : m.state === 'done' ? 'bg-primary' : 'bg-border')}
                />
              </div>
              <div className="mt-2 max-w-36 px-1">
                <p
                  className={cn(
                    'text-sm font-medium',
                    m.state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {m.label}
                  <StateLabel state={m.state} />
                </p>
                {m.date ? <p className="text-xs text-muted-foreground">{formatDate(m.date)}</p> : null}
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

function StepDot({ state, index }: { state: Milestone['state']; index: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold tabular-nums',
        state === 'done' && 'border-primary bg-primary text-primary-foreground',
        state === 'current' && 'border-primary bg-background text-primary',
        state === 'upcoming' && 'border-border bg-background text-muted-foreground',
      )}
    >
      {state === 'done' ? '✓' : index + 1}
    </span>
  )
}

/** Screen-reader-only state so the step's status doesn't rely on color or
 *  aria-current support alone. */
function StateLabel({ state }: { state: Milestone['state'] }) {
  if (state === 'upcoming') return null
  return <span className="sr-only">{state === 'done' ? ' — completed' : ' — current step'}</span>
}

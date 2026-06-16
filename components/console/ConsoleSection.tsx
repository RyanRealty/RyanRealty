import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * ConsoleSection — the ONE panel primitive for every admin console surface.
 *
 * Why this exists: the lead command center drifted into "a bunch of boxes with
 * no headings" because each page hand-rolled its own cards. This component makes
 * the heading MANDATORY (it is a required prop) and the chrome identical
 * everywhere. Every console panel renders through this, so the look lives in one
 * place and cannot drift per page. Enforced by the mockup-parity gate
 * (design_system/ryan-realty/ui_kits/<surface>/parity.json requires it).
 */
export function ConsoleSection({
  title,
  count,
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  /** REQUIRED heading — no console panel ships headless. */
  title: string
  /** Optional count shown muted next to the title (e.g. "Tasks (3 open)"). */
  count?: string
  /** Optional trailing action (a link/select) rendered on the heading row. */
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  id?: string
}) {
  return (
    <Card id={id} className={cn('scroll-mt-20', className)}>
      <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">
          {title}
          {count ? <span className="ml-1.5 font-normal text-muted-foreground">{count}</span> : null}
        </h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <CardContent className={cn('px-4 pb-4 pt-3 sm:px-5', bodyClassName)}>{children}</CardContent>
    </Card>
  )
}

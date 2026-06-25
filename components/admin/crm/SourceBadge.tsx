/**
 * SourceBadge — one-glance "where this contact came from" pill for the record
 * card. Presentational only: it maps a raw source slug (or the first-touch
 * attribution) to a friendly label and renders a design-system <Badge>.
 *
 * The label resolution lives in source-labels.ts so it is unit-tested without
 * a DOM.
 */
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { resolveSourceLabel } from './source-labels'

export type SourceBadgeProps = {
  source: string | null
  firstTouch?: {
    source?: string | null
    landingPage?: string | null
  }
  className?: string
}

export default function SourceBadge({ source, firstTouch, className }: SourceBadgeProps) {
  const label = resolveSourceLabel(source, firstTouch)
  return (
    <Badge
      variant="outline"
      className={cn('border-border bg-muted text-muted-foreground font-medium', className)}
    >
      Source: {label}
    </Badge>
  )
}

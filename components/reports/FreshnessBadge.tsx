import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Props = {
  /** ISO timestamp of last data update */
  updatedAt: string | null | undefined
  /** Optional className for positioning */
  className?: string
}

/**
 * FreshnessBadge — shows how recently the data was updated.
 * Displays "Updated X minutes/hours/days ago" with color coding:
 * - Green: < 1 hour
 * - Default: < 24 hours
 * - Warning: > 24 hours
 */
export default function FreshnessBadge({ updatedAt, className }: Props) {
  if (!updatedAt) {
    return (
      <Badge variant="outline" className={cn('text-xs', className)}>
        Data refresh pending
      </Badge>
    )
  }

  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) {
    return (
      <Badge variant="outline" className={cn('text-xs', className)}>
        Updated recently
      </Badge>
    )
  }

  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  let label: string
  let variant: 'default' | 'secondary' | 'outline' | 'destructive' = 'secondary'

  if (diffMinutes < 5) {
    label = 'Updated just now'
    variant = 'default'
  } else if (diffMinutes < 60) {
    label = `Updated ${diffMinutes}m ago`
    variant = 'default'
  } else if (diffHours < 24) {
    label = `Updated ${diffHours}h ago`
    variant = 'secondary'
  } else if (diffDays < 7) {
    label = `Updated ${diffDays}d ago`
    variant = 'outline'
  } else {
    label = `Updated ${date.toLocaleDateString()}`
    variant = 'destructive'
  }

  return (
    <Badge variant={variant} className={cn('text-xs', className)}>
      {label}
    </Badge>
  )
}

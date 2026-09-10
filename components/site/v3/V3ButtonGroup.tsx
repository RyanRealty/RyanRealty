/**
 * v3 BUTTON GROUP — one clustered ask, not three ghost buttons.
 *
 * Adapted from the shadcn button-group job and beUI action-swap: Tour / Call /
 * Text (or Homes for sale / Get alerts) as one control. Navy on cream, 44px
 * taps, hairline joins. Not magnetic, not metallic, not a second kit.
 *
 * Server-safe. Callers that need onClick already sit in a client island.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3ButtonGroup.css'

export type V3ButtonGroupProps = {
  /** Accessible name for the group, e.g. "Contact about this listing". */
  label: string
  children: ReactNode
  className?: string
}

export function V3ButtonGroup({ label, children, className }: V3ButtonGroupProps) {
  return (
    <div className={cn(V3_ROOT_CLASS, 'v3-btn-group', className)} role="group" aria-label={label}>
      {children}
    </div>
  )
}

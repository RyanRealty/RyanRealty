'use client'

/**
 * HelpTip — the contextual tooltip pattern for stats, badges, and settings in
 * the admin. A small info icon that explains a number or control in one plain
 * English sentence. Exemplar usage: the broker-dashboard KPI cards.
 *
 *   <HelpTip label="New Leads">Contacts that came in during the last 30 days.</HelpTip>
 */

import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export default function HelpTip({
  children,
  label,
  className,
}: {
  /** The one-sentence plain-English explanation. */
  children: React.ReactNode
  /** Accessible name for the icon button, e.g. the stat it explains. */
  label: string
  className?: string
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Sized to ride inline inside a KPI label — the icon-button ladder
              sizes are too large for text flow, hence the h-auto/p-0 reset. */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`What does ${label} mean`}
            className={cn(
              'h-auto w-auto min-h-0 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground',
              className,
            )}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 text-left leading-relaxed">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

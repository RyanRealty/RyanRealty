'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ChevronDown, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

/**
 * §11.3 interactive page-title pattern: "Show me [X] ▾".
 * The variable phrase IS the query selector — clicking it opens a dropdown of
 * alternate views for this report. Agent Activity has two documented views.
 */

const VIEW_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'activity', label: 'total lead count and total agent activity' },
  { value: 'deals', label: 'which team member has closed the most deals' },
]

interface Props {
  currentView: string
  currentBroker: string
  currentDate: string
  currentCols?: string
}

export default function ShowMeSelector({
  currentView,
  currentBroker,
  currentDate,
  currentCols,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const active =
    VIEW_OPTIONS.find((o) => o.value === currentView) ?? VIEW_OPTIONS[0]

  function selectView(value: string) {
    const params = new URLSearchParams({
      broker: currentBroker,
      date: currentDate,
      view: value,
      ...(currentCols ? { cols: currentCols } : {}),
    })
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">Show me</span>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-0.5 rounded-sm font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {active.label}
          <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80">
          {VIEW_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onSelect={() => selectView(opt.value)}
              className={cn(
                'flex items-center justify-between gap-2 text-sm',
                opt.value === active.value && 'font-medium',
              )}
            >
              <span>{opt.label}</span>
              {opt.value === active.value ? (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

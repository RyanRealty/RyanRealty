'use client'

import { useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { setTcChecklistStatus, type TcChecklistStatus } from '@/app/actions/tc'
import { cn } from '@/lib/utils'

const LABEL: Record<TcChecklistStatus, string> = {
  required: 'Required',
  optional: 'Optional',
  in_review: 'In review',
  completed: 'Completed',
  na: 'N/A',
}

const TRANSITIONS: Array<{ to: TcChecklistStatus; label: string; reject?: boolean }> = [
  { to: 'in_review', label: 'Submit for review' },
  { to: 'completed', label: 'Accept · mark completed' },
  { to: 'required', label: 'Reject · back to required', reject: true },
  { to: 'optional', label: 'Mark optional' },
  { to: 'na', label: 'Mark N/A' },
]

export function ChecklistStatusControl({
  itemId,
  status,
  docCount,
}: {
  itemId: string
  status: TcChecklistStatus
  docCount: number
}) {
  const [pending, startTransition] = useTransition()

  const apply = (to: TcChecklistStatus, reject?: boolean) => {
    if (to === status) return
    let note: string | undefined
    if (reject) {
      const r = window.prompt('Reason for sending back (optional):', '')
      if (r === null) return
      note = r || undefined
    }
    startTransition(async () => {
      const res = await setTcChecklistStatus(itemId, to, note)
      if (!res.ok) window.alert(res.error || 'Failed')
      else window.location.reload()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={pending} aria-label="Change status">
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 cursor-pointer',
            status === 'completed' && 'border-success text-success',
            status === 'required' && docCount === 0 && 'border-destructive text-destructive',
            status === 'in_review' && 'border-warning text-foreground',
            pending && 'opacity-50'
          )}
        >
          {pending ? '…' : LABEL[status] ?? status}
          {docCount ? ` · ${docCount}` : ''}
          <span className="ml-1 opacity-60" aria-hidden>▾</span>
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {TRANSITIONS.map((t, i) => (
          <div key={t.to}>
            {i === TRANSITIONS.length - 2 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              disabled={t.to === status}
              onClick={() => apply(t.to, t.reject)}
              className={cn(t.reject && 'text-destructive focus:text-destructive')}
            >
              {t.label}
              {t.to === status ? ' ✓' : ''}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

'use client'

/**
 * ThreadHeader — the persistent action bar at the top of the reading pane
 * (spec §08 §5.1, §8). Contact name (or raw number for unknown callers), the
 * assignee dropdown (Me ▾ / Company ▾ → agent list, AC-12), and the mutually
 * exclusive Close (destructive) / Reopen (outline) buttons (AC-11).
 *
 * Also implements AC-07 auto-read: when the open thread is still 'unread', it
 * fires the state action once to flip it to read — the folder-rail unread count
 * decrements on the refresh. State only — never a send path.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ConversationStatus } from '@/lib/data/crm/getInboxQueue'

export default function ThreadHeader({
  personId,
  name,
  status,
  assigneeLabel,
  canAssign,
  brokers,
  setStatusAction,
  assignAction,
}: {
  personId: number
  name: string
  status: ConversationStatus
  /** 'Me' | 'Company' | broker display name — the assignee dropdown trigger. */
  assigneeLabel: string
  /** Superuser only — re-assigning a conversation is an owner action. */
  canAssign: boolean
  brokers: Array<{ slug: string; name: string }>
  setStatusAction: (status: ConversationStatus) => Promise<{ ok: boolean; error?: string }>
  assignAction: (broker: string | null) => Promise<{ ok: boolean; error?: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // AC-07 auto-read on open — fire once per opened thread.
  const autoReadFor = useRef<number | null>(null)
  useEffect(() => {
    if (status !== 'unread' || autoReadFor.current === personId) return
    autoReadFor.current = personId
    void setStatusAction('open').then((res) => {
      if (res.ok) router.refresh()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, status])

  const run = (next: ConversationStatus) => {
    setError(null)
    startTransition(async () => {
      const res = await setStatusAction(next)
      if (!res.ok) {
        setError(res.error ?? 'Could not update the conversation')
        return
      }
      router.refresh()
    })
  }

  const assign = (broker: string | null) => {
    setError(null)
    startTransition(async () => {
      const res = await assignAction(broker)
      if (!res.ok) {
        setError(res.error ?? 'Could not re-assign the conversation')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-1 border-b border-border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-lg font-medium text-foreground">
          <Link href={`/admin/crm/${personId}`} className="hover:underline">
            {name}
          </Link>
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {/* Assignee dropdown (spec §8.1) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary" className="h-7 gap-1 px-2.5 text-xs" disabled={pending}>
                {assigneeLabel}
                <ChevronDown className="h-3 w-3" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs">Assign conversation</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {canAssign ? (
                <>
                  {brokers.map((b) => (
                    <DropdownMenuItem key={b.slug} onSelect={() => assign(b.slug)}>
                      {b.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem onSelect={() => assign(null)}>Company (unassigned)</DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem disabled>Only an owner can re-assign</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Close / Reopen — mutually exclusive (AC-11) */}
          {status === 'closed' ? (
            <Button size="sm" variant="outline" className="h-7 px-3 text-xs" disabled={pending} onClick={() => run('open')}>
              Reopen
            </Button>
          ) : (
            <Button size="sm" variant="destructive" className="h-7 px-3 text-xs" disabled={pending} onClick={() => run('closed')}>
              Close
            </Button>
          )}
        </div>
      </div>
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  )
}

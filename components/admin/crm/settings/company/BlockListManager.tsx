'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CrmBlockedNumber } from '@/lib/data/crm/getCrmBlockedNumbers'
import { blockCrmNumber, unblockCrmNumber } from '@/app/actions/crm-block'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/**
 * BlockListManager — spec §1.8 / AC-11 block-list management.
 *
 * Adds/removes rows in crm_blocked_numbers. Enforcement is already live: the
 * Twilio inbound webhooks reject calls and drop texts from blocked numbers
 * (lib/data/crm/getBlockedNumber.isNumberBlocked — uncached, next-hit effect).
 */
export function BlockListManager({
  blocked,
  blockedOnById,
}: {
  blocked: CrmBlockedNumber[]
  /** Server-formatted created_at per row id (lib/format/date, LA time). */
  blockedOnById: Record<number, string>
}) {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function add() {
    setError('')
    startTransition(async () => {
      const res = await blockCrmNumber(phone, { reason: 'manual', note: note.trim() || undefined })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setPhone('')
      setNote('')
      router.refresh()
    })
  }

  function remove(e164: string | null, last10: string) {
    setError('')
    startTransition(async () => {
      const res = await unblockCrmNumber(e164 ?? last10)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Add form */}
      <Card className="flex-row flex-wrap items-center gap-2 p-4 shadow-sm">
        <Input
          value={phone}
          placeholder="(541) 555-0100"
          onChange={(e) => setPhone(e.target.value)}
          className="h-9 max-w-48"
          aria-label="Phone number to block"
        />
        <Input
          value={note}
          placeholder="Note (optional)"
          onChange={(e) => setNote(e.target.value)}
          className="h-9 max-w-64"
          aria-label="Note"
        />
        <Button type="button" size="sm" disabled={isPending || !phone.trim()} onClick={add}>
          {isPending ? 'Saving...' : 'Block number'}
        </Button>
        {error && <p className="w-full text-xs text-destructive">{error}</p>}
      </Card>

      {/* Blocked numbers — mobile card list (< md) */}
      <div className="space-y-2 md:hidden">
        {blocked.length === 0 ? (
          <Card className="p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">
              No blocked numbers. Add one above, or block a caller from their contact page.
            </p>
          </Card>
        ) : (
          blocked.map((b) => (
            <Card key={b.id} className="flex-row items-center justify-between gap-3 p-4 shadow-sm">
              <div className="min-w-0">
                <p className="text-sm font-medium tabular-nums text-foreground">{b.e164 ?? b.phoneLast10}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {b.reason ?? '—'} · {b.blockedBy ?? '—'} · {blockedOnById[b.id] ?? '—'}
                </p>
                {b.note && <p className="mt-0.5 truncate text-xs text-muted-foreground">{b.note}</p>}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 px-2 text-xs text-destructive hover:text-destructive"
                disabled={isPending}
                onClick={() => remove(b.e164, b.phoneLast10)}
              >
                Unblock
              </Button>
            </Card>
          ))
        )}
      </div>

      {/* Blocked numbers table (md+) */}
      <Card className="hidden shadow-sm md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Blocked by</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Blocked on</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blocked.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No blocked numbers. Add one above, or block a caller from their contact page.
                </TableCell>
              </TableRow>
            ) : (
              blocked.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium tabular-nums text-foreground">
                    {b.e164 ?? b.phoneLast10}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.reason ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.blockedBy ?? '—'}</TableCell>
                  <TableCell className="max-w-56 truncate text-sm text-muted-foreground">
                    {b.note ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {blockedOnById[b.id] ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      disabled={isPending}
                      onClick={() => remove(b.e164, b.phoneLast10)}
                    >
                      Unblock
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

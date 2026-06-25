'use client'

/**
 * SuppressionAdmin — the compliance suppression-list island (Wave 2). The FUB
 * Block List folds in here. It renders who is suppressed and why, lets an owner
 * add a manual block, and lifts a single block with an audit trail. A
 * compliance/litigator row needs an explicit confirm to lift (per the TCPA
 * rule — lifting a hard-stop is a legal liability, never casual, never bulk).
 *
 * Filtering + search + paging are driven by the SERVER page via URL params (the
 * reader is paged); this island owns the add form + the per-row lift, both of
 * which dispatch FormData server actions:
 *   addSuppressionAction(FormData: target, channel, reason)
 *   liftSuppressionAction(FormData: id, confirm)
 * There is intentionally NO bulk-lift control.
 *
 * Design-system only.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatDate } from '@/lib/format/date'

export type SuppressionRow = {
  id: number
  personId: number | null
  personName: string | null
  value: string | null
  channel: 'all' | 'email' | 'sms' | 'call'
  reason: string
  source: string
  createdAt: string
  isCompliance: boolean
}

type ActionResult = { ok: true } | { ok: false; error: string }

export type SuppressionAdminActions = {
  /** FormData: target (person id), channel, reason. */
  add: (formData: FormData) => Promise<ActionResult>
  /** FormData: id, confirm ('1' for compliance/litigator rows). */
  lift: (formData: FormData) => Promise<ActionResult>
}

const CHANNELS: Array<{ value: SuppressionRow['channel']; label: string }> = [
  { value: 'all', label: 'All channels' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'call', label: 'Call' },
]

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return formatDate(d)
}

export function SuppressionAdmin({
  rows,
  count,
  unreadable,
  channelFilter,
  query,
  actions,
}: {
  rows: SuppressionRow[]
  count: number
  unreadable: boolean
  channelFilter: SuppressionRow['channel'] | 'any'
  query: string
  actions: SuppressionAdminActions
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  // Add-form state
  const [addOpen, setAddOpen] = useState(false)
  const [target, setTarget] = useState('')
  const [addChannel, setAddChannel] = useState<SuppressionRow['channel']>('all')
  const [reason, setReason] = useState('')

  // Lift dialog state
  const [liftRow, setLiftRow] = useState<SuppressionRow | null>(null)

  // Filter / search state (drives a URL param navigation on apply)
  const [searchTerm, setSearchTerm] = useState(query)

  function run(action: () => Promise<ActionResult>, okText: string, onOk?: () => void) {
    setNote(null)
    startTransition(async () => {
      const r = await action()
      if (r.ok) {
        setNote({ tone: 'ok', text: okText })
        onOk?.()
        router.refresh()
      } else {
        setNote({ tone: 'err', text: r.error })
      }
    })
  }

  function buildHref(next: { channel?: string; q?: string }): string {
    const params = new URLSearchParams()
    const ch = next.channel ?? (channelFilter === 'any' ? '' : channelFilter)
    const q = next.q ?? query
    if (ch && ch !== 'any') params.set('channel', ch)
    if (q) params.set('q', q)
    const qs = params.toString()
    return qs ? `/admin/crm/settings/suppression?${qs}` : '/admin/crm/settings/suppression'
  }

  function submitAdd() {
    const pid = target.trim()
    if (!pid || !Number.isFinite(Number(pid))) {
      setNote({ tone: 'err', text: 'A contact id is required to suppress' })
      return
    }
    if (!reason.trim()) {
      setNote({ tone: 'err', text: 'A reason is required' })
      return
    }
    const fd = new FormData()
    fd.set('target', pid)
    fd.set('channel', addChannel)
    fd.set('reason', reason.trim())
    run(() => actions.add(fd), 'Suppression added', () => {
      setAddOpen(false)
      setTarget('')
      setReason('')
      setAddChannel('all')
    })
  }

  function submitLift(confirm: boolean) {
    if (!liftRow) return
    const fd = new FormData()
    fd.set('id', String(liftRow.id))
    if (confirm) fd.set('confirm', '1')
    run(() => actions.lift(fd), 'Suppression lifted', () => setLiftRow(null))
  }

  return (
    <div className="space-y-4">
      {unreadable ? (
        <Alert variant="destructive">
          <AlertDescription>The suppression list could not be read. Check the table and try again.</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {count.toLocaleString('en-US')} {count === 1 ? 'suppression' : 'suppressions'}
        </p>
        <Button size="sm" onClick={() => { setAddOpen(true); setNote(null) }} disabled={pending}>
          Add suppression
        </Button>
      </div>

      {/* Filter + search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={channelFilter === 'any' ? 'any' : channelFilter}
          onValueChange={(v) => router.push(buildHref({ channel: v === 'any' ? '' : v }))}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any channel</SelectItem>
            {CHANNELS.filter((c) => c.value !== 'all').map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
            <SelectItem value="all">All-channel blocks</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex flex-1 items-center gap-2">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name, email, or phone"
            onKeyDown={(e) => {
              if (e.key === 'Enter') router.push(buildHref({ q: searchTerm }))
            }}
          />
          <Button variant="outline" size="sm" className="h-9" onClick={() => router.push(buildHref({ q: searchTerm }))}>
            Search
          </Button>
        </div>
      </div>

      {note ? (
        <Alert variant={note.tone === 'err' ? 'destructive' : 'default'}>
          <AlertDescription className="whitespace-pre-wrap">{note.text}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-xl border border-border bg-card overflow-x-auto no-scrollbar">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/4">Contact</TableHead>
              <TableHead className="w-1/5">Value</TableHead>
              <TableHead className="w-1/6">Channel</TableHead>
              <TableHead className="w-1/5">Reason</TableHead>
              <TableHead className="w-1/6">Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No suppressions match this filter.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium text-foreground">{row.personName ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{row.value ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase text-xs tracking-wide">
                      {row.channel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span className="text-foreground">{row.reason}</span>
                      {row.isCompliance ? (
                        <Badge variant="outline" className="text-xs uppercase tracking-wide text-destructive">
                          Compliance
                        </Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{fmtDate(row.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-destructive hover:text-destructive"
                      disabled={pending}
                      onClick={() => { setLiftRow(row); setNote(null) }}
                    >
                      Lift
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => !pending && setAddOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add suppression</DialogTitle>
            <DialogDescription>Block a contact from a channel. This writes an audit trail.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sup-target">Contact id</Label>
              <Input
                id="sup-target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Person id"
                inputMode="numeric"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">The CRM person id of the contact to block.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-channel">Channel</Label>
              <Select value={addChannel} onValueChange={(v) => setAddChannel(v as SuppressionRow['channel'])}>
                <SelectTrigger id="sup-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-reason">Reason</Label>
              <Input id="sup-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this contact is blocked" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submitAdd} disabled={pending}>
              Add suppression
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lift dialog — compliance rows require explicit confirm */}
      <Dialog open={!!liftRow} onOpenChange={(o) => !pending && !o && setLiftRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lift suppression</DialogTitle>
            <DialogDescription>
              {liftRow?.isCompliance
                ? 'This is a compliance or litigator suppression. Lifting it is a legal liability and re-opens this channel. Confirm only if you are certain.'
                : 'This removes the block and re-opens the channel for this contact. It is logged with an audit trail.'}
            </DialogDescription>
          </DialogHeader>
          {liftRow ? (
            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium text-foreground">{liftRow.personName ?? liftRow.value ?? `Suppression ${liftRow.id}`}</p>
              <p className="text-muted-foreground">
                {liftRow.channel} · {liftRow.reason}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLiftRow(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => submitLift(!!liftRow?.isCompliance)}
              disabled={pending}
            >
              {liftRow?.isCompliance ? 'Confirm and lift' : 'Lift suppression'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

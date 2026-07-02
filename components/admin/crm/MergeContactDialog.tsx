'use client'

/**
 * MergeContactDialog — "Merge existing person" modal from the Relationships panel
 * (FUB spec §07a §4.2).
 *
 * Flow:
 *  1. Search existing contacts by name → pick one
 *  2. Confirm: read the permanent-merge warning
 *  3. Submit the form → mergeCrmContactAction (server action)
 *     → soft-deletes the duplicate (stage Trash, deleted=true)
 *     → migrates timeline, tasks, enrollments, relationships, collaborators
 *     → writes an audit timeline entry
 *     → redirects back to survivor with a flash message
 *
 * The merge is permanent. Unmerge is not supported (per spec).
 */
import { useRef, useState, useTransition } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { searchPeopleForMergeAction, mergeCrmContactAction, type MergeCandidate } from '@/app/actions/crm-person-gaps'

type Step = 'search' | 'confirm'

export function MergeContactDialog({ survivorId, trigger }: { survivorId: number; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MergeCandidate[]>([])
  const [selected, setSelected] = useState<MergeCandidate | null>(null)
  const [searching, setSearching] = useState(false)
  const [pending, startTransition] = useTransition()
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  function reset() {
    setStep('search')
    setQuery('')
    setResults([])
    setSelected(null)
  }

  function onOpen(val: boolean) {
    if (!val) reset()
    setOpen(val)
  }

  function onSearch(value: string) {
    setQuery(value)
    if (debounce.current) clearTimeout(debounce.current)
    const q = value.trim()
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    debounce.current = setTimeout(() => {
      startTransition(async () => {
        const hits = await searchPeopleForMergeAction(q, survivorId)
        setResults(hits)
        setSearching(false)
      })
    }, 250)
  }

  function pick(candidate: MergeCandidate) {
    setSelected(candidate)
    setStep('confirm')
    setResults([])
    setQuery('')
  }

  function backToSearch() {
    setSelected(null)
    setStep('search')
  }

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="ghost"
            className="h-auto p-0 text-xs font-medium text-muted-foreground underline-offset-2 hover:bg-transparent hover:text-foreground hover:underline"
          >
            Merge existing person
          </Button>
        )}
      </DialogTrigger>

      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Merge existing person</DialogTitle>
        </DialogHeader>

        {step === 'search' ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Search for the duplicate contact to merge into this record. The duplicate&apos;s timeline, tasks, and enrollments will move here. The duplicate will be archived.
            </p>
            <div className="relative">
              <Input
                autoFocus
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search contacts by name…"
                className="h-10"
                autoComplete="off"
              />
              {query.trim().length >= 2 ? (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">
                  {searching ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
                  ) : results.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No contacts found.</p>
                  ) : (
                    results.map((c) => (
                      <Button
                        key={c.id}
                        type="button"
                        variant="ghost"
                        onClick={() => pick(c)}
                        className="h-auto w-full flex-col items-start gap-0.5 rounded-none px-3 py-2.5 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{c.name ?? `Contact #${c.id}`}</span>
                          <Badge variant="outline" className="text-xs">{c.stage}</Badge>
                        </div>
                        {(c.email ?? c.phone) ? (
                          <span className="text-xs text-muted-foreground">
                            {[c.email, c.phone].filter(Boolean).join(' · ')}
                          </span>
                        ) : null}
                      </Button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          /* Confirm step */
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
              <div className="text-sm font-medium text-foreground">{selected?.name ?? `Contact #${selected?.id}`}</div>
              {(selected?.email ?? selected?.phone) ? (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {[selected?.email, selected?.phone].filter(Boolean).join(' · ')}
                </div>
              ) : null}
            </div>

            <div className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
              <p className="text-xs text-destructive">
                This merge is permanent. The duplicate contact will be archived (stage set to Trash). Timeline entries, tasks, and enrollments will move to this record. Unmerge is not supported.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'confirm' ? (
            <>
              <Button type="button" variant="outline" onClick={backToSearch} disabled={pending}>
                Back
              </Button>
              <form
                action={mergeCrmContactAction}
                onSubmit={() => { /* allow pending state via native submit */ }}
              >
                <Input type="hidden" name="survivorId" value={survivorId} />
                <Input type="hidden" name="mergedId" value={selected?.id ?? ''} />
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={pending || !selected}
                  className={cn(pending && 'opacity-70')}
                >
                  {pending ? 'Merging…' : 'Merge and archive duplicate'}
                </Button>
              </form>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => onOpen(false)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

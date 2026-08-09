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
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — every export, prop, handler, action, debounce and
 * user-visible string is unchanged. Four notes on the swap:
 *  - The v2 Dialog is `open`-controlled and has no trigger slot, but this
 *    component still takes its trigger as a ReactNode prop. The open handler is
 *    attached to that element the way Radix's asChild did (`triggerWithOpen`,
 *    the same helper the sibling person-detail dialogs use), so PersonSidebar
 *    does not change.
 *  - The results list becomes the barrel's `av2-menu__panel` / `av2-menu__item`
 *    pair, which carries the one-row-at-a-time highlight the ghost buttons had.
 *    Its two-line layout goes in an inline style because .av2-menu__item
 *    declares align-items/padding UNLAYERED — a Tailwind utility would lose.
 *    Only geometry is inline; the hover lives on background and stays on the
 *    stylesheet where :hover can reach it.
 *  - The stage chip is NOT a StateWord: .av2-state uppercases, and a stage name
 *    is broker-entered data, not one of the language's five state words.
 *  - The two form fields the action reads stay hidden <input>s — the same shape
 *    every migrated v2 surface uses to carry ids into a server action.
 */
import { cloneElement, isValidElement, useRef, useState, useTransition } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button, Dialog, SearchField } from '@/components/admin/v2'
import { cn } from '@/lib/utils'
import { searchPeopleForMergeAction, mergeCrmContactAction, type MergeCandidate } from '@/app/actions/crm-person-gaps'

type Step = 'search' | 'confirm'

const MUTED_STYLE: React.CSSProperties = { color: 'var(--a-text-2)' }
const DANGER_STYLE: React.CSSProperties = { color: 'var(--a-danger)' }

/** Two-line result row inside a menu panel (see the header note). */
const RESULT_ROW_STYLE: React.CSSProperties = {
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  minHeight: 'auto',
  padding: '10px 12px',
}

/** Outline chip for a broker-entered stage name — never a StateWord. */
const STAGE_CHIP_STYLE: React.CSSProperties = {
  border: '1px solid var(--a-border)',
  borderRadius: 999,
  padding: '1px 8px',
  color: 'var(--a-text-2)',
}

/**
 * Attach "open this dialog" to a caller-supplied trigger element, chaining any
 * onClick it already carries instead of replacing it. This is what Radix's
 * `asChild` did for the DialogTrigger this dialog used to render.
 */
function triggerWithOpen(trigger: React.ReactNode, open: () => void): React.ReactNode {
  if (!isValidElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>(trigger)) return trigger
  const existing = trigger.props.onClick
  return cloneElement(trigger, {
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      existing?.(e)
      open()
    },
  })
}

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
    <>
      {trigger ? (
        triggerWithOpen(trigger, () => onOpen(true))
      ) : (
        <Button
          type="button"
          variant="quiet"
          className="av2-textlink text-xs font-medium underline-offset-2"
          onClick={() => onOpen(true)}
        >
          Merge existing person
        </Button>
      )}

      <Dialog
        open={open}
        onClose={() => onOpen(false)}
        title="Merge existing person"
        footer={
          step === 'confirm' ? (
            <>
              <Button type="button" variant="quiet" onClick={backToSearch} disabled={pending}>
                Back
              </Button>
              <form
                action={mergeCrmContactAction}
                onSubmit={() => { /* allow pending state via native submit */ }}
              >
                <input type="hidden" name="survivorId" value={survivorId} />
                <input type="hidden" name="mergedId" value={selected?.id ?? ''} />
                <Button
                  type="submit"
                  variant="danger"
                  disabled={pending || !selected}
                  className={cn(pending && 'opacity-70')}
                >
                  {pending ? 'Merging…' : 'Merge and archive duplicate'}
                </Button>
              </form>
            </>
          ) : (
            <Button type="button" variant="quiet" onClick={() => onOpen(false)}>
              Cancel
            </Button>
          )
        }
      >
        {step === 'search' ? (
          <div className="space-y-3 py-2">
            <p className="text-sm" style={MUTED_STYLE}>
              Search for the duplicate contact to merge into this record. The duplicate&apos;s timeline, tasks, and enrollments will move here. The duplicate will be archived.
            </p>
            <div className="relative">
              <SearchField
                aria-label="Search contacts by name"
                type="text"
                autoFocus
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search contacts by name…"
                className="w-full"
                style={{ maxWidth: 'none' }}
                autoComplete="off"
              />
              {query.trim().length >= 2 ? (
                <div className="av2-menu__panel max-h-64 w-full overflow-auto">
                  {searching ? (
                    <p className="px-3 py-2 text-xs" style={MUTED_STYLE}>Searching…</p>
                  ) : results.length === 0 ? (
                    <p className="px-3 py-2 text-xs" style={MUTED_STYLE}>No contacts found.</p>
                  ) : (
                    results.map((c) => (
                      <Button
                        key={c.id}
                        type="button"
                        variant="quiet"
                        onClick={() => pick(c)}
                        className="av2-menu__item flex-col gap-0.5 text-left"
                        style={RESULT_ROW_STYLE}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: 'var(--a-text)' }}>{c.name ?? `Contact #${c.id}`}</span>
                          <span className="text-xs" style={STAGE_CHIP_STYLE}>{c.stage}</span>
                        </div>
                        {(c.email ?? c.phone) ? (
                          <span className="text-xs" style={MUTED_STYLE}>
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
            <div
              className="px-4 py-3"
              style={{
                borderRadius: 'var(--a-r-lg)',
                border: '1px solid var(--a-border)',
                background: 'var(--a-inset)',
              }}
            >
              <div className="text-sm font-medium" style={{ color: 'var(--a-text)' }}>{selected?.name ?? `Contact #${selected?.id}`}</div>
              {(selected?.email ?? selected?.phone) ? (
                <div className="mt-0.5 text-xs" style={MUTED_STYLE}>
                  {[selected?.email, selected?.phone].filter(Boolean).join(' · ')}
                </div>
              ) : null}
            </div>

            <div
              className="flex gap-2.5 px-3 py-3"
              style={{
                borderRadius: 'var(--a-r-lg)',
                border: '1px solid var(--a-danger)',
                background: 'var(--a-danger-wash)',
              }}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={DANGER_STYLE} aria-hidden />
              <p className="text-xs" style={DANGER_STYLE}>
                This merge is permanent. The duplicate contact will be archived (stage set to Trash). Timeline entries, tasks, and enrollments will move to this record. Unmerge is not supported.
              </p>
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}

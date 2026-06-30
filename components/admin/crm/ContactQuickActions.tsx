'use client'

/**
 * ContactQuickActions — the clean quick-action chip row that lives at the top of
 * the contact page, by the name (replaces the old "Memberships" card). Four
 * chips: Newsletter (tap = subscribe/unsubscribe), Automations (sheet to enroll),
 * Saved searches (sheet to view), Market reports (sheet to set areas/frequency).
 * Each chip shows live state — a check when on, a count when relevant.
 */
import { useState, useTransition } from 'react'
import { BarChart3, Check, Mail, Search, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { setNewsletterSubscription, setSequenceEnrollment } from '@/app/actions/crm-membership'
import ReportSubscriptionsPanel from '@/components/admin/crm/ReportSubscriptionsPanel'
import type { ContactSequenceMembership } from '@/lib/data/crm/getContactMemberships'

type Result = { ok: true; message?: string } | { ok: false; error: string }

export type QuickSavedSearch = { id: number | string; label: string; url: string | null; active: boolean }
export type QuickReportSub = { isActive: boolean; areas: string[]; frequency: 'weekly' | 'monthly' | 'quarterly' }
export type QuickReportArea = { slug: string; label: string }

/** Shared chip look: pill button, accent fill when "on". */
function Chip({ on, icon, label, count, onClick }: { on: boolean; icon: React.ReactNode; label: string; count?: number; onClick?: () => void }) {
  return (
    <Button
      type="button"
      variant={on ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      className="h-9 shrink-0 gap-1.5 rounded-full px-3.5 text-sm"
    >
      {on ? <Check className="h-4 w-4" aria-hidden /> : icon}
      {label}
      {typeof count === 'number' && count > 0 ? (
        <span className="text-xs tabular-nums opacity-75">{count}</span>
      ) : null}
    </Button>
  )
}

export function ContactQuickActions(props: {
  personId: number
  newsletterSubscribed: boolean
  automations: ContactSequenceMembership[]
  savedSearches: QuickSavedSearch[]
  reportSub: QuickReportSub | null
  reportAreas: QuickReportArea[]
  reportSetAction: (formData: FormData) => Promise<void>
}) {
  const [newsletterOn, setNewsletterOn] = useState(props.newsletterSubscribed)
  const [seqOn, setSeqOn] = useState<Record<number, boolean>>(() => Object.fromEntries(props.automations.map((s) => [s.id, s.enrolled])))
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const enrolledCount = Object.values(seqOn).filter(Boolean).length
  const reportsOn = Boolean(props.reportSub?.isActive)
  const savedCount = props.savedSearches.length

  function dispatch(apply: () => void, revert: () => void, action: () => Promise<Result>) {
    apply()
    setNote(null)
    startTransition(async () => {
      const r = await action()
      if (r.ok) setNote({ tone: 'ok', text: r.message ?? 'Saved' })
      else { revert(); setNote({ tone: 'err', text: r.error }) }
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {/* Newsletter — instant subscribe/unsubscribe */}
        <Chip
          on={newsletterOn}
          icon={<Mail className="h-4 w-4" aria-hidden />}
          label="Newsletter"
          onClick={() =>
            dispatch(
              () => setNewsletterOn(!newsletterOn),
              () => setNewsletterOn(newsletterOn),
              () => setNewsletterSubscription({ personId: props.personId, subscribed: !newsletterOn }),
            )
          }
        />

        {/* Automations — sheet to enroll/unenroll */}
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant={enrolledCount > 0 ? 'default' : 'outline'} size="sm" className="h-9 shrink-0 gap-1.5 rounded-full px-3.5 text-sm">
              {enrolledCount > 0 ? <Check className="h-4 w-4" aria-hidden /> : <Workflow className="h-4 w-4" aria-hidden />}
              Automations
              {enrolledCount > 0 ? <span className="text-xs tabular-nums opacity-75">{enrolledCount}</span> : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-screen overflow-y-auto">
            <SheetHeader><SheetTitle>Automations</SheetTitle></SheetHeader>
            <div className="mt-2">
              {props.automations.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">No active automations to assign.</p>
              ) : (
                <div className="divide-y divide-border">
                  {props.automations.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                        {seqOn[s.id] && s.status ? <p className="text-xs text-muted-foreground">{s.status.replace(/_/g, ' ')}</p> : null}
                      </div>
                      <Switch
                        checked={!!seqOn[s.id]}
                        disabled={pending}
                        aria-label={s.name}
                        onCheckedChange={(next) =>
                          dispatch(
                            () => setSeqOn((m) => ({ ...m, [s.id]: next })),
                            () => setSeqOn((m) => ({ ...m, [s.id]: !next })),
                            () => setSequenceEnrollment({ personId: props.personId, sequenceId: s.id, enrolled: next }),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Saved searches — sheet to view */}
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 rounded-full px-3.5 text-sm">
              <Search className="h-4 w-4" aria-hidden />
              Saved searches
              {savedCount > 0 ? <span className="text-xs tabular-nums opacity-75">{savedCount}</span> : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-screen overflow-y-auto">
            <SheetHeader><SheetTitle>Saved searches</SheetTitle></SheetHeader>
            <div className="mt-2">
              {savedCount === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">No saved searches yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {props.savedSearches.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                      <span className="min-w-0 truncate text-sm text-foreground">{s.label}</span>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-primary hover:underline">View</a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Market reports — sheet with areas + frequency + on/off */}
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant={reportsOn ? 'default' : 'outline'} size="sm" className="h-9 shrink-0 gap-1.5 rounded-full px-3.5 text-sm">
              {reportsOn ? <Check className="h-4 w-4" aria-hidden /> : <BarChart3 className="h-4 w-4" aria-hidden />}
              Market reports
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-screen overflow-y-auto">
            <SheetHeader><SheetTitle>Market reports</SheetTitle></SheetHeader>
            <div className="mt-2">
              <ReportSubscriptionsPanel
                current={props.reportSub}
                areaOptions={props.reportAreas}
                setAction={props.reportSetAction}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {note ? (
        <p className={cn('px-1 text-xs', note.tone === 'ok' ? 'text-success' : 'text-destructive')} role="status">{note.text}</p>
      ) : null}
    </div>
  )
}

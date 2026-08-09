'use client'

/**
 * ContactQuickActions — the clean quick-action chip row that lives at the top of
 * the contact page, by the name (replaces the old "Memberships" card). Four
 * chips: Newsletter (tap = subscribe/unsubscribe), Automations (sheet to enroll),
 * Saved searches (sheet to view), Market reports (sheet to set areas/frequency).
 * Each chip shows live state — a check when on, a count when relevant.
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 *
 *  - shadcn's Sheet is trigger-driven; the v2 Sheet is state-driven (it wraps
 *    <dialog>.showModal(), so the focus trap and Esc come from the platform).
 *    Each of the four sheets therefore carries its own open flag, and the chip
 *    that opens it keeps the disclosure semantics Radix used to supply
 *    (aria-haspopup + aria-expanded), which .av2-btn[aria-expanded] also styles.
 *  - The chips stay v2 Buttons rather than FilterChip: FilterChip has no :hover
 *    in the stylesheet, and these are tap targets, not filters. `primary` when
 *    on / `quiet` when off reproduces shadcn's default-vs-outline pair exactly.
 *    ci:admin-ui rule C — the one unconditional primary in this file is "Send
 *    this issue to the contact", the only action here that actually sends.
 *  - shadcn Switch's onCheckedChange(next) becomes the native onChange, whose
 *    event carries the same boolean on `target.checked`; `label` + `labelHidden`
 *    carry the accessible name aria-label used to.
 */
import { useState, useTransition } from 'react'
import { BarChart3, Check, Mail, Search, Workflow } from 'lucide-react'
import { Button, Sheet, Switch } from '@/components/admin/v2'
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
      variant={on ? 'primary' : 'quiet'}
      onClick={onClick}
      className="shrink-0 rounded-full"
    >
      {on ? <Check className="h-4 w-4" aria-hidden /> : icon}
      {label}
      {typeof count === 'number' && count > 0 ? (
        <span className="tabular-nums opacity-75" style={{ fontSize: 'var(--a-text-xs)' }}>{count}</span>
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
  /** One-off immediate market-report send (ReportSubscriptionsPanel "Send report now"). */
  reportSendNowAction?: (formData: FormData) => Promise<Result>
  /** The issue a one-off newsletter send delivers (subject shown before sending). */
  latestNewsletter?: { subject: string; status: 'sent' | 'draft'; sentAt: string | null } | null
  /** Send the latest newsletter issue to this contact right now. */
  newsletterSendAction?: () => Promise<Result>
}) {
  const [newsletterOn, setNewsletterOn] = useState(props.newsletterSubscribed)
  const [seqOn, setSeqOn] = useState<Record<number, boolean>>(() => Object.fromEntries(props.automations.map((s) => [s.id, s.enrolled])))
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  // One flag per sheet — the v2 Sheet is opened by state, not by a trigger.
  const [newsletterSheetOpen, setNewsletterSheetOpen] = useState(false)
  const [automationsSheetOpen, setAutomationsSheetOpen] = useState(false)
  const [savedSheetOpen, setSavedSheetOpen] = useState(false)
  const [reportsSheetOpen, setReportsSheetOpen] = useState(false)

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

  const applyNewsletter = (next: boolean) =>
    dispatch(
      () => setNewsletterOn(next),
      () => setNewsletterOn(!next),
      () => setNewsletterSubscription({ personId: props.personId, subscribed: next }),
    )
  // Unsubscribing is a compliance-sensitive one-way action — confirm before it
  // fires so a single accidental chip tap can't opt a subscribed contact out
  // (regression guard: the chip is a one-tap toggle in this branch).
  const newsletterToggle = () => {
    const next = !newsletterOn
    if (!next && typeof window !== 'undefined' && !window.confirm('Unsubscribe this contact from the newsletter?')) return
    applyNewsletter(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {/* Newsletter — sheet: subscribe toggle + send the latest issue now */}
        {props.newsletterSendAction ? (
          <>
            <Button
              type="button"
              variant={newsletterOn ? 'primary' : 'quiet'}
              className="shrink-0 rounded-full"
              aria-haspopup="dialog"
              aria-expanded={newsletterSheetOpen}
              onClick={() => setNewsletterSheetOpen(true)}
            >
              {newsletterOn ? <Check className="h-4 w-4" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
              Newsletter
            </Button>
            <Sheet open={newsletterSheetOpen} onClose={() => setNewsletterSheetOpen(false)} title="Newsletter">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p style={{ fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}>Subscribed</p>
                    <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                      {newsletterOn ? 'Receives the monthly newsletter' : 'Not receiving the newsletter'}
                    </p>
                  </div>
                  <Switch
                    label="Newsletter subscription"
                    labelHidden
                    checked={newsletterOn}
                    disabled={pending}
                    onChange={newsletterToggle}
                  />
                </div>
                <div className="rounded-xl p-3" style={{ border: '1px solid var(--a-border)' }}>
                  <p
                    className="font-semibold uppercase tracking-wide"
                    style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
                  >
                    Send now
                  </p>
                  {props.latestNewsletter ? (
                    <>
                      <p
                        className="mt-1 truncate"
                        style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}
                        title={props.latestNewsletter.subject}
                      >
                        {props.latestNewsletter.subject}
                      </p>
                      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                        {props.latestNewsletter.status === 'sent' ? 'Latest sent issue' : 'Newest draft'}
                      </p>
                      <Button
                        type="button"
                        disabled={pending}
                        className="mt-2"
                        onClick={() => dispatch(() => {}, () => {}, props.newsletterSendAction!)}
                      >
                        Send this issue to the contact
                      </Button>
                    </>
                  ) : (
                    <p className="mt-1" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
                      No newsletter issue available yet.
                    </p>
                  )}
                </div>
              </div>
            </Sheet>
          </>
        ) : (
          <Chip
            on={newsletterOn}
            icon={<Mail className="h-4 w-4" aria-hidden />}
            label="Newsletter"
            onClick={newsletterToggle}
          />
        )}

        {/* Automations — sheet to enroll/unenroll */}
        <Button
          type="button"
          variant={enrolledCount > 0 ? 'primary' : 'quiet'}
          className="shrink-0 rounded-full"
          aria-haspopup="dialog"
          aria-expanded={automationsSheetOpen}
          onClick={() => setAutomationsSheetOpen(true)}
        >
          {enrolledCount > 0 ? <Check className="h-4 w-4" aria-hidden /> : <Workflow className="h-4 w-4" aria-hidden />}
          Automations
          {enrolledCount > 0 ? (
            <span className="tabular-nums opacity-75" style={{ fontSize: 'var(--a-text-xs)' }}>{enrolledCount}</span>
          ) : null}
        </Button>
        <Sheet open={automationsSheetOpen} onClose={() => setAutomationsSheetOpen(false)} title="Automations">
          <div>
            {props.automations.length === 0 ? (
              <p className="py-3" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
                No active automations to assign.
              </p>
            ) : (
              // `divide-y divide-border` carried its colour through a semantic
              // class, and border-color does not inherit — so the hairline is
              // drawn per row in the token instead.
              <div>
                {props.automations.map((s, i) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 py-3"
                    style={i > 0 ? { borderTop: '1px solid var(--a-border)' } : undefined}
                  >
                    <div className="min-w-0">
                      <p className="truncate" style={{ fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}>
                        {s.name}
                      </p>
                      {seqOn[s.id] && s.status ? (
                        <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>{s.status.replace(/_/g, ' ')}</p>
                      ) : null}
                    </div>
                    <Switch
                      label={s.name}
                      labelHidden
                      checked={!!seqOn[s.id]}
                      disabled={pending}
                      onChange={(e) => {
                        const next = e.target.checked
                        dispatch(
                          () => setSeqOn((m) => ({ ...m, [s.id]: next })),
                          () => setSeqOn((m) => ({ ...m, [s.id]: !next })),
                          () => setSequenceEnrollment({ personId: props.personId, sequenceId: s.id, enrolled: next }),
                        )
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Sheet>

        {/* Saved searches — sheet to view */}
        <Button
          type="button"
          variant="quiet"
          className="shrink-0 rounded-full"
          aria-haspopup="dialog"
          aria-expanded={savedSheetOpen}
          onClick={() => setSavedSheetOpen(true)}
        >
          <Search className="h-4 w-4" aria-hidden />
          Saved searches
          {savedCount > 0 ? (
            <span className="tabular-nums opacity-75" style={{ fontSize: 'var(--a-text-xs)' }}>{savedCount}</span>
          ) : null}
        </Button>
        <Sheet open={savedSheetOpen} onClose={() => setSavedSheetOpen(false)} title="Saved searches">
          <div>
            {savedCount === 0 ? (
              <p className="py-3" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
                No saved searches yet.
              </p>
            ) : (
              <ul>
                {props.savedSearches.map((s, i) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 py-3"
                    style={i > 0 ? { borderTop: '1px solid var(--a-border)' } : undefined}
                  >
                    <span className="min-w-0 truncate" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>
                      {s.label}
                    </span>
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 font-medium hover:underline"
                        style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-accent)' }}
                      >
                        View
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Sheet>

        {/* Market reports — sheet with areas + frequency + on/off */}
        <Button
          type="button"
          variant={reportsOn ? 'primary' : 'quiet'}
          className="shrink-0 rounded-full"
          aria-haspopup="dialog"
          aria-expanded={reportsSheetOpen}
          onClick={() => setReportsSheetOpen(true)}
        >
          {reportsOn ? <Check className="h-4 w-4" aria-hidden /> : <BarChart3 className="h-4 w-4" aria-hidden />}
          Market reports
        </Button>
        <Sheet open={reportsSheetOpen} onClose={() => setReportsSheetOpen(false)} title="Market reports">
          <div>
            <ReportSubscriptionsPanel
              current={props.reportSub}
              areaOptions={props.reportAreas}
              setAction={props.reportSetAction}
              sendNowAction={props.reportSendNowAction}
            />
          </div>
        </Sheet>
      </div>

      {note ? (
        <p
          className="px-1"
          style={{ fontSize: 'var(--a-text-xs)', color: note.tone === 'ok' ? 'var(--a-ok)' : 'var(--a-danger)' }}
          role="status"
        >
          {note.text}
        </p>
      ) : null}
    </div>
  )
}

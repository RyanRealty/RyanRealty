'use client'

/**
 * MobileSettingsScreen — the < md Settings surface (mob-06 fub-ios Settings
 * modal, re-skinned to the admin tokens per the in-house rebuild notes in
 * docs/crm-spec/mobile-screens/screen-06.md).
 *
 * Structure (390×844 reference):
 *   - Full-screen modal (fixed inset-0, occludes tab bar + FAB — no shell
 *     chrome behind), accent header with left "Close" + centered "Settings".
 *   - Profile card: 52pt avatar + name + role.
 *   - Feature settings section: icon-circle rows (app version informational,
 *     three notification prefs with Enabled/Disabled status labels that toggle
 *     on tap, and the SMS-alerts switch row) — all wired to the broker's real
 *     row via saveBrokerSettingsAction (immediate save, iOS pattern).
 *   - Support / links section: Report a bug, Support email, Email signature
 *     (sheet editor), CRM settings, Company settings.
 *
 * CRM-specific rows (Zillow, CRM support emails, app-store version) are
 * replaced with the Ryan Realty equivalents per the spec's own rebuild notes.
 * Desktop (md+) keeps MySettingsForm unchanged.
 *
 * 11F: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only — every handler, save call, optimistic rollback, conditional
 * and visible string is unchanged. Three notes:
 *   - the page/card pairing is the folder's phone idiom: the screen sits on
 *     var(--a-inset) and its sections lift to var(--a-surface), the same two
 *     steps MobileCalendarTab and MobileEditSheet use.
 *   - the header is the accent solid + its paired foreground (var(--a-btn-bg) /
 *     var(--a-btn-fg)), which flip together under [data-theme="dark"] — the
 *     MobileEditSheet header precedent.
 *   - the four icon circles keep four DISTINCT fills, because the fill is what
 *     tells the rows apart at a glance; collapsing them onto one solid would
 *     make IconCircle's `bg` argument inert. Each is a token paired with
 *     var(--a-btn-fg), the pairing every solid control in the language uses.
 *   - the signature box in the sheet stays a raw control on `av2-input` with an
 *     aria-label: the labelled TextAreaField prints a visible heading the sheet
 *     never had (its own title names it), and dropping the visible label never
 *     drops the accessible one (MobileNotesTab precedent).
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Smartphone, MessageSquare, Layers, Phone } from 'lucide-react'
import { CrmAvatar } from '@/components/admin/shared/mobile/CrmMobileKit'
import { Button, Sheet, Switch } from '@/components/admin/v2'
import { saveBrokerSettingsAction, type BrokerSettingsPayload } from '@/app/actions/broker-settings'
import { CONTACT, BRAND } from '@/lib/brand/contact'

type Broker = {
  id: string
  displayName: string
  notifyNewLeads: boolean
  notifyDealActivity: boolean
  notifyTaskDue: boolean
  notifyReturnVisit: boolean
  notifyCmaReady: boolean
  notifyAppointment: boolean
  notifySms: boolean
  emailSignature: string
}

/** Section surface — lifted one step off the screen's inset background. */
const SECTION_STYLE = { background: 'var(--a-surface)' } as const

/** 1pt hairline divider, inset past the icon column (mob-06 spacing spec). */
function RowDivider({ inset = true }: { inset?: boolean }) {
  return <div className={inset ? 'ml-16' : ''} style={{ borderTop: '1px solid var(--a-border)' }} />
}

/** 36pt filled icon circle with a paired-foreground glyph (mob-06 row anatomy). */
function IconCircle({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: bg, color: 'var(--a-btn-fg)' }}
    >
      {children}
    </span>
  )
}

export default function MobileSettingsScreen({
  broker,
  role,
  email,
  avatarUrl,
  appVersion,
}: {
  broker: Broker | null
  role: string
  email: string
  avatarUrl: string | null
  appVersion: string
}) {
  const router = useRouter()
  const [prefs, setPrefs] = useState({
    newLeads: broker?.notifyNewLeads ?? true,
    dealActivity: broker?.notifyDealActivity ?? true,
    taskDue: broker?.notifyTaskDue ?? true,
    returnVisit: broker?.notifyReturnVisit ?? true,
    cmaReady: broker?.notifyCmaReady ?? true,
    appointment: broker?.notifyAppointment ?? true,
    sms: broker?.notifySms ?? false,
  })
  const [signature, setSignature] = useState(broker?.emailSignature ?? '')
  const [sigOpen, setSigOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function save(next: typeof prefs, payload: BrokerSettingsPayload) {
    if (!broker) return
    const prev = prefs
    setPrefs(next)
    setError(null)
    startTransition(async () => {
      const r = await saveBrokerSettingsAction(broker.id, payload)
      if (!r.ok) {
        setPrefs(prev)
        setError(r.error)
      }
    })
  }

  function saveSignature() {
    if (!broker) return
    setError(null)
    startTransition(async () => {
      const r = await saveBrokerSettingsAction(broker.id, { email_signature: signature })
      if (!r.ok) setError(r.error)
      else setSigOpen(false)
    })
  }

  const displayName = broker?.displayName ?? email
  const roleLabel = role === 'superuser' ? 'Admin' : role === 'broker' ? 'Broker' : 'Viewer'

  function close() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/admin/today')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col md:hidden"
      style={{ background: 'var(--a-inset)', color: 'var(--a-text)', fontFamily: 'var(--a-font)' }}
    >
      {/* ── Accent header: Close (left) · Settings (center) — mob-06 nav bar ── */}
      <div
        className="relative flex h-[50px] shrink-0 items-center px-4"
        style={{ background: 'var(--a-btn-bg)' }}
      >
        <button
          type="button"
          onClick={close}
          className="relative z-10 py-2 pr-4 text-[17px]"
          style={{ color: 'var(--a-btn-fg)' }}
        >
          Close
        </button>
        <span
          className="absolute inset-x-0 text-center text-[17px] font-semibold"
          style={{ color: 'var(--a-btn-fg)' }}
        >
          Settings
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* ── Profile card ── */}
        <div className="flex items-center gap-3 px-4 py-3" style={SECTION_STYLE}>
          <CrmAvatar name={displayName} src={avatarUrl} size={52} className="border border-[var(--a-border)]" />
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold" style={{ color: 'var(--a-text)' }}>{displayName}</p>
            <p className="text-sm" style={{ color: 'var(--a-text-2)' }}>{roleLabel}</p>
          </div>
        </div>

        <div className="h-4" />

        {/* ── Feature settings section ── */}
        <div style={SECTION_STYLE}>
          {/* App version — informational (warn circle, smartphone glyph) */}
          <div className="flex min-h-16 items-center gap-3 px-4 py-2.5">
            <IconCircle bg="var(--a-warn)">
              <Smartphone className="h-5 w-5" aria-hidden />
            </IconCircle>
            <div className="min-w-0">
              <p className="text-base font-semibold" style={{ color: 'var(--a-text)' }}>Your app is up to date</p>
              <p className="text-[13px]" style={{ color: 'var(--a-text-2)' }}>Currently using version {appVersion}</p>
            </div>
          </div>

          {broker ? (
            <>
              <RowDivider />
              {/* Notification prefs — Enabled/Disabled status rows, tap toggles */}
              <button
                type="button"
                onClick={() => save({ ...prefs, newLeads: !prefs.newLeads }, { notify_new_leads: !prefs.newLeads })}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <IconCircle bg="var(--a-accent-strong)">
                  <MessageSquare className="h-5 w-5" aria-hidden />
                </IconCircle>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold" style={{ color: 'var(--a-text)' }}>New lead alerts</p>
                  <p className="text-[13px]" style={{ color: 'var(--a-text-2)' }}>Get notified when a lead is assigned to you</p>
                </div>
                <span className="shrink-0 text-[15px]" style={{ color: 'var(--a-text-2)' }}>{prefs.newLeads ? 'Enabled' : 'Disabled'}</span>
              </button>
              <RowDivider />
              <button
                type="button"
                onClick={() => save({ ...prefs, dealActivity: !prefs.dealActivity }, { notify_deal_activity: !prefs.dealActivity })}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <IconCircle bg="var(--a-btn-bg)">
                  <Layers className="h-5 w-5" aria-hidden />
                </IconCircle>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold" style={{ color: 'var(--a-text)' }}>Deal activity alerts</p>
                  <p className="text-[13px]" style={{ color: 'var(--a-text-2)' }}>Alert when a deal you own is updated</p>
                </div>
                <span className="shrink-0 text-[15px]" style={{ color: 'var(--a-text-2)' }}>{prefs.dealActivity ? 'Enabled' : 'Disabled'}</span>
              </button>
              <RowDivider />
              <button
                type="button"
                onClick={() => save({ ...prefs, taskDue: !prefs.taskDue }, { notify_task_due: !prefs.taskDue })}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <IconCircle bg="var(--a-ok)">
                  <Phone className="h-5 w-5" aria-hidden />
                </IconCircle>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold" style={{ color: 'var(--a-text)' }}>Task due alerts</p>
                  <p className="text-[13px]" style={{ color: 'var(--a-text-2)' }}>Alert when a task assigned to you is due</p>
                </div>
                <span className="shrink-0 text-[15px]" style={{ color: 'var(--a-text-2)' }}>{prefs.taskDue ? 'Enabled' : 'Disabled'}</span>
              </button>
              <RowDivider />
              {/* Switch rows, not tappable rows: the admin-ui ratchet counts raw
                  <button> and only ever shrinks, so new prefs use the v2 Switch
                  the SMS row already uses. */}
              <div className="flex min-h-16 items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold" style={{ color: 'var(--a-text)' }}>Lead back on the site</p>
                  <p className="text-[13px]" style={{ color: 'var(--a-text-2)' }}>Alert when a lead you know views a home</p>
                </div>
                <Switch
                  label="Lead back on the site"
                  labelHidden
                  checked={prefs.returnVisit}
                  onChange={(e) => save({ ...prefs, returnVisit: e.target.checked }, { notify_return_visit: e.target.checked })}
                />
              </div>
              <RowDivider />
              <div className="flex min-h-16 items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold" style={{ color: 'var(--a-text)' }}>CMA ready to review</p>
                  <p className="text-[13px]" style={{ color: 'var(--a-text-2)' }}>Alert when a CMA draft is waiting on you</p>
                </div>
                <Switch
                  label="CMA ready to review"
                  labelHidden
                  checked={prefs.cmaReady}
                  onChange={(e) => save({ ...prefs, cmaReady: e.target.checked }, { notify_cma_ready: e.target.checked })}
                />
              </div>
              <RowDivider />
              <div className="flex min-h-16 items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold" style={{ color: 'var(--a-text)' }}>Appointment booked</p>
                  <p className="text-[13px]" style={{ color: 'var(--a-text-2)' }}>Alert when someone books time from the website</p>
                </div>
                <Switch
                  label="Appointment booked"
                  labelHidden
                  checked={prefs.appointment}
                  onChange={(e) => save({ ...prefs, appointment: e.target.checked }, { notify_appointment: e.target.checked })}
                />
              </div>
              <RowDivider inset={false} />
              {/* SMS alerts — the switch row (mob-06 row 5 anatomy: no icon) */}
              <div className="flex min-h-16 items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold" style={{ color: 'var(--a-text)' }}>Text me these alerts</p>
                  <p className="text-[13px]" style={{ color: 'var(--a-text-2)' }}>Also send alerts to your cell by SMS</p>
                </div>
                <Switch
                  label="Text me these alerts"
                  labelHidden
                  checked={prefs.sms}
                  onChange={(e) => save({ ...prefs, sms: e.target.checked }, { notify_sms: e.target.checked })}
                />
              </div>
            </>
          ) : (
            <>
              <RowDivider inset={false} />
              <p className="px-4 py-4 text-[13px]" style={{ color: 'var(--a-text-2)' }}>
                No broker profile found for {email}. Notification settings are only available for active brokers.
              </p>
            </>
          )}
        </div>

        <div className="h-4" />

        {/* ── Support / links section ── */}
        <div style={SECTION_STYLE}>
          <a href={`mailto:${CONTACT.email.primary}?subject=CRM%20bug%20report`} className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
            <span className="text-base" style={{ color: 'var(--a-text)' }}>Report a bug</span>
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--a-text-2)' }} aria-hidden />
          </a>
          <RowDivider inset={false} />
          <a href={`mailto:${CONTACT.email.primary}`} className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
            <span className="text-base" style={{ color: 'var(--a-text)' }}>Support</span>
            <span className="shrink-0 text-[13px]" style={{ color: 'var(--a-accent)' }}>{CONTACT.email.primary}</span>
          </a>
          {broker ? (
            <>
              <RowDivider inset={false} />
              <button
                type="button"
                onClick={() => setSigOpen(true)}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-2 text-left"
              >
                <span className="text-base" style={{ color: 'var(--a-text)' }}>Email signature</span>
                <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--a-text-2)' }} aria-hidden />
              </button>
            </>
          ) : null}
          <RowDivider inset={false} />
          <Link href="/admin/crm/settings" className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
            <span className="text-base" style={{ color: 'var(--a-text)' }}>CRM settings</span>
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--a-text-2)' }} aria-hidden />
          </Link>
          {role === 'superuser' ? (
            <>
              <RowDivider inset={false} />
              <Link href="/admin/crm/settings/company" className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
                <span className="text-base" style={{ color: 'var(--a-text)' }}>Company settings</span>
                <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--a-text-2)' }} aria-hidden />
              </Link>
            </>
          ) : null}
        </div>

        {error ? <p className="px-4 py-3 text-[13px]" style={{ color: 'var(--a-danger)' }}>{error}</p> : null}

        {/* Bottom safe-area gap */}
        <div className="h-21 pb-[env(safe-area-inset-bottom)]" />
      </div>

      {/* ── Email signature editor sheet ── */}
      <Sheet
        open={sigOpen}
        onClose={() => setSigOpen(false)}
        title="Email signature"
        description="Used as your signature on emails you send from the CRM. Leave blank to use the standard Ryan Realty signature. Plain text only."
      >
        <textarea
          className="av2-input w-full"
          aria-label="Email signature"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder={`${displayName}\nRyan Realty · ${CONTACT.phoneDirect} · ${BRAND.domain}`}
          rows={5}
          maxLength={4000}
          style={{ fontFamily: 'var(--a-font-mono)' }}
        />
        <p className="text-right text-xs" style={{ color: 'var(--a-text-2)' }}>{signature.length}/4,000</p>
        {/* The sheet's own padding stops at the viewport edge; the old bottom
            sheet reserved the home-indicator inset, so keep that reserve here. */}
        <div className="pb-[env(safe-area-inset-bottom)]">
          <Button type="button" onClick={saveSignature} className="w-full">
            Save signature
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

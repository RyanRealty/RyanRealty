'use client'

/**
 * MobileSettingsScreen — the < md Settings surface (mob-06 fub-ios Settings
 * modal, re-skinned to Ryan Realty tokens per the in-house rebuild notes in
 * docs/fub-crm-spec/mobile-screens/screen-06.md).
 *
 * Structure (390×844 reference):
 *   - Full-screen modal (fixed inset-0, occludes tab bar + FAB — no shell
 *     chrome behind), navy header with left "Close" + centered "Settings".
 *   - Profile card: 52pt avatar + name + role.
 *   - Feature settings section: icon-circle rows (app version informational,
 *     three notification prefs with Enabled/Disabled status labels that toggle
 *     on tap, and the SMS-alerts switch row) — all wired to the broker's real
 *     row via saveBrokerSettingsAction (immediate save, iOS pattern).
 *   - Support / links section: Report a bug, Support email, Email signature
 *     (sheet editor), CRM settings, Company settings.
 *
 * FUB-specific rows (Zillow, FUB support emails, app-store version) are
 * replaced with the Ryan Realty equivalents per the spec's own rebuild notes.
 * Desktop (md+) keeps MySettingsForm unchanged.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Smartphone, MessageSquare, Layers, Phone } from 'lucide-react'
import { CrmAvatar } from '@/components/admin/crm/mobile/CrmMobileKit'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { saveBrokerSettingsAction, type BrokerSettingsPayload } from '@/app/actions/broker-settings'
import { CONTACT, BRAND } from '@/lib/brand/contact'

type Broker = {
  id: string
  displayName: string
  notifyNewLeads: boolean
  notifyDealActivity: boolean
  notifyTaskDue: boolean
  notifySms: boolean
  emailSignature: string
}

/** 1pt hairline divider, inset past the icon column (mob-06 spacing spec). */
function RowDivider({ inset = true }: { inset?: boolean }) {
  return <div className={inset ? 'ml-16 border-t border-border' : 'border-t border-border'} />
}

/** 36pt filled icon circle with a white glyph (mob-06 feature-row anatomy). */
function IconCircle({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
      style={{ backgroundColor: bg }}
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
    else router.push('/admin/broker-dashboard')
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-muted md:hidden">
      {/* ── Navy header: Close (left) · Settings (center) — mob-06 nav bar ── */}
      <div className="relative flex h-[50px] shrink-0 items-center bg-primary px-4">
        <button
          type="button"
          onClick={close}
          className="relative z-10 py-2 pr-4 text-[17px] text-primary-foreground"
        >
          Close
        </button>
        <span className="absolute inset-x-0 text-center text-[17px] font-semibold text-primary-foreground">
          Settings
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* ── Profile card ── */}
        <div className="flex items-center gap-3 bg-card px-4 py-3">
          <CrmAvatar name={displayName} src={avatarUrl} size={52} className="border border-border" />
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold text-foreground">{displayName}</p>
            <p className="text-sm text-muted-foreground">{roleLabel}</p>
          </div>
        </div>

        <div className="h-4" />

        {/* ── Feature settings section ── */}
        <div className="bg-card">
          {/* App version — informational (orange circle, smartphone glyph) */}
          <div className="flex min-h-16 items-center gap-3 px-4 py-2.5">
            <IconCircle bg="#F5943C">
              <Smartphone className="h-5 w-5" aria-hidden />
            </IconCircle>
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground">Your app is up to date</p>
              <p className="text-[13px] text-muted-foreground">Currently using version {appVersion}</p>
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
                <IconCircle bg="#9B59B6">
                  <MessageSquare className="h-5 w-5" aria-hidden />
                </IconCircle>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-foreground">New lead alerts</p>
                  <p className="text-[13px] text-muted-foreground">Get notified when a lead is assigned to you</p>
                </div>
                <span className="shrink-0 text-[15px] text-muted-foreground">{prefs.newLeads ? 'Enabled' : 'Disabled'}</span>
              </button>
              <RowDivider />
              <button
                type="button"
                onClick={() => save({ ...prefs, dealActivity: !prefs.dealActivity }, { notify_deal_activity: !prefs.dealActivity })}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <IconCircle bg="#2B7CD3">
                  <Layers className="h-5 w-5" aria-hidden />
                </IconCircle>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-foreground">Deal activity alerts</p>
                  <p className="text-[13px] text-muted-foreground">Alert when a deal you own is updated</p>
                </div>
                <span className="shrink-0 text-[15px] text-muted-foreground">{prefs.dealActivity ? 'Enabled' : 'Disabled'}</span>
              </button>
              <RowDivider />
              <button
                type="button"
                onClick={() => save({ ...prefs, taskDue: !prefs.taskDue }, { notify_task_due: !prefs.taskDue })}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <IconCircle bg="#27AE60">
                  <Phone className="h-5 w-5" aria-hidden />
                </IconCircle>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-foreground">Task due alerts</p>
                  <p className="text-[13px] text-muted-foreground">Alert when a task assigned to you is due</p>
                </div>
                <span className="shrink-0 text-[15px] text-muted-foreground">{prefs.taskDue ? 'Enabled' : 'Disabled'}</span>
              </button>
              <RowDivider inset={false} />
              {/* SMS alerts — the switch row (mob-06 row 5 anatomy: no icon) */}
              <div className="flex min-h-16 items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-foreground">Text me these alerts</p>
                  <p className="text-[13px] text-muted-foreground">Also send alerts to your cell by SMS</p>
                </div>
                <Switch
                  checked={prefs.sms}
                  onCheckedChange={(v) => save({ ...prefs, sms: v }, { notify_sms: v })}
                  aria-label="Text me these alerts"
                />
              </div>
            </>
          ) : (
            <>
              <RowDivider inset={false} />
              <p className="px-4 py-4 text-[13px] text-muted-foreground">
                No broker profile found for {email}. Notification settings are only available for active brokers.
              </p>
            </>
          )}
        </div>

        <div className="h-4" />

        {/* ── Support / links section ── */}
        <div className="bg-card">
          <a href={`mailto:${CONTACT.email.primary}?subject=CRM%20bug%20report`} className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
            <span className="text-base text-foreground">Report a bug</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </a>
          <RowDivider inset={false} />
          <a href={`mailto:${CONTACT.email.primary}`} className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
            <span className="text-base text-foreground">Support</span>
            <span className="shrink-0 text-[13px]" style={{ color: 'var(--console-info)' }}>{CONTACT.email.primary}</span>
          </a>
          {broker ? (
            <>
              <RowDivider inset={false} />
              <button
                type="button"
                onClick={() => setSigOpen(true)}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-2 text-left"
              >
                <span className="text-base text-foreground">Email signature</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </>
          ) : null}
          <RowDivider inset={false} />
          <Link href="/admin/crm/settings" className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
            <span className="text-base text-foreground">CRM settings</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
          {role === 'superuser' ? (
            <>
              <RowDivider inset={false} />
              <Link href="/admin/crm/settings/company" className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
                <span className="text-base text-foreground">Company settings</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </>
          ) : null}
        </div>

        {error ? <p className="px-4 py-3 text-[13px] text-destructive">{error}</p> : null}

        {/* Bottom safe-area gap */}
        <div className="h-21 pb-[env(safe-area-inset-bottom)]" />
      </div>

      {/* ── Email signature editor sheet ── */}
      <Sheet open={sigOpen} onOpenChange={setSigOpen}>
        <SheetContent side="bottom" className="gap-0 rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <SheetTitle className="text-base">Email signature</SheetTitle>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Appended to emails you send from the CRM compose screen. Plain text only.
          </p>
          <Textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder={`${displayName}\nRyan Realty · ${CONTACT.phoneDirect} · ${BRAND.domain}`}
            rows={5}
            maxLength={4000}
            className="mt-3 resize-y font-mono text-sm"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">{signature.length}/4,000</p>
          <Button type="button" onClick={saveSignature} className="mt-3 w-full">
            Save signature
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  )
}

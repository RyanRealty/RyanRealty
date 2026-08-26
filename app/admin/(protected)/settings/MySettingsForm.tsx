'use client'

/**
 * Client component for My Settings — toggle notifications + edit email signature.
 * Calls saveBrokerSettingsAction on submit.
 *
 * 11F: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only — every prop, handler, state transition, conditional and
 * visible string is unchanged. Two swaps that are not a straight colour rename:
 *
 *  - the notification rows keep their own <label htmlFor>, so tapping the row's
 *    text still toggles the control the way it always did. The v2 Switch is a
 *    native checkbox with role="switch"; it carries the accessible name via
 *    `label` + `labelHidden`, exactly what the old pair did.
 *  - the fallback-signature box stays a raw control on `av2-input` with an
 *    aria-label. The labelled TextAreaField prints a visible heading above the
 *    box, and this section's own heading already names it — the folder's rule
 *    (MobileNotesTab, MobileEditSheet, MobileCalendarTab) is that dropping the
 *    visible label never drops the accessible one. It gains a name it never had.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, SectionHead, SelectField, Switch, TextField } from '@/components/admin/v2'
import { saveBrokerSettingsAction, syncGmailSignatureAction } from '@/app/actions/broker-settings'
import { buildEmailPreviewDoc } from '@/lib/crm/email-body'
import { CONTACT, BRAND } from '@/lib/brand/contact'

/** The section card: the lightest surface in the language, held by a hairline. */
const CARD_STYLE = { borderColor: 'var(--a-border)', background: 'var(--a-bg)' } as const

/**
 * Hour choices for the quiet window. Value is the 24h number the column stores,
 * label is the 12h clock a broker reads.
 */
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`,
}))

/** Hairline rule between notification rows (replaces the shadcn Separator). */
function RowRule() {
  return <div style={{ height: 1, background: 'var(--a-border)' }} />
}

type Props = {
  brokerId: string
  displayName: string
  notifyNewLeads: boolean
  notifyDealActivity: boolean
  notifyTaskDue: boolean
  notifyReturnVisit: boolean
  notifyCmaReady: boolean
  notifyAppointment: boolean
  notifySms: boolean
  /** Personal quiet window for internal alerts, local hour 0-23. null = none. */
  notifyQuietStartHour: number | null
  notifyQuietEndHour: number | null
  /** Cap on alerts per rolling 24h. null = unlimited. */
  notifyMaxPerDay: number | null
  emailSignature: string
  /** Gmail-synced signature (brokers.gmail_signature_html) — when set it is
   *  THE signature on every CRM email, so CRM sends match Gmail exactly. */
  gmailSignatureHtml?: string | null
  gmailSignatureSyncedAt?: string | null
  socialInstagram?: string
  socialFacebook?: string
  socialLinkedin?: string
}

export default function MySettingsForm({
  brokerId,
  displayName,
  notifyNewLeads: initNewLeads,
  notifyDealActivity: initDealActivity,
  notifyTaskDue: initTaskDue,
  notifyReturnVisit: initReturnVisit,
  notifyCmaReady: initCmaReady,
  notifyAppointment: initAppointment,
  notifySms: initSms,
  notifyQuietStartHour: initQuietStart,
  notifyQuietEndHour: initQuietEnd,
  notifyMaxPerDay: initMaxPerDay,
  emailSignature: initSig,
  gmailSignatureHtml = null,
  gmailSignatureSyncedAt = null,
  socialInstagram: initIg = '',
  socialFacebook: initFb = '',
  socialLinkedin: initLi = '',
}: Props) {
  const router = useRouter()
  const [notifyNewLeads, setNotifyNewLeads] = useState(initNewLeads)
  const [notifyDealActivity, setNotifyDealActivity] = useState(initDealActivity)
  const [notifyTaskDue, setNotifyTaskDue] = useState(initTaskDue)
  const [notifyReturnVisit, setNotifyReturnVisit] = useState(initReturnVisit)
  const [notifyCmaReady, setNotifyCmaReady] = useState(initCmaReady)
  const [notifyAppointment, setNotifyAppointment] = useState(initAppointment)
  const [notifySms, setNotifySms] = useState(initSms)
  // The three volume controls are held as strings because a <select> value is a
  // string and '' is the "not set" option. They convert on save.
  const [quietStart, setQuietStart] = useState(initQuietStart == null ? '' : String(initQuietStart))
  const [quietEnd, setQuietEnd] = useState(initQuietEnd == null ? '' : String(initQuietEnd))
  const [maxPerDay, setMaxPerDay] = useState(initMaxPerDay == null ? '' : String(initMaxPerDay))
  const [emailSignature, setEmailSignature] = useState(initSig)
  const [socialInstagram, setSocialInstagram] = useState(initIg)
  const [socialFacebook, setSocialFacebook] = useState(initFb)
  const [socialLinkedin, setSocialLinkedin] = useState(initLi)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function handleGmailSync() {
    setSyncing(true)
    setSyncMessage(null)
    const result = await syncGmailSignatureAction()
    setSyncing(false)
    if (result.ok) {
      const withSig = result.mailboxes.filter((m) => m.signatureChars > 0)
      setSyncMessage({
        ok: true,
        text: withSig.length
          ? 'Synced from Gmail. Your CRM emails now use this signature.'
          : 'Synced, but no signature is set in Gmail for this mailbox.',
      })
      router.refresh()
    } else {
      setSyncMessage({ ok: false, text: result.error })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const result = await saveBrokerSettingsAction(brokerId, {
      notify_new_leads: notifyNewLeads,
      notify_deal_activity: notifyDealActivity,
      notify_task_due: notifyTaskDue,
      notify_return_visit: notifyReturnVisit,
      notify_cma_ready: notifyCmaReady,
      notify_appointment: notifyAppointment,
      notify_sms: notifySms,
      notify_quiet_start_hour: quietStart === '' ? null : Number(quietStart),
      notify_quiet_end_hour: quietEnd === '' ? null : Number(quietEnd),
      notify_max_per_day: maxPerDay === '' ? null : Number(maxPerDay),
      email_signature: emailSignature,
      social_instagram: socialInstagram,
      social_facebook: socialFacebook,
      social_linkedin: socialLinkedin,
    })
    setSaving(false)
    setMessage(result.ok
      ? { ok: true, text: 'Settings saved.' }
      : { ok: false, text: result.error }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Notifications section */}
      <section className="rounded-xl border px-6 py-5 space-y-5" style={CARD_STYLE}>
        <SectionHead flush>Notifications</SectionHead>
        <p className="text-xs -mt-2" style={{ color: 'var(--a-text-2)' }}>
          Controls which events trigger an alert for {displayName}.
        </p>

        <NotifToggle
          id="notify-leads"
          label="New lead assigned"
          description="Alert when a lead is routed or assigned to you."
          checked={notifyNewLeads}
          onChange={setNotifyNewLeads}
        />
        <RowRule />
        <NotifToggle
          id="notify-deals"
          label="Deal activity"
          description="Alert when a deal you own is updated (stage change, new document, etc.)."
          checked={notifyDealActivity}
          onChange={setNotifyDealActivity}
        />
        <RowRule />
        <NotifToggle
          id="notify-tasks"
          label="Task due"
          description="Alert when a task assigned to you is due or overdue."
          checked={notifyTaskDue}
          onChange={setNotifyTaskDue}
        />
        <RowRule />
        <NotifToggle
          id="notify-return-visit"
          label="Lead back on the site"
          description="Alert when a lead you know comes back and views a home."
          checked={notifyReturnVisit}
          onChange={setNotifyReturnVisit}
        />
        <RowRule />
        <NotifToggle
          id="notify-cma-ready"
          label="CMA ready to review"
          description="Alert when a CMA draft finishes building and is waiting on you."
          checked={notifyCmaReady}
          onChange={setNotifyCmaReady}
        />
        <RowRule />
        <NotifToggle
          id="notify-appointment"
          label="Appointment booked"
          description="Alert when someone books time on your calendar from the website."
          checked={notifyAppointment}
          onChange={setNotifyAppointment}
        />
        <RowRule />
        <NotifToggle
          id="notify-sms"
          label="Text me these alerts (SMS)"
          description="Off by default. When on, your lead and activity alerts are also sent to your cell by text."
          checked={notifySms}
          onChange={setNotifySms}
        />
      </section>

      {/* How often — the volume controls. These never drop an alert: anything
          they hold back still lands in the CRM and on web push, it just does
          not text. Switch a category off above to stop one entirely. */}
      <section className="rounded-xl border px-6 py-5 space-y-5" style={CARD_STYLE}>
        <SectionHead>How often</SectionHead>
        <p className="text-xs -mt-2" style={{ color: 'var(--a-text-2)' }}>
          Limits on the texts, not on the alerts. Anything held back is still waiting in the CRM.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Quiet from"
            value={quietStart}
            onChange={(e) => setQuietStart(e.target.value)}
          >
            <option value="">No quiet hours</option>
            {HOUR_OPTIONS.map((h) => (
              <option key={h.value} value={h.value}>{h.label}</option>
            ))}
          </SelectField>
          <SelectField
            label="Quiet until"
            value={quietEnd}
            onChange={(e) => setQuietEnd(e.target.value)}
          >
            <option value="">No quiet hours</option>
            {HOUR_OPTIONS.map((h) => (
              <option key={h.value} value={h.value}>{h.label}</option>
            ))}
          </SelectField>
        </div>
        <p className="text-xs -mt-1" style={{ color: 'var(--a-text-2)' }}>
          Pacific time. Set both to switch the window on.
        </p>

        <SelectField
          label="Most texts per day"
          value={maxPerDay}
          onChange={(e) => setMaxPerDay(e.target.value)}
        >
          <option value="">No limit</option>
          {[5, 10, 15, 20, 30, 50].map((n) => (
            <option key={n} value={String(n)}>{n} a day</option>
          ))}
        </SelectField>
      </section>

      {/* Gmail signature section — the highest-precedence signature source. */}
      <section className="rounded-xl border px-6 py-5 space-y-4" style={CARD_STYLE}>
        <SectionHead flush>Gmail signature</SectionHead>
        <p className="text-xs -mt-2" style={{ color: 'var(--a-text-2)' }}>
          Your real Gmail signature, synced from your mailbox. When synced, every email you
          send from the CRM carries this exact signature, so CRM emails match your Gmail
          emails. Re-syncs automatically every few hours. The Oregon agency disclosure link
          is always included.
        </p>
        {gmailSignatureHtml ? (
          <iframe
            title="Gmail signature preview"
            sandbox=""
            srcDoc={buildEmailPreviewDoc('', gmailSignatureHtml)}
            className="h-40 w-full rounded-lg border"
            style={CARD_STYLE}
          />
        ) : (
          <p className="text-sm" style={{ color: 'var(--a-text-2)' }}>
            Not synced yet. Sync now so your CRM emails match your Gmail signature.
          </p>
        )}
        <div className="flex items-center gap-4">
          <Button type="button" variant="quiet" onClick={handleGmailSync} disabled={syncing}>
            {syncing ? 'Syncing…' : gmailSignatureHtml ? 'Re-sync from Gmail' : 'Sync from Gmail'}
          </Button>
          {gmailSignatureSyncedAt ? (
            <span className="text-xs" style={{ color: 'var(--a-text-2)' }}>
              Last synced {new Date(gmailSignatureSyncedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })}
            </span>
          ) : null}
        </div>
        {syncMessage ? (
          <p className="text-sm" style={{ color: syncMessage.ok ? 'var(--a-ok)' : 'var(--a-danger)' }}>{syncMessage.text}</p>
        ) : null}
      </section>

      {/* Fallback (custom plain-text) signature section */}
      <section className="rounded-xl border px-6 py-5 space-y-4" style={CARD_STYLE}>
        <SectionHead flush>Fallback signature</SectionHead>
        <p className="text-xs -mt-2" style={{ color: 'var(--a-text-2)' }}>
          Used only when no Gmail signature is synced. Leave blank to use the standard
          Ryan Realty signature. Plain text only. The Oregon agency disclosure link is
          always included.
        </p>
        <textarea
          id="email-signature"
          className="av2-input w-full"
          aria-label="Fallback signature"
          value={emailSignature}
          onChange={(e) => setEmailSignature(e.target.value)}
          placeholder={`${displayName}\nRyan Realty · ${CONTACT.phoneDirect} · ${BRAND.domain}`}
          rows={5}
          maxLength={4000}
          style={{ fontFamily: 'var(--a-font-mono)' }}
        />
        <p className="text-xs text-right" style={{ color: 'var(--a-text-2)' }}>{emailSignature.length}/4,000</p>
      </section>

      <section className="rounded-xl border px-6 py-5 space-y-4" style={CARD_STYLE}>
        <SectionHead>Your socials</SectionHead>
        <p className="text-xs -mt-2" style={{ color: 'var(--a-text-2)' }}>
          Public profile URLs for your book. https only. Connecting a personal ad account is a
          separate Matt-approved OAuth step.
        </p>
        <TextField
          label="Instagram"
          type="url"
          value={socialInstagram}
          onChange={(e) => setSocialInstagram(e.target.value)}
          placeholder="https://instagram.com/you"
          maxLength={500}
        />
        <TextField
          label="Facebook"
          type="url"
          value={socialFacebook}
          onChange={(e) => setSocialFacebook(e.target.value)}
          placeholder="https://facebook.com/you"
          maxLength={500}
        />
        <TextField
          label="LinkedIn"
          type="url"
          value={socialLinkedin}
          onChange={(e) => setSocialLinkedin(e.target.value)}
          placeholder="https://linkedin.com/in/you"
          maxLength={500}
        />
      </section>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={saving} className="min-w-[120px]">
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
        {message && (
          <p className="text-sm" style={{ color: message.ok ? 'var(--a-ok)' : 'var(--a-danger)' }}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  )
}

function NotifToggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        {/* The row's own label still points at the control, so its text stays a
            tap target. The Switch's `label` is the ACCESSIBLE name (aria-label
            wins the name computation), which is the same name this printed
            before. */}
        <label
          htmlFor={id}
          className="flex items-center gap-2 text-sm leading-none font-medium select-none cursor-pointer"
          style={{ color: 'var(--a-text)' }}
        >
          {label}
        </label>
        <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>{description}</p>
      </div>
      <Switch
        id={id}
        label={label}
        labelHidden
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  )
}

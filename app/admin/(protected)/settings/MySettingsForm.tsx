'use client'

/**
 * Client component for My Settings — toggle notifications + edit email signature.
 * Calls saveBrokerSettingsAction on submit.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { saveBrokerSettingsAction, syncGmailSignatureAction } from '@/app/actions/broker-settings'
import { buildEmailPreviewDoc } from '@/lib/crm/email-body'
import { CONTACT, BRAND } from '@/lib/brand/contact'

type Props = {
  brokerId: string
  displayName: string
  notifyNewLeads: boolean
  notifyDealActivity: boolean
  notifyTaskDue: boolean
  notifySms: boolean
  emailSignature: string
  /** Gmail-synced signature (brokers.gmail_signature_html) — when set it is
   *  THE signature on every CRM email, so CRM sends match Gmail exactly. */
  gmailSignatureHtml?: string | null
  gmailSignatureSyncedAt?: string | null
}

export default function MySettingsForm({
  brokerId,
  displayName,
  notifyNewLeads: initNewLeads,
  notifyDealActivity: initDealActivity,
  notifyTaskDue: initTaskDue,
  notifySms: initSms,
  emailSignature: initSig,
  gmailSignatureHtml = null,
  gmailSignatureSyncedAt = null,
}: Props) {
  const router = useRouter()
  const [notifyNewLeads, setNotifyNewLeads] = useState(initNewLeads)
  const [notifyDealActivity, setNotifyDealActivity] = useState(initDealActivity)
  const [notifyTaskDue, setNotifyTaskDue] = useState(initTaskDue)
  const [notifySms, setNotifySms] = useState(initSms)
  const [emailSignature, setEmailSignature] = useState(initSig)
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
      notify_sms: notifySms,
      email_signature: emailSignature,
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
      <section className="rounded-xl border border-border bg-card px-6 py-5 space-y-5">
        <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
        <p className="text-xs text-muted-foreground -mt-2">
          Controls which events trigger an alert for {displayName}.
        </p>

        <NotifToggle
          id="notify-leads"
          label="New lead assigned"
          description="Alert when a lead is routed or assigned to you."
          checked={notifyNewLeads}
          onChange={setNotifyNewLeads}
        />
        <Separator />
        <NotifToggle
          id="notify-deals"
          label="Deal activity"
          description="Alert when a deal you own is updated (stage change, new document, etc.)."
          checked={notifyDealActivity}
          onChange={setNotifyDealActivity}
        />
        <Separator />
        <NotifToggle
          id="notify-tasks"
          label="Task due"
          description="Alert when a task assigned to you is due or overdue."
          checked={notifyTaskDue}
          onChange={setNotifyTaskDue}
        />
        <Separator />
        <NotifToggle
          id="notify-sms"
          label="Text me these alerts (SMS)"
          description="Off by default. When on, your lead and activity alerts are also sent to your cell by text."
          checked={notifySms}
          onChange={setNotifySms}
        />
      </section>

      {/* Gmail signature section — the highest-precedence signature source. */}
      <section className="rounded-xl border border-border bg-card px-6 py-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Gmail signature</h2>
        <p className="text-xs text-muted-foreground -mt-2">
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
            className="h-40 w-full rounded-lg border border-border bg-card"
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Not synced yet. Sync now so your CRM emails match your Gmail signature.
          </p>
        )}
        <div className="flex items-center gap-4">
          <Button type="button" variant="outline" size="sm" onClick={handleGmailSync} disabled={syncing}>
            {syncing ? 'Syncing…' : gmailSignatureHtml ? 'Re-sync from Gmail' : 'Sync from Gmail'}
          </Button>
          {gmailSignatureSyncedAt ? (
            <span className="text-xs text-muted-foreground">
              Last synced {new Date(gmailSignatureSyncedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })}
            </span>
          ) : null}
        </div>
        {syncMessage ? (
          <p className={`text-sm ${syncMessage.ok ? 'text-success' : 'text-destructive'}`}>{syncMessage.text}</p>
        ) : null}
      </section>

      {/* Fallback (custom plain-text) signature section */}
      <section className="rounded-xl border border-border bg-card px-6 py-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Fallback signature</h2>
        <p className="text-xs text-muted-foreground -mt-2">
          Used only when no Gmail signature is synced. Leave blank to use the standard
          Ryan Realty signature. Plain text only. The Oregon agency disclosure link is
          always included.
        </p>
        <Textarea
          id="email-signature"
          value={emailSignature}
          onChange={(e) => setEmailSignature(e.target.value)}
          placeholder={`${displayName}\nRyan Realty · ${CONTACT.phoneDirect} · ${BRAND.domain}`}
          rows={5}
          maxLength={4000}
          className="font-mono text-sm resize-y"
        />
        <p className="text-xs text-muted-foreground text-right">{emailSignature.length}/4,000</p>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={saving} className="min-w-[120px]">
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
        {message && (
          <p className={`text-sm ${message.ok ? 'text-success' : 'text-destructive'}`}>
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
        <Label htmlFor={id} className="text-sm font-medium text-foreground cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

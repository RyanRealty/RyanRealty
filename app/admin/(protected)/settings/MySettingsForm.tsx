'use client'

/**
 * Client component for My Settings — toggle notifications + edit email signature.
 * Calls saveBrokerSettingsAction on submit.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { saveBrokerSettingsAction } from '@/app/actions/broker-settings'
import { CONTACT, BRAND } from '@/lib/brand/contact'

type Props = {
  brokerId: string
  displayName: string
  notifyNewLeads: boolean
  notifyDealActivity: boolean
  notifyTaskDue: boolean
  emailSignature: string
}

export default function MySettingsForm({
  brokerId,
  displayName,
  notifyNewLeads: initNewLeads,
  notifyDealActivity: initDealActivity,
  notifyTaskDue: initTaskDue,
  emailSignature: initSig,
}: Props) {
  const [notifyNewLeads, setNotifyNewLeads] = useState(initNewLeads)
  const [notifyDealActivity, setNotifyDealActivity] = useState(initDealActivity)
  const [notifyTaskDue, setNotifyTaskDue] = useState(initTaskDue)
  const [emailSignature, setEmailSignature] = useState(initSig)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const result = await saveBrokerSettingsAction(brokerId, {
      notify_new_leads: notifyNewLeads,
      notify_deal_activity: notifyDealActivity,
      notify_task_due: notifyTaskDue,
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
      </section>

      {/* Email signature section */}
      <section className="rounded-xl border border-border bg-card px-6 py-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Email signature</h2>
        <p className="text-xs text-muted-foreground -mt-2">
          Appended to emails you send from the CRM compose screen. Plain text only.
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

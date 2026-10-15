'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/admin/v2'
import { setPersonChannelConsentAction } from '@/app/actions/crm-person-consent'
import type { ChannelConsentView, ConsentChannel } from '@/lib/crm/person-channel-consent'

export function PersonConsentEditor({
  personId,
  sms,
  email,
  call,
}: {
  personId: number
  sms: ChannelConsentView
  email: ChannelConsentView
  call: ChannelConsentView
}) {
  const [pending, start] = useTransition()

  const toggle = (channel: ConsentChannel, allowed: boolean, lockedReason: string | null) => {
    if (pending) return
    if (allowed && lockedReason) {
      toast.error(`Cannot set ${channel} to allowed (${lockedReason})`)
      return
    }
    start(async () => {
      const r = await setPersonChannelConsentAction({ personId, channel, allowed })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`${channel === 'sms' ? 'SMS' : channel === 'email' ? 'Email' : 'Call'} consent updated`)
    })
  }

  return (
    <div aria-label="Consent" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ConsentRow
        label="SMS"
        view={sms}
        disabled={pending}
        onChange={(allowed) => toggle('sms', allowed, sms.lockedReason)}
      />
      <ConsentRow
        label="Email"
        view={email}
        disabled={pending}
        onChange={(allowed) => toggle('email', allowed, email.lockedReason)}
      />
      <ConsentRow
        label="Call"
        view={call}
        disabled={pending}
        onChange={(allowed) => toggle('call', allowed, call.lockedReason)}
      />
    </div>
  )
}

function ConsentRow({
  label,
  view,
  disabled,
  onChange,
}: {
  label: string
  view: ChannelConsentView
  disabled: boolean
  onChange: (allowed: boolean) => void
}) {
  const locked = Boolean(view.lockedReason)
  return (
    <div>
      <Switch
        label={label}
        stateText={view.allowed ? 'allowed' : locked ? `declined (${view.lockedReason})` : 'declined'}
        checked={view.allowed}
        disabled={disabled || (locked && !view.allowed)}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
    </div>
  )
}

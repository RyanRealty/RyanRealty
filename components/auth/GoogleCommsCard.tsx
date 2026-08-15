'use client'

import { useId, useState } from 'react'
import { persistGoogleCommsConsent } from '@/app/actions/google-comms-consent'
import { fireFirstPartyEvent } from '@/components/VisitTracker'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleIcon } from '@/components/icons/AuthProviderIcons'
import {
  GOOGLE_COMMS_COOKIE,
  GOOGLE_COMMS_MAX_AGE_SEC,
  emptyGoogleCommsConsent,
  serializeGoogleCommsConsent,
  type GoogleCommsConsent,
} from '@/lib/auth/google-comms-consent'
import { cn } from '@/lib/utils'

export type { GoogleCommsConsent }

export async function persistGoogleCommsBeforeOAuth(consent: GoogleCommsConsent): Promise<void> {
  if (consent.emailOpt) {
    fireFirstPartyEvent('email_opt', { metadata: { source: 'google_comms' } })
  }
  if (consent.smsOpt) {
    fireFirstPartyEvent('sms_opt', { metadata: { source: 'google_comms' } })
  }
  try {
    const res = await persistGoogleCommsConsent(consent)
    if (res.ok) return
  } catch {
    // Fall through to a first-party cookie the callback can still read.
  }
  if (typeof document === 'undefined') return
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${GOOGLE_COMMS_COOKIE}=${serializeGoogleCommsConsent(consent)}; Path=/; Max-Age=${GOOGLE_COMMS_MAX_AGE_SEC}; SameSite=Lax${secure}`
}

export function useGoogleCommsConsent() {
  const [consent, setConsent] = useState<GoogleCommsConsent>(emptyGoogleCommsConsent)
  return {
    consent,
    setConsent,
    persist: () => persistGoogleCommsBeforeOAuth(consent),
  }
}

export function GoogleCommsCard({
  consent,
  onChange,
  className,
}: {
  consent: GoogleCommsConsent
  onChange: (next: GoogleCommsConsent) => void
  className?: string
}) {
  const emailId = useId()
  return (
    <div className={cn('space-y-3', className)}>
      <div className="space-y-1.5">
        <Label htmlFor={`${emailId}-phone`} className="text-sm font-medium text-muted-foreground">
          Phone (optional)
        </Label>
        <Input
          id={`${emailId}-phone`}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          name="phone"
          placeholder="541-555-0100"
          value={consent.phone}
          onChange={(e) => onChange({ ...consent, phone: e.target.value })}
        />
      </div>
      <div className="flex items-start gap-2">
        <Checkbox
          id={emailId}
          name="emailOpt"
          checked={consent.emailOpt}
          onCheckedChange={(c) => onChange({ ...consent, emailOpt: c === true })}
        />
        <Label htmlFor={emailId} className="cursor-pointer text-xs leading-relaxed text-muted-foreground">
          Email me listing and market updates.
        </Label>
      </div>
      <SmsConsentDisclosure
        checked={consent.smsOpt}
        onCheckedChange={(checked) => onChange({ ...consent, smsOpt: checked })}
      />
    </div>
  )
}

export function GoogleContinueButton({
  loading,
  disabled,
  onClick,
  className,
  variant = 'default',
}: {
  loading?: boolean
  disabled?: boolean
  onClick: () => void
  className?: string
  variant?: 'default' | 'outline'
}) {
  return (
    <Button
      type="button"
      variant={variant}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn('flex w-full items-center justify-center gap-3', className)}
    >
      <GoogleIcon className="size-5" />
      {loading ? 'Redirecting…' : 'Continue with Google'}
    </Button>
  )
}

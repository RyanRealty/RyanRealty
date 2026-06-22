'use client'

import { useId } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

/**
 * Carrier-required SMS/TCPA consent CHECKBOX rendered at every lead form that
 * collects a phone number (A2P 10DLC, Twilio ticket 27497858).
 *
 * Per carrier (Trust & Safety) review this MUST be an explicit, unchecked-by-
 * default checkbox dedicated to SMS, SEPARATE from any voice-call consent. The
 * sentence below is quoted verbatim in the Twilio A2P campaign message_flow
 * (messaging service MG592bf50afb3f10e6f1078995dae496e4) and carriers verify it
 * word-for-word on the live forms. Do NOT reword without updating the three
 * lock-step copies (this file, scripts/check-sms-consent-compliance.mjs EXACT,
 * scripts/crm-a2p-resubmit.mjs CONSENT_TEXT) and re-submitting the A2P campaign.
 *
 * The checkbox renders a named form input (`name="smsConsent"`, value "yes").
 * SMS is fail-closed: lib/crm/enroll.ts autoEnrollByFubId only leaves SMS
 * enabled when the action passes smsConsent:true; otherwise it suppresses the
 * sms channel. Email + voice are unaffected. Compliance language is exempt from
 * brand-voice styling per CLAUDE.md.
 */
export const SMS_CONSENT_TEXT =
  'I agree to receive text messages from Ryan Realty about my request, including property and home-value updates, scheduling, and replies from our team, at the phone number I provided. Consent is not a condition of any purchase or service. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.'

export function SmsConsentDisclosure({
  className,
  tone = 'default',
  name = 'smsConsent',
  checked,
  onCheckedChange,
}: {
  className?: string
  /** 'on-dark' for navy/photo surfaces (cream text). */
  tone?: 'default' | 'on-dark'
  /** Form field name submitted when checked (value "yes"). */
  name?: string
  /**
   * Controlled checkbox state. Omit on FormData-posting forms (the named input is
   * captured automatically as `smsConsent=yes`). Pass on forms that build a typed
   * payload from React state, so the value can be threaded to the action.
   */
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  const id = useId()
  // A2P error 30917 requires the disclosure to link BOTH the privacy policy and
  // the terms of service. Keep both links on every lead form.
  const linkClass = cn(
    'underline underline-offset-2',
    tone === 'on-dark' ? 'text-primary-foreground/90' : 'text-primary',
  )
  return (
    <div data-sms-consent="true" className={cn('flex items-start gap-2', className)}>
      <Checkbox
        id={id}
        name={name}
        value="yes"
        checked={checked}
        onCheckedChange={onCheckedChange ? (c) => onCheckedChange(c === true) : undefined}
        data-sms-consent-checkbox="true"
        className={cn(
          'mt-0.5 shrink-0',
          tone === 'on-dark' &&
            'border-primary-foreground/60 data-[state=checked]:border-primary-foreground data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary',
        )}
      />
      <label
        htmlFor={id}
        className={cn(
          'cursor-pointer text-xs leading-relaxed',
          tone === 'on-dark' ? 'text-primary-foreground/70' : 'text-muted-foreground',
        )}
      >
        {SMS_CONSENT_TEXT}{' '}
        <a href="/privacy" className={linkClass}>
          Privacy Policy
        </a>
        {' and '}
        <a href="/terms" className={linkClass}>
          Terms of Service
        </a>
        .
      </label>
    </div>
  )
}

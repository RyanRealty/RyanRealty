import { cn } from '@/lib/utils'

/**
 * Carrier-required SMS/TCPA consent disclosure rendered at the submit button of
 * every lead form that collects a phone number.
 *
 * The exact sentence below is quoted verbatim in the Twilio A2P campaign
 * message_flow (messaging service MG592bf50afb3f10e6f1078995dae496e4). Carriers
 * visit the live forms and verify the text word for word. Do NOT reword, shorten,
 * or restyle it into invisibility without re-submitting the A2P campaign.
 * Compliance language is exempt from brand-voice styling per CLAUDE.md.
 */
export const SMS_CONSENT_TEXT =
  'By submitting, you agree to receive calls and texts from Ryan Realty about your request. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.'

export function SmsConsentDisclosure({
  className,
  tone = 'default',
}: {
  className?: string
  /** 'on-dark' for navy/photo surfaces (cream text). */
  tone?: 'default' | 'on-dark'
}) {
  return (
    <p
      data-sms-consent="true"
      className={cn(
        'text-xs leading-relaxed',
        tone === 'on-dark' ? 'text-primary-foreground/70' : 'text-muted-foreground',
        className,
      )}
    >
      {SMS_CONSENT_TEXT}{' '}
      <a
        href="/privacy"
        className={cn(
          'underline underline-offset-2',
          tone === 'on-dark' ? 'text-primary-foreground/90' : 'text-primary',
        )}
      >
        Privacy policy
      </a>
    </p>
  )
}

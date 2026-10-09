'use client'

import { useEffect, useId, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { consentRegionRestrictedFromCookieHeader } from '@/lib/analytics/consent-regions'
import {
  FORM_AD_COOKIE_LABEL,
  FORM_AD_MATCH_LABEL,
  FORM_AD_NOTICE_HASHED,
  FORM_AD_NOTICE_LEAD,
  FORM_AD_NOTICE_OPT_OUT_HREF,
  FORM_AD_NOTICE_OPT_OUT_LEAD,
  FORM_AD_NOTICE_OPT_OUT_URL,
  FORM_AD_NOTICE_US,
} from '@/lib/identity/form-ad-consent'

/**
 * Region for the notice. Null until the browser can read rr_cr, so the first
 * paint matches the server (ISR does not know the country). Missing rr_cr is
 * restricted, the same rule as consent-regions.ts.
 */
export function useFormConsentRestricted(): boolean | null {
  const [restricted, setRestricted] = useState<boolean | null>(null)
  useEffect(() => {
    setRestricted(consentRegionRestrictedFromCookieHeader(document.cookie))
  }, [])
  return restricted
}

function ConsentBox({
  label,
  checked,
  onCheckedChange,
  testId,
  className,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  testId: string
  className?: string
}) {
  const id = useId()
  return (
    <div data-testid={testId} className={cn('flex items-start gap-2', className)}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        className="mt-0.5 shrink-0"
      />
      <label htmlFor={id} className="cursor-pointer text-xs leading-relaxed text-muted-foreground">
        {label}
      </label>
    </div>
  )
}

/** Unchecked ad-cookie box. Sits under the email or valuation fields. */
export function FormAdCookieBox({
  checked,
  onCheckedChange,
  className,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
}) {
  return (
    <ConsentBox
      label={FORM_AD_COOKIE_LABEL}
      checked={checked}
      onCheckedChange={onCheckedChange}
      testId="ad-cookie-consent"
      className={className}
    />
  )
}

function OptOutLine({ linkClassName }: { linkClassName?: string }) {
  return (
    <>
      {FORM_AD_NOTICE_OPT_OUT_LEAD}{' '}
      <a href={FORM_AD_NOTICE_OPT_OUT_HREF} className={linkClassName}>
        {FORM_AD_NOTICE_OPT_OUT_URL}
      </a>
      .
    </>
  )
}

/**
 * Notice under the submit button. US prints the memo sentence. EU/UK replaces
 * the hashed-matching sentence with the second unchecked box.
 */
export function FormAdConsentNotice({
  restricted,
  adMatchChecked,
  onAdMatchCheckedChange,
  className,
  surface = 'sheet',
}: {
  restricted: boolean | null
  adMatchChecked: boolean
  onAdMatchCheckedChange: (checked: boolean) => void
  className?: string
  /** ask: contact form (v3-ask notice styles). sheet: the valuation sheet. */
  surface?: 'ask' | 'sheet'
}) {
  if (restricted === null) {
    return <div data-form-ad-notice="pending" className={className} hidden />
  }
  const linkClass =
    surface === 'ask' ? undefined : 'font-semibold text-primary underline underline-offset-2'
  const textClass = surface === 'ask' ? undefined : 'text-xs leading-relaxed text-muted-foreground'
  return (
    <div
      data-form-ad-notice={restricted ? 'eu' : 'us'}
      className={cn(surface === 'ask' && 'v3-ask__notice', 'flex flex-col gap-2', className)}
    >
      {restricted ? (
        <>
          <p className={textClass}>{FORM_AD_NOTICE_LEAD}</p>
          <ConsentBox
            label={FORM_AD_MATCH_LABEL}
            checked={adMatchChecked}
            onCheckedChange={onAdMatchCheckedChange}
            testId="ad-match-consent"
          />
          <p className={textClass}>
            <OptOutLine linkClassName={linkClass} />
          </p>
        </>
      ) : (
        <p className={textClass}>
          {FORM_AD_NOTICE_LEAD} {FORM_AD_NOTICE_HASHED} <OptOutLine linkClassName={linkClass} />
        </p>
      )}
    </div>
  )
}

/** The US sentence as one string, for tests that read the rendered text. */
export function formAdNoticeText(restricted: boolean): string {
  if (!restricted) return FORM_AD_NOTICE_US
  return `${FORM_AD_NOTICE_LEAD} ${FORM_AD_MATCH_LABEL} ${FORM_AD_NOTICE_OPT_OUT_LEAD} ${FORM_AD_NOTICE_OPT_OUT_URL}.`
}

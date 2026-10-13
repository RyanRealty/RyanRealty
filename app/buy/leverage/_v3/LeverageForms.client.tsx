'use client'

/**
 * Two v3 asks on /buy/leverage: weekly deal notes and a buyer consult.
 * Both submit through submitLeadLandingForm with form_id buyer_leverage_lp
 * and lead_type LEVERAGE_LEAD_TYPE (buyer_alerts). Ad-cookie + US notice
 * match #465. No SMS signup.
 */
import { useEffect, useMemo, useState } from 'react'
import { V3Ask, type V3AskField, type V3AskResult } from '@/components/site/v3/V3Ask.client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormAdConsentNotice, FormAdCookieBox, useFormConsentRestricted } from '@/components/site/FormAdConsent'
import { writeFormAdConsent } from '@/lib/identity/form-ad-consent'
import { getLpContext, readRrSessionId, trackEvent, trackLandingPageView } from '@/lib/tracking'
import { trackCtaClick } from '@/lib/cta-tracking'
import { submitLeverageLead, type LeverageLeadKind } from '../actions'
import {
  LEVERAGE_FORM_ID,
  LEVERAGE_LP_VARIANT,
  LEVERAGE_TRAP,
  ROUTE_PATH,
} from './leverage-constants'
import { LEVERAGE_COPY, type LeverageCopy } from './leverage-copy'

function LeverageAsk({
  kind,
  id,
  heading,
  lede,
  submitLabel,
  successTitle,
  successBody,
  copy,
  includeMessage,
}: {
  kind: LeverageLeadKind
  id: string
  heading: string
  lede: string
  submitLabel: string
  successTitle: string
  successBody: string
  copy: LeverageCopy
  includeMessage?: boolean
}) {
  const [adCookies, setAdCookies] = useState(false)
  const [adMatch, setAdMatch] = useState(false)
  const restricted = useFormConsentRestricted()

  const fields = useMemo<V3AskField[]>(() => {
    const base: V3AskField[] = [
      { name: 'name', label: copy.formNameLabel, required: true, autoComplete: 'name', span: 'half' },
      {
        name: 'email',
        label: copy.formEmailLabel,
        kind: 'email',
        required: true,
        autoComplete: 'email',
        span: 'half',
      },
      {
        name: 'phone',
        label: copy.formPhoneLabel,
        kind: 'tel',
        autoComplete: 'tel',
        hint: copy.formPhoneHint,
        span: 'full',
      },
    ]
    if (includeMessage) {
      base.push({
        name: 'message',
        label: copy.formMessageLabel,
        kind: 'textarea',
        maxLength: 2000,
        span: 'full',
      })
    }
    return base
  }, [copy, includeMessage])

  async function send(answers: Readonly<Record<string, string>>): Promise<V3AskResult> {
    writeFormAdConsent(adCookies) // hydration-safe: submit handler, not render
    const lpContext = getLpContext(LEVERAGE_LP_VARIANT) // hydration-safe: submit handler, not render
    const sessionId = readRrSessionId() // hydration-safe: submit handler, not render
    const result = await submitLeverageLead({
      kind,
      name: answers.name ?? '',
      email: answers.email ?? '',
      phone: answers.phone,
      message: answers.message,
      adMatchConsent: restricted === true && adMatch,
      sessionId,
      company: answers[LEVERAGE_TRAP.name],
      lpContext,
    })
    if (result.error) {
      return { ok: false, message: result.error }
    }
    trackCtaClick({ // hydration-safe: submit handler, not render
      label: submitLabel,
      destination: ROUTE_PATH,
      context: `${LEVERAGE_LP_VARIANT}:${kind}`,
    })
    trackEvent('sign_up', { method: 'email', form: LEVERAGE_FORM_ID }) // hydration-safe: submit handler, not render
    return {
      ok: true,
      heading: successTitle,
      body: successBody,
      door: { href: '/book', label: LEVERAGE_COPY.bookDoor },
      again: LEVERAGE_COPY.again,
    }
  }

  return (
    <div className="v3-leverage-ask-root">
      <V3Ask
        id={id}
        heading={heading}
        headingLevel={2}
        lede={lede}
        fields={fields}
        consent={
          <>
            <div className="v3-leverage__trap" aria-hidden="true">
              <Label htmlFor={`${id}-trap`}>{LEVERAGE_TRAP.label}</Label>
              <Input
                id={`${id}-trap`}
                name={LEVERAGE_TRAP.name}
                type="text"
                tabIndex={-1}
                autoComplete="off"
                defaultValue=""
              />
            </div>
            <FormAdCookieBox checked={adCookies} onCheckedChange={setAdCookies} />
          </>
        }
        notice={
          <FormAdConsentNotice
            surface="ask"
            restricted={restricted}
            adMatchChecked={adMatch}
            onAdMatchCheckedChange={setAdMatch}
          />
        }
        submitLabel={submitLabel}
        onSubmit={send}
      />
    </div>
  )
}

export function LeverageForms({ copy }: { copy: LeverageCopy }) {
  useEffect(() => {
    trackLandingPageView(LEVERAGE_LP_VARIANT)
  }, [])

  return (
    <div className="v3-leverage-forms">
      <LeverageAsk
        kind="report"
        id="weekly-deal-report"
        heading={copy.reportHeading}
        lede={copy.reportSubhead}
        submitLabel={copy.reportButton}
        successTitle={copy.reportSuccessTitle}
        successBody={copy.reportSuccessBody}
        copy={copy}
      />
      <LeverageAsk
        kind="consult"
        id="buyer-consult"
        heading={copy.consultHeading}
        lede={copy.consultSubhead}
        submitLabel={copy.consultButton}
        successTitle={copy.consultSuccessTitle}
        successBody={copy.consultSuccessBody}
        copy={copy}
        includeMessage
      />
    </div>
  )
}

'use client'

import { useCallback, useState } from 'react'
import { V3Ask, type V3AskField, type V3AskResult } from '@/components/site/v3/V3Ask.client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import { FormAdConsentNotice, FormAdCookieBox, useFormConsentRestricted } from '@/components/site/FormAdConsent'
import { writeFormAdConsent } from '@/lib/identity/form-ad-consent'
import { getLpContext, readRrSessionId } from '@/lib/tracking'
import { submitConcessionsLead } from '../actions'
import { ASK_CTA, ASK_LEDE, TIMELINE_OPTIONS, TRAP } from './constants'
import './concessions-ask.css'

const FIELDS: V3AskField[] = [
  { name: 'name', label: 'Name', required: true, autoComplete: 'name' },
  { name: 'email', label: 'Email', kind: 'email', required: true, autoComplete: 'email' },
  {
    name: 'phone',
    label: 'Phone',
    kind: 'tel',
    autoComplete: 'tel',
    hint: 'for a text back',
    span: 'full',
  },
  {
    name: 'timeline',
    label: 'When you want to buy',
    kind: 'select',
    required: true,
    options: TIMELINE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    defaultValue: '1-3-months',
    span: 'full',
  },
]

const SENT: Extract<V3AskResult, { ok: true }> = {
  ok: true,
  heading: 'Request received',
  body: 'A broker gets this now and will help you structure the concession on your next offer. A confirmation is on its way to your inbox.',
  door: { href: '/book', label: 'Or pick a time now' },
  again: 'Send another request',
}

export function ConcessionsAsk() {
  const [smsConsent, setSmsConsent] = useState(false)
  const [adCookies, setAdCookies] = useState(false)
  const [adMatch, setAdMatch] = useState(false)
  const restricted = useFormConsentRestricted()

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>): Promise<V3AskResult> => {
      if (!answers.name?.trim() || !answers.email?.trim() || !answers.timeline?.trim()) {
        return { ok: false, message: 'Fill the required fields. The boxes that need a value will shake.' }
      }
      const formData = new FormData()
      formData.set('name', answers.name ?? '')
      formData.set('email', answers.email ?? '')
      formData.set('phone', answers.phone ?? '')
      formData.set('timeline', answers.timeline ?? '')
      if (smsConsent) formData.set('smsConsent', 'yes')
      writeFormAdConsent(adCookies) // hydration-safe: submit handler, not render
      if (restricted && adMatch) formData.set('adMatchConsent', 'yes')
      formData.set(TRAP.name, answers[TRAP.name] ?? '')
      const rrSession = readRrSessionId() // hydration-safe: event/effect storage only
      if (rrSession) formData.set('sessionId', rrSession)
      const lp = getLpContext('buy-concessions') // hydration-safe: submit handler
      if (lp.lp_source) formData.set('lp_source', lp.lp_source)
      if (lp.lp_medium) formData.set('lp_medium', lp.lp_medium)
      if (lp.lp_campaign) formData.set('lp_campaign', lp.lp_campaign)
      if (lp.lp_content) formData.set('lp_content', lp.lp_content)
      if (lp.lp_term) formData.set('lp_term', lp.lp_term)
      if (lp.gclid) formData.set('gclid', lp.gclid)
      if (lp.fbclid) formData.set('fbclid', lp.fbclid)
      const cr = new URL(window.location.href).searchParams.get('cr') // hydration-safe: submit handler
      if (cr?.trim()) formData.set('cr', cr.trim())

      const result = await submitConcessionsLead(formData)
      if (!result.success) {
        return { ok: false, message: result.error || 'The request did not send. Call or text instead, or try again.' }
      }
      if (result.eventId && typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', 'Lead', { content_name: 'buy_concessions' }, { eventID: result.eventId })
      }
      return { ...SENT, detail: `Sent: ${answers.timeline}` }
    },
    [adCookies, adMatch, restricted, smsConsent],
  )

  return (
    <div className="concessions-ask-root">
      <V3Ask
        id="plan"
        className="concessions-ask"
        eyebrow="Work with a broker"
        heading="Get a concession plan for your offer"
        headingLevel={2}
        lede={ASK_LEDE}
        fields={FIELDS}
        consent={
          <>
            <div className="concessions-ask__trap" aria-hidden="true">
              <Label htmlFor="concessions-trap">{TRAP.label}</Label>
              <Input
                id="concessions-trap"
                name={TRAP.name}
                type="text"
                tabIndex={-1}
                autoComplete="off"
                defaultValue=""
              />
            </div>
            <FormAdCookieBox checked={adCookies} onCheckedChange={setAdCookies} />
            <SmsConsentDisclosure checked={smsConsent} onCheckedChange={setSmsConsent} />
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
        submitLabel={ASK_CTA}
        onSubmit={send}
      />
    </div>
  )
}

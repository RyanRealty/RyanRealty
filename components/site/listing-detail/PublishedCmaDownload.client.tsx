'use client'

import { useState, useTransition } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { Body } from '@/components/site/primitives'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import { registerForCmaDocumentAction } from '@/app/actions/cma-download'
import { CONTACT } from '@/lib/brand/contact'

/**
 * The registration gate on the published-CMA section.
 *
 * Progressive disclosure, which is how the strong players run gated valuation
 * content: the visitor gets real, useful information first (our value range,
 * the property's capability facts, how many sales we used), and the form only
 * appears after they ask for more. Redfin's Owner Dashboard and Zillow's "claim
 * your home" both order it that way, and the reason is well documented in
 * conversion research on gated content: a gate placed AFTER demonstrated value
 * converts, a gate placed in front of it bounces.
 *
 * Three fields plus a consent box, and phone is optional on purpose. Every
 * extra required field costs conversion and the CRM can enrich later. The
 * checkbox is a real affirmative act, unchecked by default, with the terms
 * visible above it rather than hidden behind a link, because ODS §5-4 F
 * requires the registrant to "review and affirmatively express agreement" to
 * them. The honeypot mirrors app/actions/search-alert-capture.ts.
 *
 * KB register, not shadcn: this is a public site surface, so it uses the same
 * raw controls and cream/navy field styling as MortgageCalculator, its sibling
 * on this page (ci:shadcn-burndown keeps @/components/ui out of components/site).
 */

type Props = {
  listingKey: string
  subjectAddress: string
  terms: readonly string[]
  termsVersion: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * KB cream field: 2px navy edge, navy text, no rounding.
 *
 * `--navy` / `--cream` are scoped to `.kb-root` (components/site/kb/kb.css), so
 * each one falls back to the global shadcn token that evaluates to the same
 * brand color. That keeps the section correct if it is ever mounted outside a
 * KB page, without hardcoding an off-token hex.
 */
const KB_INPUT_STYLE: CSSProperties = {
  width: '100%',
  background: 'var(--cream, var(--background))',
  border: '2px solid var(--navy, var(--primary))',
  borderRadius: 0,
  padding: '10px 12px',
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  fontWeight: 600,
  color: 'var(--navy, var(--primary))',
  outline: 'none',
}

const KB_BUTTON_STYLE: CSSProperties = {
  background: 'var(--navy, var(--primary))',
  color: 'var(--cream, var(--primary-foreground))',
  border: '2px solid var(--navy, var(--primary))',
  borderRadius: 0,
  padding: '11px 20px',
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-block',
  textDecoration: 'none',
}

const KB_LABEL_STYLE: CSSProperties = {
  fontSize: '0.6rem',
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'rgba(16,39,66,0.72)',
  fontFamily: 'var(--font-sans, sans-serif)',
}

const KB_PANEL_STYLE: CSSProperties = {
  border: '3px solid var(--navy, var(--primary))',
  background: 'var(--cream, var(--background))',
  padding: '20px 22px',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: '1 1 220px', minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={KB_LABEL_STYLE}>
        {label}
      </label>
      {children}
    </div>
  )
}

export function PublishedCmaDownload({ listingKey, subjectAddress, terms, termsVersion }: Props) {
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [agreed, setAgreed] = useState(false)
  // Separate from the terms box on purpose. Carrier (A2P 10DLC) review requires
  // SMS consent to be its own explicit, unchecked-by-default opt-in, never
  // bundled into another agreement.
  const [smsConsent, setSmsConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (fullName.trim().length < 2) {
      setError('Please enter your name.')
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter an email address we can reach you at.')
      return
    }
    if (!agreed) {
      setError('Please agree to the terms above so we can send the analysis.')
      return
    }
    startTransition(async () => {
      const result = await registerForCmaDocumentAction({
        listingKey,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        termsVersion,
        agreed,
        smsConsent,
        company,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDownloadUrl(result.url)
    })
  }

  if (downloadUrl) {
    return (
      <div style={KB_PANEL_STYLE} data-testid="published-cma-download-ready">
        <div className="display" style={{ fontSize: 'clamp(17px,1.7vw,20px)' }}>
          Your analysis is ready
        </div>
        <Body size="small">
          The full analysis for {subjectAddress} names every comparable sale and the adjustment behind each one. We
          passed your details to the broker handling this property, so reach out any time with questions about it.
        </Body>
        <div>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={KB_BUTTON_STYLE}
            data-testid="published-cma-open-document"
          >
            Open the full market analysis
          </a>
        </div>
      </div>
    )
  }

  if (!open) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={KB_BUTTON_STYLE}
            data-testid="published-cma-download-cta"
          >
            Download the full market analysis
          </button>
        </div>
        <Body size="small" tone="muted">
          The full analysis names every comparable sale behind this range and shows the adjustment we made for each
          one.
        </Body>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate style={KB_PANEL_STYLE} data-testid="published-cma-register-form">
      <div className="display" style={{ fontSize: 'clamp(17px,1.7vw,20px)' }}>
        Where should we send it
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Field label="Your name" id="cma-reg-name">
          <input
            id="cma-reg-name"
            name="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={KB_INPUT_STYLE}
          />
        </Field>
        <Field label="Email" id="cma-reg-email">
          <input
            id="cma-reg-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={KB_INPUT_STYLE}
          />
        </Field>
        <Field label="Phone, if you want a call" id="cma-reg-phone">
          <input
            id="cma-reg-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={KB_INPUT_STYLE}
          />
        </Field>
      </div>

      {/* Honeypot. Real people never see it, bots fill it. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="sr-only"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Body size="small" tone="muted" as="div">
          By checking this box, you agree that:
        </Body>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {terms.map((clause) => (
            <li key={clause}>
              <Body size="small" tone="muted" as="span">
                {clause}
              </Body>
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 4 }}>
          <input
            id="cma-reg-terms"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ accentColor: 'var(--navy, var(--primary))', width: 18, height: 18, marginTop: 1, flexShrink: 0 }}
            data-testid="published-cma-terms"
          />
          <label htmlFor="cma-reg-terms" style={{ lineHeight: 1.5, fontSize: '0.9rem' }}>
            I have read and agree to the terms above.
          </label>
        </div>
      </div>

      {/* Phone is optional, so this only ever matters when one is given. Nothing
          on this path sends an automated text: the consent is what lets the
          broker reply by SMS at all. */}
      <SmsConsentDisclosure checked={smsConsent} onCheckedChange={setSmsConsent} />

      {error ? (
        <Body size="small" role="alert" data-testid="published-cma-error" style={{ color: 'var(--navy, var(--primary))', fontWeight: 700 }}>
          {error}
        </Body>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          style={{ ...KB_BUTTON_STYLE, opacity: pending ? 0.55 : 1, cursor: pending ? 'not-allowed' : 'pointer' }}
          data-testid="published-cma-submit"
        >
          {pending ? 'Working' : 'Send me the full analysis'}
        </button>
      </div>

      <Body size="small" tone="muted">
        We use your details to send this analysis and to answer questions about this property. See our{' '}
        <a href="/privacy" style={{ textDecoration: 'underline' }}>
          privacy policy
        </a>
        . Questions about this property or the numbers in it, call or text {CONTACT.phoneFub}.
      </Body>
    </form>
  )
}

export default PublishedCmaDownload

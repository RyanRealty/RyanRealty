'use client'

import { useState, useTransition } from 'react'
import {
  Body,
  Container,
  CTAButton,
  Eyebrow,
  H2,
  Section,
  Stack,
} from '@/components/site/primitives'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import { cn } from '@/lib/utils'

/**
 * Site v2 lead-capture block — single canonical form with four variants,
 * mounting the same Section + Container + heading chrome but swapping
 * the inner field set per variant.
 *
 * Variants:
 *   buyer   — buyer listing alerts; collects email + price band + areas
 *   seller  — home valuation request; collects address + timeline
 *   expired — expired-listing revival; collects address + previous list price
 *   inquiry — generic question / contact; collects name + email + message
 *
 * Submission contract (caller provides):
 *   onSubmit(payload, variant): Promise<{ ok: boolean; message?: string }>
 *
 * Callers wire `onSubmit` to one of the existing server actions
 * (`app/lp/seller-home-value/actions.ts`, `app/lp/buyer-listing-alerts/actions.ts`,
 * `app/lp/expired-listing/actions.ts`) — those already handle FUB
 * person creation, custom-field set, tag application, broker
 * round-robin assignment, agent-attribution cookie read, GA4 + Meta
 * Pixel `generate_lead` server-side fire.
 *
 * Per CLAUDE.md §0.5 brand-voice rules every caller-supplied label /
 * placeholder / heading runs through the brand-voice ESLint gate at
 * lint time. The block itself ships clean — no banned tokens, no
 * em-dashes, no exclamation marks.
 *
 * Per plan §9 Layer 3. FUB-wiring + tracking-fire integration is
 * deferred to per-page Wave 3 migrations; this is the structural
 * scaffold that pages adopt + plug their server actions into.
 */

export type LeadCaptureVariant = 'buyer' | 'seller' | 'expired' | 'inquiry'

type BuyerPayload = {
  variant: 'buyer'
  name: string
  email: string
  phone: string
  budgetMax: string
  notes: string
}

type SellerPayload = {
  variant: 'seller'
  name: string
  email: string
  phone: string
  address: string
  timeline: string
  notes: string
}

type ExpiredPayload = {
  variant: 'expired'
  name: string
  email: string
  phone: string
  address: string
  previousListPrice: string
  notes: string
}

type InquiryPayload = {
  variant: 'inquiry'
  name: string
  email: string
  message: string
}

export type LeadCapturePayload = BuyerPayload | SellerPayload | ExpiredPayload | InquiryPayload

type Props = {
  variant: LeadCaptureVariant
  /** Caller-supplied submission handler. */
  onSubmit: (payload: LeadCapturePayload) => Promise<{ ok: boolean; message?: string }>
  eyebrow?: string
  title?: string
  intro?: string
  submitLabel?: string
  /** Privacy / compliance line under the submit button. */
  consentLine?: string
  /** Section tone — default light bg; pass "muted" or "navy" surface. */
  tone?: 'default' | 'muted' | 'navy'
  className?: string
}

const variantDefaults: Record<
  LeadCaptureVariant,
  { eyebrow: string; title: string; submitLabel: string; consentLine: string }
> = {
  buyer: {
    eyebrow: 'Listing alerts',
    title: 'Get matched homes the day they list',
    submitLabel: 'Set up alerts',
    consentLine: 'Unsubscribe anytime. We do not share your information.',
  },
  seller: {
    eyebrow: 'Home value',
    title: 'Request a free home valuation',
    submitLabel: 'Request my valuation',
    consentLine: 'No automated estimate. A local broker writes back personally.',
  },
  expired: {
    eyebrow: 'Expired listing',
    title: 'Restart your sale with a fresh plan',
    submitLabel: 'Request a plan review',
    consentLine: 'No pitch. A broker writes back with a specific plan for your home.',
  },
  inquiry: {
    eyebrow: 'Contact',
    title: 'Send us a note',
    submitLabel: 'Send message',
    consentLine: 'A real person reads every message. We reply same business day.',
  },
}

function variantInitial(variant: LeadCaptureVariant): LeadCapturePayload {
  switch (variant) {
    case 'buyer':
      return { variant: 'buyer', name: '', email: '', phone: '', budgetMax: '', notes: '' }
    case 'seller':
      return { variant: 'seller', name: '', email: '', phone: '', address: '', timeline: '', notes: '' }
    case 'expired':
      return { variant: 'expired', name: '', email: '', phone: '', address: '', previousListPrice: '', notes: '' }
    case 'inquiry':
      return { variant: 'inquiry', name: '', email: '', message: '' }
  }
}

export function LeadCaptureBlock({
  variant,
  onSubmit,
  eyebrow,
  title,
  intro,
  submitLabel,
  consentLine,
  tone = 'muted',
  className,
}: Props) {
  const defaults = variantDefaults[variant]
  const [state, setState] = useState<LeadCapturePayload>(() => variantInitial(variant))
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null)

  const onNavy = tone === 'navy'

  function update<K extends keyof LeadCapturePayload>(key: K, value: LeadCapturePayload[K]) {
    setState((prev) => ({ ...prev, [key]: value } as LeadCapturePayload))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startTransition(async () => {
      const r = await onSubmit(state)
      setResult(r)
    })
  }

  return (
    <Section padding="default" tone={tone} divider={!onNavy} className={className}>
      <Container>
        <div className="grid gap-10 grid-cols-1 md:grid-cols-[1fr_1.2fr] items-start">
          <Stack gap="default" className="max-w-[52ch]">
            <Eyebrow className={onNavy ? 'text-white/72' : undefined}>
              {eyebrow ?? defaults.eyebrow}
            </Eyebrow>
            <H2 className={onNavy ? 'text-white' : undefined}>{title ?? defaults.title}</H2>
            {intro ? (
              <Body
                size="default"
                tone={onNavy ? 'on-photo' : 'muted'}
                className={onNavy ? 'text-white/85' : undefined}
              >
                {intro}
              </Body>
            ) : null}
          </Stack>

          <form
            onSubmit={handleSubmit}
            className={cn(
              'kb-tool-skin rounded-[14px] p-6 shadow-sm border',
              onNavy ? 'bg-white border-transparent' : 'bg-card border-border',
            )}
          >
            <div className="grid gap-4">
              <Field label="Your name" htmlFor="lcb-name">
                <Input
                  id="lcb-name"
                  required
                  autoComplete="name"
                  value={state.name}
                  onChange={(e) => update('name', e.target.value)}
                />
              </Field>
              <Field label="Email" htmlFor="lcb-email">
                <Input
                  id="lcb-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={state.email}
                  onChange={(e) => update('email', e.target.value)}
                />
              </Field>
              {variant !== 'inquiry' ? (
                <Field label="Phone (optional)" htmlFor="lcb-phone">
                  <Input
                    id="lcb-phone"
                    type="tel"
                    autoComplete="tel"
                    value={(state as Exclude<LeadCapturePayload, InquiryPayload>).phone}
                    onChange={(e) => update('phone' as keyof LeadCapturePayload, e.target.value as never)}
                  />
                </Field>
              ) : null}

              {variant === 'buyer' ? (
                <Field label="Max budget (optional)" htmlFor="lcb-budget">
                  <Input
                    id="lcb-budget"
                    type="text"
                    placeholder="$900,000"
                    value={(state as BuyerPayload).budgetMax}
                    onChange={(e) => update('budgetMax' as keyof LeadCapturePayload, e.target.value as never)}
                  />
                </Field>
              ) : null}

              {(variant === 'seller' || variant === 'expired') ? (
                <Field label="Property address" htmlFor="lcb-address">
                  <Input
                    id="lcb-address"
                    type="text"
                    required
                    autoComplete="street-address"
                    value={(state as SellerPayload | ExpiredPayload).address}
                    onChange={(e) => update('address' as keyof LeadCapturePayload, e.target.value as never)}
                  />
                </Field>
              ) : null}

              {variant === 'seller' ? (
                <Field label="Timeline" htmlFor="lcb-timeline">
                  <Input
                    id="lcb-timeline"
                    type="text"
                    placeholder="3 to 6 months"
                    value={(state as SellerPayload).timeline}
                    onChange={(e) => update('timeline' as keyof LeadCapturePayload, e.target.value as never)}
                  />
                </Field>
              ) : null}

              {variant === 'expired' ? (
                <Field label="Previous list price (optional)" htmlFor="lcb-prevprice">
                  <Input
                    id="lcb-prevprice"
                    type="text"
                    placeholder="$650,000"
                    value={(state as ExpiredPayload).previousListPrice}
                    onChange={(e) => update('previousListPrice' as keyof LeadCapturePayload, e.target.value as never)}
                  />
                </Field>
              ) : null}

              {variant === 'inquiry' ? (
                <Field label="How can we help?" htmlFor="lcb-message">
                  <Textarea
                    id="lcb-message"
                    required
                    rows={5}
                    value={(state as InquiryPayload).message}
                    onChange={(e) => update('message' as keyof LeadCapturePayload, e.target.value as never)}
                  />
                </Field>
              ) : (
                <Field label="Notes (optional)" htmlFor="lcb-notes">
                  <Textarea
                    id="lcb-notes"
                    rows={3}
                    value={(state as Exclude<LeadCapturePayload, InquiryPayload>).notes}
                    onChange={(e) => update('notes' as keyof LeadCapturePayload, e.target.value as never)}
                  />
                </Field>
              )}

              <div className="pt-2">
                <CTAButton type="submit" tone="primary" size="md" disabled={pending}>
                  {pending ? 'Sending...' : (submitLabel ?? defaults.submitLabel)}
                </CTAButton>
              </div>

              {variant !== 'inquiry' ? <SmsConsentDisclosure /> : null}

              <p className="text-xs text-muted-foreground">
                {consentLine ?? defaults.consentLine}
              </p>

              {result ? (
                <div
                  role="status"
                  aria-live="polite"
                  className={cn(
                    'text-sm',
                    result.ok ? 'text-success' : 'text-destructive',
                  )}
                >
                  {result.message ?? (result.ok ? 'Got it. We will be in touch.' : 'Something went wrong. Please try again.')}
                </div>
              ) : null}
            </div>
          </form>
        </div>
      </Container>
    </Section>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

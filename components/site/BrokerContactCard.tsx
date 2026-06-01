/**
 * BrokerContactCard — reusable trust + contact block for any surface where
 * a Ryan Realty broker appears (team page, listing detail sidebar, contact
 * page, CTA bands).
 *
 * Renders: transparent-PNG headshot · full name · title · Oregon license
 * (from data; never invented) · dotted phone as tel: link · email as
 * mailto: link · a short trust line · an optional "Work with {firstName}" CTA.
 *
 * Per CLAUDE.md "Broker headshots" rule (locked 2026-05-13):
 *   - Use .png (transparent bg) — never .jpg
 *   - Never add a rectangular frame, bg fill, or shadow that fakes a border
 *   - The transparent edge IS the composition
 *
 * Per CLAUDE.md Brand Voice:
 *   - Phone in dotted format (541.213.6706)
 *   - No em-dashes, no exclamation marks, no banned words
 *   - Sentence case headings
 *
 * Per CLAUDE.md Design System:
 *   - Design tokens only (bg-card, text-foreground, text-muted-foreground, etc.)
 *   - @/components/site/primitives for all text + CTA
 *   - No raw <button> or styled <a> outside primitives
 */

import Image from 'next/image'
import { Separator } from '@/components/ui/separator'
import {
  Body,
  Caption,
  CTAButton,
  Stack,
  TextLink,
} from '@/components/site/primitives'
import { cn } from '@/lib/utils'

type Props = {
  /** Full broker name (e.g. "Matt Ryan"). */
  name: string
  /** Title (e.g. "Owner and Principal Broker"). */
  title: string
  /** Oregon real estate license number — show only if data is present. */
  licenseNumber?: string | null
  /** Dotted phone format — 541.213.6706. */
  phone?: string | null
  /** Email address for mailto: link. */
  email?: string | null
  /** Path to the transparent headshot PNG under /images/brokers/. */
  headshotSrc: string
  /** Alt text for the headshot. */
  headshotAlt: string
  /** One-line factual trust copy placed below the contact details. */
  trustLine?: string
  /** When set, renders a "Work with {firstName}" CTA button. */
  ctaHref?: string
  /** First name for the CTA label. */
  firstName?: string
  /** Visual variant: 'card' wraps in a bordered bg-card panel; 'inline' floats inline. */
  variant?: 'card' | 'inline'
  className?: string
}

export function BrokerContactCard({
  name,
  title,
  licenseNumber,
  phone,
  email,
  headshotSrc,
  headshotAlt,
  trustLine,
  ctaHref,
  firstName,
  variant = 'card',
  className,
}: Props) {
  const telHref = phone ? `tel:${phone.replace(/\./g, '')}` : null

  return (
    <div
      className={cn(
        variant === 'card' && 'bg-card border border-border rounded-xl p-6 shadow-sm',
        className,
      )}
    >
      <div className="flex flex-col items-center text-center gap-4">
        {/* Headshot — transparent PNG, no rectangular frame */}
        <Image
          src={headshotSrc}
          alt={headshotAlt}
          width={160}
          height={240}
          className="select-none w-32 h-auto"
          priority
        />

        {/* Identity */}
        <Stack gap="tight" className="items-center w-full">
          <div className="text-xl font-bold tracking-tight text-foreground leading-tight">
            {name}
          </div>
          <Caption tone="muted" className="tabular-nums">
            {title}
          </Caption>
          {licenseNumber ? (
            <Caption tone="muted" className="tabular-nums">
              Oregon license #{licenseNumber}
            </Caption>
          ) : null}
          <Caption tone="muted">Licensed in the State of Oregon</Caption>
        </Stack>

        <Separator />

        {/* Contact links */}
        {(phone || email) ? (
          <Stack gap="tight" className="items-center w-full">
            {phone && telHref ? (
              <TextLink
                href={telHref}
                underline="never"
                weight="semibold"
                className="tabular-nums text-base"
              >
                {phone}
              </TextLink>
            ) : null}
            {email ? (
              <TextLink
                href={`mailto:${email}`}
                underline="on-hover"
                weight="normal"
                className="text-sm break-all"
              >
                {email}
              </TextLink>
            ) : null}
          </Stack>
        ) : null}

        {/* Trust line */}
        {trustLine ? (
          <Body size="small" tone="muted" className="text-center leading-relaxed">
            {trustLine}
          </Body>
        ) : null}

        {/* CTA */}
        {ctaHref && firstName ? (
          <CTAButton href={ctaHref} tone="primary" size="md" className="w-full justify-center">
            Work with {firstName}
          </CTAButton>
        ) : null}
      </div>
    </div>
  )
}

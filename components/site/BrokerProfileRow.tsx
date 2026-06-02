import Image from 'next/image'
import { teamPath } from '@/lib/slug'
import type { Broker } from '@/lib/data/types/broker'
import {
  Body,
  Caption,
  CTAButton,
  DisplayHeading,
  Eyebrow,
  MiddleDot,
  Stack,
  TextLink,
} from '@/components/site/primitives'

/**
 * Broker profile row — large two-column profile (headshot + identity, bio,
 * specialties, direct contact) for the /team page. Mirrors the
 * design_system/ryan-realty/ui_kits/team mockup's broker-large rows.
 *
 * Data accuracy (CLAUDE.md §0): every field comes straight from the verified
 * public.brokers row via getBrokers(). Nothing is invented — specialties, bio,
 * license, phone, and email render only when the DB has them. The transparent
 * headshot floats on the section background (no faked rectangular frame, per
 * the broker-headshot composite rule).
 */
export function BrokerProfileRow({ broker }: { broker: Broker }) {
  const firstName = broker.fullName.split(' ')[0] ?? broker.fullName
  const telHref = broker.phoneDirect ? `tel:${broker.phoneDirect.replace(/\D/g, '')}` : null
  const mailHref = broker.email ? `mailto:${broker.email}` : null
  const specialties = broker.specialties ?? []

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr] md:gap-10 items-start">
      <div className="mx-auto w-full max-w-xs md:mx-0">
        <Image
          src={broker.headshotPng}
          alt={broker.fullName}
          width={480}
          height={600}
          className="w-full h-auto select-none aspect-[4/5] object-contain object-bottom"
          priority={broker.isPrincipal}
        />
      </div>

      <Stack gap="tight">
        <Eyebrow>{broker.title}</Eyebrow>
        <DisplayHeading as="h3" className="text-2xl sm:text-3xl">
          {broker.fullName}
        </DisplayHeading>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {broker.licenseNumber ? (
            <Caption tone="muted" className="tabular-nums">
              Oregon license #{broker.licenseNumber}
            </Caption>
          ) : null}
          <Caption tone="muted">Licensed in Oregon</Caption>
        </div>

        {specialties.length > 0 ? (
          <ul className="flex flex-wrap gap-2 pt-1">
            {specialties.map((s) => (
              <li
                key={s}
                className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs text-secondary-foreground"
              >
                {s}
              </li>
            ))}
          </ul>
        ) : null}

        {broker.bio ? (
          <Body size="default" tone="muted" className="leading-relaxed line-clamp-5 max-w-prose">
            {broker.bio}
          </Body>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
          {broker.phoneDirect ? (
            <TextLink href={telHref!} underline="never" weight="semibold" className="tabular-nums">
              {broker.phoneDirect}
            </TextLink>
          ) : null}
          {broker.phoneDirect && broker.email ? <MiddleDot className="text-muted-foreground/50" /> : null}
          {broker.email ? (
            <TextLink href={mailHref!} underline="on-hover" className="break-all">
              {broker.email}
            </TextLink>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2.5 pt-2">
          {telHref ? (
            <CTAButton href={telHref} tone="primary" size="md">
              Call {firstName}
            </CTAButton>
          ) : null}
          <CTAButton href={teamPath(broker.slug)} tone="outline" size="md">
            Read {firstName}&apos;s full profile
          </CTAButton>
        </div>
      </Stack>
    </div>
  )
}

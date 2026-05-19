/**
 * Daily listing-alerts digest email.
 *
 * React Email template, rendered server-side and handed to Resend. Brand:
 * navy header on cream body, Geist-styled (system fallback for email clients
 * that strip custom fonts), 6 listing cards max with a "view more" footer
 * link.
 *
 * Brand voice: every body line scrubbed for banned words per
 * marketing_brain_skills/brand-voice/voice_guidelines.md.
 *
 * Spec: marketing_brain_skills/producers/listing-alerts/SKILL.md §4.1 Step 7.
 */
import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import type { MatchedListing } from '@/lib/listing-alerts/types'
import { listingDetailPath } from '@/lib/slug'

const NAVY = '#102742'
const CREAM = '#faf8f4'
const MUTED = '#5d6470'
const BORDER = 'rgba(16, 39, 66, 0.08)'

const fontStack =
  '-apple-system, BlinkMacSystemFont, "Geist", "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

export interface ListingAlertsDigestProps {
  /** Subscriber first name (or full name) for the greeting line. */
  recipientName: string
  /** What the subscriber asked for, e.g. "Tetherow homes" or "homes in Bend". */
  searchLabel: string
  /** Up to 6 listings to render as cards. Cap is enforced upstream. */
  matches: MatchedListing[]
  /** Total matches found (can exceed matches.length when capped). */
  totalMatches: number
  /** Absolute URL prefix, e.g. "https://ryan-realty.com". */
  siteUrl: string
  /** Browse URL for the LP segment, e.g. "/lp/tetherow/" or "/homes-for-sale/bend/". */
  browseAllUrl: string
  /** One-click unsubscribe URL, including token query param. */
  unsubscribeUrl: string
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return 'Price on request'
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function formatAddress(m: MatchedListing): string {
  const street = [m.streetNumber, m.streetName].filter(Boolean).join(' ').trim()
  if (street) return street
  if (m.city) return m.city
  return 'New listing'
}

function formatSpecs(m: MatchedListing): string {
  const parts: string[] = []
  if (m.bedroomsTotal != null) parts.push(`${m.bedroomsTotal} bed`)
  if (m.bathroomsTotal != null) parts.push(`${m.bathroomsTotal} bath`)
  if (m.totalLivingAreaSqFt != null && m.totalLivingAreaSqFt > 0) {
    parts.push(`${Math.round(m.totalLivingAreaSqFt).toLocaleString('en-US')} sqft`)
  }
  return parts.join(' · ')
}

function buildListingUrl(m: MatchedListing, siteUrl: string): string {
  const path = listingDetailPath(
    m.listingId,
    {
      streetNumber: m.streetNumber,
      streetName: m.streetName,
      city: m.city,
      state: m.state,
      postalCode: m.postalCode,
    },
    { city: m.city, subdivision: m.subdivisionName },
    { mlsNumber: m.listingId },
  )
  return `${siteUrl}${path}`
}

export function ListingAlertsDigestEmail(props: ListingAlertsDigestProps): React.ReactElement {
  const { recipientName, searchLabel, matches, totalMatches, siteUrl, browseAllUrl, unsubscribeUrl } = props
  const firstName = recipientName.trim().split(/\s+/)[0] || 'there'
  const visible = matches.slice(0, 6)
  const more = Math.max(0, totalMatches - visible.length)

  return (
    <Html>
      <Head />
      <Preview>{`${totalMatches} new ${searchLabel} for ${firstName}`}</Preview>
      <Body
        style={{
          fontFamily: fontStack,
          backgroundColor: CREAM,
          margin: 0,
          padding: 0,
          color: NAVY,
        }}
      >
        <Container style={{ maxWidth: 600, margin: '0 auto', padding: 0 }}>
          <Section style={{ backgroundColor: NAVY, padding: '20px 28px' }}>
            <Img
              src={`${siteUrl}/brand/logo-header-white.png`}
              alt="Ryan Realty"
              width="160"
              style={{ display: 'block' }}
            />
          </Section>

          <Section style={{ backgroundColor: '#ffffff', padding: '28px' }}>
            <Heading
              as="h1"
              style={{
                fontSize: 22,
                lineHeight: 1.25,
                fontWeight: 600,
                margin: '0 0 8px 0',
                color: NAVY,
              }}
            >
              Hi {firstName}, here are today&rsquo;s {searchLabel}.
            </Heading>
            <Text style={{ margin: '0 0 24px 0', color: MUTED, fontSize: 14, lineHeight: 1.55 }}>
              {totalMatches === 1
                ? '1 home matched your saved criteria in the last 24 hours.'
                : `${totalMatches} homes matched your saved criteria in the last 24 hours.`}{' '}
              Tap any listing for the full details.
            </Text>

            {visible.length === 0 ? (
              <Text style={{ color: MUTED, fontSize: 14 }}>
                No matches today. We&rsquo;ll keep watching and email when something new comes on the market.
              </Text>
            ) : (
              visible.map((m) => (
                <ListingCard key={`${m.listingId}-${m.matchType}`} match={m} siteUrl={siteUrl} />
              ))
            )}

            {more > 0 ? (
              <Section style={{ padding: '16px 0 0 0', textAlign: 'center' as const }}>
                <Link
                  href={`${siteUrl}${browseAllUrl}`}
                  style={{
                    display: 'inline-block',
                    backgroundColor: NAVY,
                    color: CREAM,
                    padding: '12px 24px',
                    borderRadius: 10,
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  See {more} more {more === 1 ? 'home' : 'homes'}
                </Link>
              </Section>
            ) : null}

            <Hr style={{ border: 'none', borderTop: `1px solid ${BORDER}`, margin: '28px 0 20px 0' }} />

            <Section>
              <Text style={{ margin: '0 0 6px 0', fontSize: 13, color: NAVY, fontWeight: 600 }}>
                Matt Ryan · Ryan Realty
              </Text>
              <Text style={{ margin: '0 0 6px 0', fontSize: 13, color: MUTED }}>
                Bend &middot; Oregon
              </Text>
              <Text style={{ margin: 0, fontSize: 13, color: MUTED }}>
                <Link href="tel:+15412136706" style={{ color: NAVY, textDecoration: 'none' }}>
                  541.213.6706
                </Link>
                {' · '}
                <Link href={`${siteUrl}`} style={{ color: NAVY, textDecoration: 'none' }}>
                  ryan-realty.com
                </Link>
              </Text>
            </Section>
          </Section>

          <Section style={{ padding: '20px 28px', textAlign: 'center' as const }}>
            <Text style={{ margin: '0 0 6px 0', fontSize: 11, color: MUTED }}>
              You set up these alerts on ryan-realty.com. Updated daily at 7am Pacific.
            </Text>
            <Text style={{ margin: 0, fontSize: 11, color: MUTED }}>
              <Link href={unsubscribeUrl} style={{ color: MUTED, textDecoration: 'underline' }}>
                Unsubscribe
              </Link>
              {' · '}
              <Link href={`${siteUrl}/account/saved-searches`} style={{ color: MUTED, textDecoration: 'underline' }}>
                Manage alerts
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

function ListingCard({ match, siteUrl }: { match: MatchedListing; siteUrl: string }) {
  const url = buildListingUrl(match, siteUrl)
  const photo = match.photoURL ?? null
  const priceDropPct =
    match.matchType === 'price_drop' &&
    match.originalListPrice &&
    match.listPrice &&
    match.originalListPrice > match.listPrice
      ? Math.round(((match.originalListPrice - match.listPrice) / match.originalListPrice) * 100)
      : null

  return (
    <Section
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        marginBottom: 14,
        overflow: 'hidden',
      }}
    >
      {photo ? (
        <Link href={url} style={{ display: 'block' }}>
          <Img
            src={photo}
            alt={formatAddress(match)}
            width="600"
            style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 320, objectFit: 'cover' as const }}
          />
        </Link>
      ) : null}
      <Section style={{ padding: 18 }}>
        <Text style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 600, color: NAVY }}>
          {formatPrice(match.listPrice)}
          {priceDropPct ? (
            <span style={{ marginLeft: 8, fontSize: 12, color: '#b00020', fontWeight: 500 }}>
              {priceDropPct}% price drop
            </span>
          ) : null}
        </Text>
        <Text style={{ margin: '0 0 6px 0', fontSize: 15, color: NAVY }}>
          {formatAddress(match)}
        </Text>
        <Text style={{ margin: '0 0 12px 0', fontSize: 13, color: MUTED }}>
          {formatSpecs(match) || 'Details coming online'}
          {match.subdivisionName ? ` · ${match.subdivisionName}` : ''}
          {match.cumulativeDaysOnMarket != null ? ` · ${match.cumulativeDaysOnMarket} days on market` : ''}
        </Text>
        <Link
          href={url}
          style={{
            display: 'inline-block',
            color: NAVY,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 13,
            borderBottom: `2px solid ${NAVY}`,
            paddingBottom: 2,
          }}
        >
          View this home &rarr;
        </Link>
      </Section>
    </Section>
  )
}

export default ListingAlertsDigestEmail

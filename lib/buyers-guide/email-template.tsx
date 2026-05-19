/**
 * Cover note attached to the buyer's-guide PDF email.
 *
 * Brand voice: Matt's voice — direct, specific, no hype. Sentence case.
 * No em-dashes in body copy. No exclamation marks.
 *
 * Spec: marketing_brain_skills/producers/buyers-guide/SKILL.md §4.3 Step 4.
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

const NAVY = '#102742'
const CREAM = '#faf8f4'
const MUTED = '#5d6470'
const BORDER = 'rgba(16, 39, 66, 0.08)'

const fontStack =
  '-apple-system, BlinkMacSystemFont, "Geist", "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

export interface BuyersGuideCoverProps {
  /** Optional first name for the personalized greeting. */
  recipientName?: string | null
  /** Community display name ("Tetherow", "Pronghorn / Juniper Preserve"). */
  communityName: string
  /** Web URL of the canonical guide ("https://ryan-realty.com/lp/tetherow/buyers-guide/"). */
  webUrl: string
  /** ISO timestamp the underlying data was current as of. */
  generatedAt: string
  /** Optional broker phone (defaults to 541.213.6706). */
  brokerPhone?: string
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function BuyersGuideCover({
  recipientName,
  communityName,
  webUrl,
  generatedAt,
  brokerPhone = '541.213.6706',
}: BuyersGuideCoverProps) {
  const greeting = recipientName?.trim() ? `${recipientName.trim()}, ` : ''
  const previewText = `The ${communityName} buyer's guide is attached.`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: CREAM, fontFamily: fontStack, margin: 0, padding: 0 }}>
        <Container
          style={{
            backgroundColor: '#ffffff',
            margin: '24px auto',
            maxWidth: '560px',
            border: `1px solid ${BORDER}`,
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <Section style={{ backgroundColor: NAVY, padding: '24px 32px' }}>
            <Img
              src="https://ryan-realty.com/brand/logo-header-white.png"
              alt="Ryan Realty"
              width="180"
              height="36"
              style={{ display: 'block' }}
            />
          </Section>

          <Section style={{ padding: '32px' }}>
            <Heading
              as="h1"
              style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: '24px',
                lineHeight: 1.2,
                color: NAVY,
                margin: '0 0 16px',
              }}
            >
              Your {communityName} buyer&rsquo;s guide
            </Heading>

            <Text style={{ fontSize: '15px', lineHeight: 1.6, color: NAVY, margin: '0 0 14px' }}>
              {greeting}thanks for the request. The {communityName} buyer&rsquo;s guide is attached
              as a PDF.
            </Text>
            <Text style={{ fontSize: '15px', lineHeight: 1.6, color: NAVY, margin: '0 0 14px' }}>
              Every number inside was current as of {formatDate(generatedAt)}. The HOA tiers, club
              membership reality, sub-neighborhood profiles, builder roster, and recent close
              history were all pulled live from the Oregon RMLS feed and the {communityName} Owners
              Association the day this version of the guide was generated.
            </Text>
            <Text style={{ fontSize: '15px', lineHeight: 1.6, color: NAVY, margin: '0 0 14px' }}>
              If you want the same guide as a web page (it stays current automatically), it lives at{' '}
              <Link href={webUrl} style={{ color: NAVY, textDecoration: 'underline' }}>
                {webUrl}
              </Link>
              .
            </Text>
            <Text style={{ fontSize: '15px', lineHeight: 1.6, color: NAVY, margin: '0 0 14px' }}>
              Reply to this email if a question comes up. It lands in our inbox, not a queue.
            </Text>

            <Hr style={{ borderTop: `1px solid ${BORDER}`, margin: '24px 0' }} />

            <Text style={{ fontSize: '14px', lineHeight: 1.5, color: NAVY, margin: '0 0 4px' }}>
              <strong>Matt Ryan</strong>
            </Text>
            <Text style={{ fontSize: '13px', lineHeight: 1.5, color: MUTED, margin: '0 0 4px' }}>
              Owner &amp; Principal Broker · Ryan Realty LLC
            </Text>
            <Text style={{ fontSize: '13px', lineHeight: 1.5, color: MUTED, margin: '0 0 4px' }}>
              {brokerPhone} · matt@ryan-realty.com
            </Text>
            <Text style={{ fontSize: '12px', lineHeight: 1.5, color: MUTED, margin: '0 0 4px' }}>
              Oregon Principal Broker · License #201206613
            </Text>
          </Section>

          <Section style={{ padding: '12px 32px 20px', backgroundColor: CREAM }}>
            <Text style={{ fontSize: '11px', lineHeight: 1.5, color: MUTED, margin: 0 }}>
              You requested this guide via the form on ryan-realty.com. No further follow-up unless
              you reply.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default BuyersGuideCover

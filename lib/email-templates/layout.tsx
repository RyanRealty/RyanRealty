import { Html, Head, Body, Container, Section, Text, Link } from '@react-email/components'
import * as React from 'react'
import {
  EMAIL_FONT_STACK,
  EMAIL_SERIF,
  EMAIL_NAVY,
  EMAIL_CREAM,
  EMAIL_MUTED,
  EMAIL_CANVAS,
} from '@/lib/email/brand'
import { BRAND } from '@/lib/brand/contact'

/**
 * React-email frame for account/transactional mail (welcome, password reset).
 * Mirrors the canonical branded shell (lib/email/shell.ts): navy masthead with
 * the serif wordmark, cream sheet on the warm canvas, muted footer with the
 * real postal address. Template-literal placeholders ({{unsubscribe_url}}) are
 * substituted by the sender.
 */
export function EmailLayout({ children, preheader }: { children: React.ReactNode; preheader?: string }) {
  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light" />
      </Head>
      {preheader ? (
        <div style={{ display: 'none', maxHeight: 0, overflow: 'hidden' }}>
          {preheader}
        </div>
      ) : null}
      <Body style={{ fontFamily: EMAIL_FONT_STACK, backgroundColor: EMAIL_CANVAS, margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 640, margin: '0 auto', backgroundColor: EMAIL_CREAM }}>
          <Section style={{ backgroundColor: EMAIL_NAVY, padding: '16px 32px' }}>
            <Text style={{ fontFamily: EMAIL_SERIF, color: EMAIL_CREAM, margin: 0, fontSize: 22, fontWeight: 700 }}>
              Ryan Realty
            </Text>
          </Section>
          <Section style={{ padding: '28px 34px 8px' }}>
            {children}
          </Section>
          <Section style={{ padding: '26px 34px 32px', fontSize: 12, color: EMAIL_MUTED, textAlign: 'center' as const }}>
            <Text style={{ margin: '0 0 8px 0', fontSize: 12, color: EMAIL_MUTED }}>
              {BRAND.mailingAddress} · <Link href={BRAND.url} style={{ color: EMAIL_MUTED }}>ryan-realty.com</Link>
            </Text>
            <Text style={{ margin: 0, fontSize: 12, color: EMAIL_MUTED }}>
              <Link href="{{unsubscribe_url}}" style={{ color: EMAIL_MUTED, textDecoration: 'underline' }}>Unsubscribe</Link>
              {' · '}
              <Link href="{{manage_preferences_url}}" style={{ color: EMAIL_MUTED, textDecoration: 'underline' }}>Manage preferences</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

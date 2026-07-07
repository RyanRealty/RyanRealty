import { Section, Text, Button } from '@react-email/components'
import * as React from 'react'
import { EmailLayout } from './layout'
import { EMAIL_NAVY, EMAIL_CREAM, EMAIL_INK, EMAIL_SERIF, EMAIL_BODY_MUTED } from '@/lib/email/brand'

const buttonStyle: React.CSSProperties = {
  backgroundColor: EMAIL_NAVY,
  color: EMAIL_CREAM,
  padding: '14px 32px',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textDecoration: 'none',
  display: 'inline-block',
}

export type WelcomeEmailProps = {
  firstName: string
  siteUrl: string
}

export default function WelcomeEmail({ firstName, siteUrl }: WelcomeEmailProps) {
  const searchUrl = `${siteUrl.replace(/\/$/, '')}/homes-for-sale`
  return (
    <EmailLayout preheader="Welcome to Ryan Realty. Save homes, set up search alerts, and get market reports.">
      <Section>
        <Text style={{ fontFamily: EMAIL_SERIF, fontSize: 26, lineHeight: 1.2, margin: '0 0 16px 0', color: EMAIL_NAVY }}>
          Welcome to Ryan Realty, {firstName}.
        </Text>
        <Text style={{ fontSize: 16, lineHeight: 1.6, color: EMAIL_INK, margin: '0 0 8px 0' }}>
          You can save homes, set up search alerts for new listings, and get market reports built from live Central Oregon MLS data.
        </Text>
        <Text style={{ fontSize: 16, lineHeight: 1.6, color: EMAIL_BODY_MUTED, margin: '0 0 20px 0' }}>
          When a question comes up, reply to this email and a broker answers.
        </Text>
        <Button style={buttonStyle} href={searchUrl}>
          BROWSE HOMES FOR SALE →
        </Button>
      </Section>
    </EmailLayout>
  )
}

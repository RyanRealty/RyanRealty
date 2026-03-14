import { Section, Text, Button, Link } from '@react-email/components'
import * as React from 'react'
import { EmailLayout } from './layout'

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#d4a853',
  color: '#102742',
  padding: '12px 24px',
  borderRadius: 8,
  fontWeight: 600,
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
        <Text style={{ fontSize: 18, margin: '0 0 16px 0', color: '#1f2937' }}>
          Welcome to Ryan Realty, {firstName}!
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 1.6, color: '#4b5563', margin: '0 0 16px 0' }}>
          You can save homes, set up search alerts for new listings, and get market reports. We&apos;re here to help you find your next place in Central Oregon.
        </Text>
        <Button style={buttonStyle} href={searchUrl}>
          Start Browsing Homes
        </Button>
      </Section>
    </EmailLayout>
  )
}

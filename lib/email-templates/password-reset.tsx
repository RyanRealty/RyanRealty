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

export type PasswordResetEmailProps = {
  resetUrl: string
}

export default function PasswordResetEmail({ resetUrl }: PasswordResetEmailProps) {
  return (
    <EmailLayout preheader="Reset your Ryan Realty password.">
      <Section>
        <Text style={{ fontFamily: EMAIL_SERIF, fontSize: 26, lineHeight: 1.2, margin: '0 0 16px 0', color: EMAIL_NAVY }}>
          Reset your password
        </Text>
        <Text style={{ fontSize: 16, lineHeight: 1.6, color: EMAIL_INK, margin: '0 0 20px 0' }}>
          Use the button below to set a new password. If you did not request this, you can ignore this email.
        </Text>
        <Button style={buttonStyle} href={resetUrl}>
          RESET PASSWORD →
        </Button>
        <Text style={{ fontSize: 12, color: EMAIL_BODY_MUTED, margin: '20px 0 0 0' }}>
          If the button does not work, copy and paste this link into your browser: {resetUrl}
        </Text>
      </Section>
    </EmailLayout>
  )
}

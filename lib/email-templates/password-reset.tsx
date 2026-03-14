import { Section, Text, Button } from '@react-email/components'
import * as React from 'react'
import { EmailLayout } from './layout'

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#102742',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: 8,
  fontWeight: 600,
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
        <Text style={{ fontSize: 18, margin: '0 0 16px 0', color: '#1f2937' }}>
          Reset your password
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 1.6, color: '#4b5563', margin: '0 0 16px 0' }}>
          Click the button below to set a new password. If you didn&apos;t request this, you can ignore this email.
        </Text>
        <Button style={buttonStyle} href={resetUrl}>
          Reset password
        </Button>
        <Text style={{ fontSize: 12, color: '#6b7280', margin: '16px 0 0 0' }}>
          If the button doesn&apos;t work, copy and paste this link into your browser: {resetUrl}
        </Text>
      </Section>
    </EmailLayout>
  )
}

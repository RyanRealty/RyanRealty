import { Html, Head, Body, Container, Section, Text, Hr, Link } from '@react-email/components'
import * as React from 'react'

const footerStyle: React.CSSProperties = {
  marginTop: 24,
  paddingTop: 24,
  borderTop: '1px solid #e5e7eb',
  fontSize: 12,
  color: '#6b7280',
}

export function EmailLayout({ children, preheader }: { children: React.ReactNode; preheader?: string }) {
  return (
    <Html>
      <Head />
      {preheader ? (
        <div style={{ display: 'none', maxHeight: 0, overflow: 'hidden' }}>
          {preheader}
        </div>
      ) : null}
      <Body style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f9fafb', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
          <Section style={{ backgroundColor: '#102742', padding: '16px 24px', borderRadius: '8px 8px 0 0' }}>
            <Text style={{ color: '#f0eeec', margin: 0, fontSize: 20, fontWeight: 700 }}>Ryan Realty</Text>
          </Section>
          <Section style={{ backgroundColor: '#ffffff', padding: 24, borderRadius: '0 0 8px 8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {children}
          </Section>
          <Section style={footerStyle}>
            <Text style={{ margin: '0 0 8px 0' }}>
              Ryan Realty · Central Oregon Real Estate
            </Text>
            <Text style={{ margin: '0 0 8px 0' }}>
              <Link href="{{unsubscribe_url}}" style={{ color: '#6b7280' }}>Unsubscribe</Link>
              {' · '}
              <Link href="{{manage_preferences_url}}" style={{ color: '#6b7280' }}>Manage preferences</Link>
            </Text>
            <Text style={{ margin: 0 }}>
              Physical address: 123 Main St, Bend, OR 97702 (CAN-SPAM)
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

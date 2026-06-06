/**
 * Digest email templates for Ryan Realty brokers.
 *
 * Renders react-email components via `sendEmail({ react: ... })` from
 * `lib/resend.ts`. Used by:
 *   /api/cron/daily-broker-digest   — 8am Pacific, one email per broker
 *   /api/cron/weekly-pipeline-digest — Mon 8am Pacific, Matt only
 *
 * Voice: brand voice rules from §4.7 of voice_guidelines.md. Sentence case,
 * no em-dashes, no banned cliches, direct and kind. Numbers carry units.
 */
import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Link, Section, Text } from '@react-email/components'
import { EMAIL_FONT_STACK } from '@/lib/email/brand'

// ---------------------------------------------------------------------------
// Daily new-leads digest
// ---------------------------------------------------------------------------

export type DailyLead = {
  fubPersonId: number
  name: string
  email: string | null
  phone: string | null
  source: string | null
  audience: 'seller' | 'buyer' | 'unknown'
  lastActivityIso: string | null
  addressLine: string | null
  fubUrl: string
}

export type DailyDigestEmailProps = {
  brokerFirstName: string
  asOfDate: string // YYYY-MM-DD
  leads: DailyLead[]
}

function formatDateLong(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'No activity yet'
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return 'No activity yet'
  const diff = Date.now() - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return `${days} days ago`
}

function brandHeader(): React.ReactElement {
  return (
    <Section style={{ backgroundColor: '#102742', padding: '20px 24px' }}>
      <Text style={{ color: '#faf8f4', margin: 0, fontSize: 14, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
        Ryan Realty
      </Text>
    </Section>
  )
}

function brandFooter(): React.ReactElement {
  return (
    <Section style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
      <Text style={{ margin: '0 0 4px 0', fontSize: 12, color: '#6b7280' }}>
        Ryan Realty. Central Oregon real estate.
      </Text>
      <Text style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
        541.213.6706. ryan-realty.com.
      </Text>
    </Section>
  )
}

export function DailyDigestEmail({ brokerFirstName, asOfDate, leads }: DailyDigestEmailProps): React.ReactElement {
  const sellerCount = leads.filter((l) => l.audience === 'seller').length
  const buyerCount = leads.filter((l) => l.audience === 'buyer').length
  const totalLeads = leads.length

  let summarySentence: string
  if (totalLeads === 0) {
    summarySentence = 'No new leads in the last 24 hours.'
  } else if (totalLeads === 1) {
    const audience = leads[0].audience === 'unknown' ? 'unclassified' : leads[0].audience
    summarySentence = `You got 1 new lead. Audience: ${audience}.`
  } else {
    const parts: string[] = []
    if (sellerCount > 0) parts.push(`${sellerCount} ${sellerCount === 1 ? 'is a seller' : 'are sellers'}`)
    if (buyerCount > 0) parts.push(`${buyerCount} ${buyerCount === 1 ? 'is a buyer' : 'are buyers'}`)
    const unknown = totalLeads - sellerCount - buyerCount
    if (unknown > 0) parts.push(`${unknown} unclassified`)
    summarySentence = `You got ${totalLeads} new leads. ${parts.join(', ')}.`
  }

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: EMAIL_FONT_STACK, backgroundColor: '#faf8f4', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 640, margin: '0 auto' }}>
          {brandHeader()}
          <Section style={{ backgroundColor: '#ffffff', padding: 24 }}>
            <Heading as="h1" style={{ fontSize: 20, color: '#102742', margin: '0 0 8px 0', fontWeight: 600 }}>
              Your new leads today
            </Heading>
            <Text style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px 0' }}>
              {formatDateLong(asOfDate)}
            </Text>
            <Text style={{ fontSize: 15, color: '#102742', margin: '0 0 24px 0', lineHeight: 1.5 }}>
              Hi {brokerFirstName}. {summarySentence}
            </Text>
            {totalLeads === 0 ? (
              <Text style={{ fontSize: 14, color: '#4b5563', margin: 0 }}>
                Nothing new in the last 24 hours. We will email you again tomorrow morning.
              </Text>
            ) : (
              <>
                <Hr style={{ borderColor: '#e5e7eb', margin: '0 0 16px 0' }} />
                {leads.map((lead) => (
                  <Section key={lead.fubPersonId} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid #f1f5f9' }}>
                    <Text style={{ fontSize: 15, fontWeight: 600, color: '#102742', margin: '0 0 4px 0' }}>
                      {lead.name}
                    </Text>
                    {lead.email ? (
                      <Text style={{ fontSize: 13, color: '#475569', margin: '0 0 2px 0' }}>
                        {lead.email}
                      </Text>
                    ) : null}
                    {lead.phone ? (
                      <Text style={{ fontSize: 13, color: '#475569', margin: '0 0 2px 0' }}>
                        {lead.phone}
                      </Text>
                    ) : null}
                    {lead.addressLine ? (
                      <Text style={{ fontSize: 13, color: '#475569', margin: '0 0 2px 0' }}>
                        Address: {lead.addressLine}
                      </Text>
                    ) : null}
                    <Text style={{ fontSize: 13, color: '#475569', margin: '0 0 2px 0' }}>
                      Source: {lead.source ?? 'Unknown'}. Audience: {lead.audience}.
                    </Text>
                    <Text style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px 0' }}>
                      Last activity: {relativeTime(lead.lastActivityIso)}
                    </Text>
                    <Link
                      href={lead.fubUrl}
                      style={{
                        fontSize: 13,
                        color: '#102742',
                        fontWeight: 500,
                        textDecoration: 'underline',
                      }}
                    >
                      Open in Follow Up Boss
                    </Link>
                  </Section>
                ))}
              </>
            )}
            {brandFooter()}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ---------------------------------------------------------------------------
// Weekly pipeline-health digest (Matt only)
// ---------------------------------------------------------------------------

export type AudienceCount = { label: string; count: number }
export type SourceCount = { source: string; count: number }
export type SmartListMovement = { name: string; current: number; previous: number; delta: number }

export type WeeklyDigestEmailProps = {
  weekOfDate: string // YYYY-MM-DD (Monday of this week)
  newLeadsByAudience: AudienceCount[]
  newLeadsBySource: SourceCount[]
  smartListMovement: SmartListMovement[]
  totals: {
    conversations: number
    appointments: number
    activeDeals: number
    pipelineValue: number
  }
  keyInsight: string
}

function formatWeek(isoDate: string): string {
  const start = new Date(`${isoDate}T00:00:00`)
  const end = new Date(start.getTime() + 6 * 86400000)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} to ${fmt(end)}`
}

function formatDelta(delta: number): string {
  if (delta === 0) return 'no change'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta} WoW`
}

export function WeeklyPipelineDigestEmail({
  weekOfDate,
  newLeadsByAudience,
  newLeadsBySource,
  smartListMovement,
  totals,
  keyInsight,
}: WeeklyDigestEmailProps): React.ReactElement {
  const totalNewLeads = newLeadsByAudience.reduce((sum, a) => sum + a.count, 0)

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    color: '#102742',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 600,
    margin: '20px 0 8px 0',
  }

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: EMAIL_FONT_STACK, backgroundColor: '#faf8f4', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 640, margin: '0 auto' }}>
          {brandHeader()}
          <Section style={{ backgroundColor: '#ffffff', padding: 24 }}>
            <Heading as="h1" style={{ fontSize: 20, color: '#102742', margin: '0 0 8px 0', fontWeight: 600 }}>
              Pipeline health
            </Heading>
            <Text style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px 0' }}>
              Week of {formatWeek(weekOfDate)}
            </Text>

            <Section style={{ backgroundColor: '#faf8f4', padding: 16, borderRadius: 6, marginBottom: 24 }}>
              <Text style={{ fontSize: 14, color: '#102742', margin: 0, lineHeight: 1.55 }}>
                {keyInsight}
              </Text>
            </Section>

            <Text style={sectionLabelStyle}>New leads this week ({totalNewLeads} total)</Text>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {newLeadsByAudience.length === 0 ? (
                  <tr>
                    <td style={{ padding: '6px 0', color: '#6b7280' }}>None this week.</td>
                  </tr>
                ) : (
                  newLeadsByAudience.map((row) => (
                    <tr key={row.label}>
                      <td style={{ padding: '6px 0', color: '#475569' }}>{row.label}</td>
                      <td style={{ padding: '6px 0', color: '#102742', fontWeight: 600, textAlign: 'right' }}>{row.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <Text style={sectionLabelStyle}>By source</Text>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {newLeadsBySource.length === 0 ? (
                  <tr>
                    <td style={{ padding: '6px 0', color: '#6b7280' }}>No source data.</td>
                  </tr>
                ) : (
                  newLeadsBySource.slice(0, 10).map((row) => (
                    <tr key={row.source}>
                      <td style={{ padding: '6px 0', color: '#475569' }}>{row.source}</td>
                      <td style={{ padding: '6px 0', color: '#102742', fontWeight: 600, textAlign: 'right' }}>{row.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <Text style={sectionLabelStyle}>Smart list movement</Text>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {smartListMovement.length === 0 ? (
                  <tr>
                    <td style={{ padding: '6px 0', color: '#6b7280' }}>No smart list data.</td>
                  </tr>
                ) : (
                  smartListMovement.map((row) => (
                    <tr key={row.name}>
                      <td style={{ padding: '6px 0', color: '#475569' }}>{row.name}</td>
                      <td style={{ padding: '6px 0', color: '#102742', fontWeight: 600, textAlign: 'right' }}>
                        {row.current} ({formatDelta(row.delta)})
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <Text style={sectionLabelStyle}>Activity totals</Text>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 0', color: '#475569' }}>Conversations</td>
                  <td style={{ padding: '6px 0', color: '#102742', fontWeight: 600, textAlign: 'right' }}>{totals.conversations}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', color: '#475569' }}>Appointments</td>
                  <td style={{ padding: '6px 0', color: '#102742', fontWeight: 600, textAlign: 'right' }}>{totals.appointments}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', color: '#475569' }}>Active deals</td>
                  <td style={{ padding: '6px 0', color: '#102742', fontWeight: 600, textAlign: 'right' }}>{totals.activeDeals}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', color: '#475569' }}>Pipeline value</td>
                  <td style={{ padding: '6px 0', color: '#102742', fontWeight: 600, textAlign: 'right' }}>
                    ${totals.pipelineValue.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>

            {brandFooter()}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

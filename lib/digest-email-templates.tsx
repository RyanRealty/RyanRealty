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

function formatDateLong(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
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
        541.703.3095. ryan-realty.com.
      </Text>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Daily broker digest sourced from crm_* (CONTACT360 Phase 10.4)
//
// Same brand shell as DailyDigestEmail above, but renders the richer CRM-sourced
// summary: new leads (linking into our own /admin/crm), open tasks, hot/awaiting
// workflow enrollments, and recent inbound replies. Shape comes straight from
// summarizeDigest() in lib/data/crm/getBrokerDigest.ts, so the email holds no
// data logic of its own.
// ---------------------------------------------------------------------------

export type CrmDigestLeadProp = {
  personId: number
  name: string
  email: string | null
  phone: string | null
  source: string | null
  audience: 'seller' | 'buyer' | 'unknown'
  crmUrl: string
}

export type CrmDigestTaskProp = {
  taskId: number
  name: string
  personName: string | null
  dueAtIso: string | null
  overdue: boolean
}

export type CrmDigestEnrollmentProp = {
  enrollmentId: number
  personName: string | null
  sequenceName: string
  status: string
  awaiting: boolean
}

export type CrmDigestInboundProp = {
  timelineId: number
  personName: string | null
  kind: string
  snippet: string | null
  tsIso: string
}

export type BrokerCrmDigestEmailProps = {
  brokerFirstName: string
  asOfDate: string // YYYY-MM-DD
  summarySentence: string
  leads: CrmDigestLeadProp[]
  tasks: CrmDigestTaskProp[]
  enrollments: CrmDigestEnrollmentProp[]
  inbound: CrmDigestInboundProp[]
}

function formatDueDate(iso: string | null): string {
  if (!iso) return 'No due date'
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return 'No due date'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function inboundLabel(kind: string): string {
  switch (kind) {
    case 'sms_in':
      return 'Text'
    case 'email_in':
      return 'Email'
    case 'form_submit':
      return 'Form'
    case 'voicemail':
      return 'Voicemail'
    default:
      return 'Reply'
  }
}

const crmSectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#102742',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 600,
  margin: '24px 0 8px 0',
}

export function BrokerCrmDigestEmail({
  brokerFirstName,
  asOfDate,
  summarySentence,
  leads,
  tasks,
  enrollments,
  inbound,
}: BrokerCrmDigestEmailProps): React.ReactElement {
  const nothing = leads.length === 0 && tasks.length === 0 && enrollments.length === 0 && inbound.length === 0

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: EMAIL_FONT_STACK, backgroundColor: '#faf8f4', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 640, margin: '0 auto' }}>
          {brandHeader()}
          <Section style={{ backgroundColor: '#ffffff', padding: 24 }}>
            <Heading as="h1" style={{ fontSize: 20, color: '#102742', margin: '0 0 8px 0', fontWeight: 600 }}>
              Your day in the CRM
            </Heading>
            <Text style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px 0' }}>{formatDateLong(asOfDate)}</Text>
            <Text style={{ fontSize: 15, color: '#102742', margin: '0 0 8px 0', lineHeight: 1.5 }}>
              Hi {brokerFirstName}. {summarySentence}
            </Text>

            {nothing ? (
              <Text style={{ fontSize: 14, color: '#4b5563', margin: '16px 0 0 0' }}>
                Nothing needs you right now. We will email you again tomorrow morning.
              </Text>
            ) : null}

            {leads.length > 0 ? (
              <>
                <Text style={crmSectionLabelStyle}>New leads ({leads.length})</Text>
                {leads.map((lead) => (
                  <Section
                    key={lead.personId}
                    style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: 600, color: '#102742', margin: '0 0 4px 0' }}>{lead.name}</Text>
                    {lead.email ? (
                      <Text style={{ fontSize: 13, color: '#475569', margin: '0 0 2px 0' }}>{lead.email}</Text>
                    ) : null}
                    {lead.phone ? (
                      <Text style={{ fontSize: 13, color: '#475569', margin: '0 0 2px 0' }}>{lead.phone}</Text>
                    ) : null}
                    <Text style={{ fontSize: 13, color: '#475569', margin: '0 0 8px 0' }}>
                      Source: {lead.source ?? 'Unknown'}. Audience: {lead.audience}.
                    </Text>
                    <Link
                      href={lead.crmUrl}
                      style={{ fontSize: 13, color: '#102742', fontWeight: 500, textDecoration: 'underline' }}
                    >
                      Open the contact
                    </Link>
                  </Section>
                ))}
              </>
            ) : null}

            {inbound.length > 0 ? (
              <>
                <Text style={crmSectionLabelStyle}>Recent inbound ({inbound.length})</Text>
                {inbound.map((item) => (
                  <Section key={item.timelineId} style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, color: '#102742', margin: '0 0 2px 0' }}>
                      <span style={{ fontWeight: 600 }}>{item.personName ?? 'A contact'}</span> sent a{' '}
                      {inboundLabel(item.kind).toLowerCase()}.
                    </Text>
                    {item.snippet ? (
                      <Text style={{ fontSize: 13, color: '#475569', margin: 0 }}>{item.snippet}</Text>
                    ) : null}
                  </Section>
                ))}
              </>
            ) : null}

            {enrollments.length > 0 ? (
              <>
                <Text style={crmSectionLabelStyle}>Workflows needing you ({enrollments.length})</Text>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {enrollments.map((e) => (
                      <tr key={e.enrollmentId}>
                        <td style={{ padding: '6px 0', color: '#475569' }}>
                          {e.personName ?? 'A contact'} on {e.sequenceName}
                        </td>
                        <td style={{ padding: '6px 0', color: '#102742', fontWeight: 600, textAlign: 'right' }}>
                          {e.awaiting ? 'Awaiting you' : 'Running'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}

            {tasks.length > 0 ? (
              <>
                <Text style={crmSectionLabelStyle}>Open tasks ({tasks.length})</Text>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {tasks.map((t) => (
                      <tr key={t.taskId}>
                        <td style={{ padding: '6px 0', color: '#475569' }}>
                          {t.name}
                          {t.personName ? ` for ${t.personName}` : ''}
                        </td>
                        <td
                          style={{
                            padding: '6px 0',
                            color: t.overdue ? '#b91c1c' : '#102742',
                            fontWeight: 600,
                            textAlign: 'right',
                          }}
                        >
                          {t.overdue ? 'Overdue' : formatDueDate(t.dueAtIso)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}

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

import Link from 'next/link'
import type { DashboardMarketingData } from '@/app/actions/dashboard'
import { SectionHead } from '@/components/admin/v2'

type Props = {
  data: DashboardMarketingData
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function formatCurrency(value: number): string {
  // NOT lib/format/money: this panel shows ad spend and cost-per-lead, where the
  // CENTS are the point. Every helper there is whole-dollar (formatPrice also
  // rounds to the nearest $1,000), so a swap would silently drop precision from
  // a figure the broker judges spend by. Baselined in ci:currency-format for
  // that reason, not for convenience.
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

function getVerdictLabel(verdict: DashboardMarketingData['reportCard']['verdict']): string {
  if (verdict === 'strong') return 'Strong'
  if (verdict === 'needs_attention') return 'Needs attention'
  return 'At risk'
}

/** Local av2 badge — components/ui/badge is blacklisted as admin design input. */
function Badge({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <span
      className={numeric ? 'a-num' : undefined}
      style={{
        fontSize: 'var(--a-text-xs)',
        color: 'var(--a-text-2)',
        border: '1px solid var(--a-border)',
        borderRadius: 'var(--a-r-sm)',
        padding: '1px 6px',
      }}
    >
      {children}
    </span>
  )
}

export default function DashboardMarketingCommandCenterPanel({ data }: Props) {
  return (
    <div className="space-y-4">
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        Unified Facebook, Google Analytics, and CRM seller pipeline view for {data.windowLabel}.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="av2-pane">
          <SectionHead>Meta Ads</SectionHead>
          <div className="space-y-2" style={{ fontSize: 'var(--a-text-sm)' }}>
            {!data.metaAds.configured ? (
              <p style={{ color: 'var(--a-text-2)' }}>{data.metaAds.error ?? 'Meta Ads API is not configured yet.'}</p>
            ) : !data.metaAds.summary ? (
              <p style={{ color: 'var(--a-text-2)' }}>{data.metaAds.error ?? 'No Meta Ads summary available.'}</p>
            ) : (
              <>
                <p style={{ color: 'var(--a-text)' }}>Spend: <strong className="a-num">{formatCurrency(data.metaAds.summary.spend)}</strong></p>
                <p style={{ color: 'var(--a-text)' }}>Impressions: <strong className="a-num">{data.metaAds.summary.impressions.toLocaleString()}</strong></p>
                <p style={{ color: 'var(--a-text)' }}>CTR: <strong className="a-num">{data.metaAds.summary.ctr.toFixed(2)}%</strong></p>
                <p style={{ color: 'var(--a-text)' }}>Frequency: <strong className="a-num">{data.metaAds.summary.frequency.toFixed(2)}</strong></p>
                <p style={{ color: 'var(--a-text)' }}>Lead actions: <strong className="a-num">{data.metaAds.summary.leadActions.toLocaleString()}</strong></p>
                <p style={{ color: 'var(--a-text)' }}>
                  Cost per lead:{' '}
                  <strong className="a-num">
                    {data.metaAds.summary.costPerLead === null
                      ? 'N/A'
                      : formatCurrency(data.metaAds.summary.costPerLead)}
                  </strong>
                </p>
              </>
            )}
          </div>
        </div>

        <div className="av2-pane">
          <SectionHead>Google Analytics</SectionHead>
          <div className="space-y-2" style={{ fontSize: 'var(--a-text-sm)' }}>
            {!data.ga4.ok ? (
              <p style={{ color: 'var(--a-text-2)' }}>{data.ga4.error ?? 'GA4 is not configured yet.'}</p>
            ) : (
              <>
                <p style={{ color: 'var(--a-text)' }}>Sessions: <strong className="a-num">{data.ga4.sessions.toLocaleString()}</strong></p>
                <p style={{ color: 'var(--a-text)' }}>Social sessions: <strong className="a-num">{data.ga4.socialSessions.toLocaleString()}</strong></p>
                <p style={{ color: 'var(--a-text)' }}>Facebook lead events: <strong className="a-num">{data.ga4.facebookLeadEvents.toLocaleString()}</strong></p>
                <p style={{ color: 'var(--a-text)' }}>Lead event rate: <strong className="a-num">{formatPercent(data.ga4.leadEventRate)}</strong></p>
              </>
            )}
          </div>
        </div>

        <div className="av2-pane">
          <SectionHead>CRM contacts</SectionHead>
          <div className="space-y-2" style={{ fontSize: 'var(--a-text-sm)' }}>
            {!data.fub.configured ? (
              <p style={{ color: 'var(--a-text-2)' }}>{data.fub.error ?? 'No CRM contact data is available yet.'}</p>
            ) : (
              <>
                <p style={{ color: 'var(--a-text)' }}>Contacts added to the CRM: <strong className="a-num">{data.fub.contactsSynced30d.toLocaleString()}</strong></p>
                <p style={{ color: 'var(--a-text)' }}>Facebook sourced contacts: <strong className="a-num">{data.fub.facebookContacts30d.toLocaleString()}</strong></p>
                <p style={{ color: 'var(--a-text)' }}>
                  Facebook event to CRM contact rate:{' '}
                  <strong className="a-num">
                    {data.fub.facebookContactCaptureRate === null
                      ? 'N/A'
                      : formatPercent(data.fub.facebookContactCaptureRate)}
                  </strong>
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="av2-pane">
        <SectionHead>Seller Funnel Snapshot</SectionHead>
        <div className="space-y-2" style={{ fontSize: 'var(--a-text-sm)' }}>
          <p style={{ color: 'var(--a-text)' }}>
            Seller page visits: <strong className="a-num">{data.website.sellerVisits30d.toLocaleString()}</strong>
          </p>
          <p style={{ color: 'var(--a-text)' }}>
            Seller visits from Facebook UTMs: <strong className="a-num">{data.website.sellerVisitsFromFacebook30d.toLocaleString()}</strong>
          </p>
          <p style={{ color: 'var(--a-text)' }}>
            Valuation requests: <strong className="a-num">{data.website.valuationRequests30d.toLocaleString()}</strong>
          </p>
          <p style={{ color: 'var(--a-text)' }}>
            Facebook seller visit to valuation rate:{' '}
            <strong className="a-num">
              {data.website.valuationRateFromFacebookSellerVisits === null
                ? 'N/A'
                : formatPercent(data.website.valuationRateFromFacebookSellerVisits)}
            </strong>
          </p>
        </div>
      </div>

      <div className="av2-pane">
        <SectionHead>My Leads Pipeline (CRM)</SectionHead>
        <div className="space-y-2" style={{ fontSize: 'var(--a-text-sm)' }}>
          <p style={{ color: 'var(--a-text)' }}>
            Matt broker link: <strong>{data.fubPipeline.mattBrokerId ? 'Resolved' : 'Not resolved'}</strong>
          </p>
          <p style={{ color: 'var(--a-text)' }}>
            My Leads contacts: <strong className="a-num">{data.fubPipeline.myLeadsTotal.toLocaleString()}</strong>
          </p>
          <p style={{ color: 'var(--a-text)' }}>
            Realtor contacts excluded from targeting: <strong className="a-num">{data.fubPipeline.realtorExcludedCount.toLocaleString()}</strong>
          </p>
          <p style={{ color: 'var(--a-text)' }}>
            Targetable seller pool: <strong className="a-num">{data.fubPipeline.targetableLeadPool.toLocaleString()}</strong>
          </p>
          <p style={{ color: 'var(--a-text)' }}>
            Active pipeline count: <strong className="a-num">{data.fubPipeline.activePipelineCount.toLocaleString()}</strong>
          </p>
          <div className="space-y-1 pt-1">
            <p className="font-medium" style={{ color: 'var(--a-text)' }}>Top stages</p>
            {data.fubPipeline.stageCounts.length === 0 ? (
              <p style={{ color: 'var(--a-text-2)' }}>No stage data found in this window.</p>
            ) : (
              data.fubPipeline.stageCounts.slice(0, 6).map((stage) => (
                <p key={stage.stage} className="a-num" style={{ color: 'var(--a-text-2)' }}>
                  {stage.stage}: {stage.count.toLocaleString()}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="av2-pane">
        <SectionHead>Automated Outreach Playbook</SectionHead>
        <div className="space-y-2" style={{ fontSize: 'var(--a-text-sm)' }}>
          {data.fubPipeline.outreachAutomationPlan.map((step) => (
            <div key={step} className="rounded-md p-3" style={{ background: 'var(--a-inset)', color: 'var(--a-text-2)' }}>
              {step}
            </div>
          ))}
        </div>
      </div>

      <div className="av2-pane">
        <SectionHead>Weekly Optimization Report Card</SectionHead>
        <div className="space-y-3" style={{ fontSize: 'var(--a-text-sm)' }}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge numeric>Score {data.reportCard.score}/100</Badge>
            <Badge>{getVerdictLabel(data.reportCard.verdict)}</Badge>
          </div>
          <div className="space-y-2">
            {data.reportCard.items.map((item) => (
              <div key={`${item.action}-${item.title}`} className="rounded-md p-3" style={{ background: 'var(--a-inset)' }}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{item.action}</Badge>
                  <Badge>{item.priority}</Badge>
                  <p className="font-medium" style={{ color: 'var(--a-text)' }}>{item.title}</p>
                </div>
                <p className="mt-1" style={{ color: 'var(--a-text-2)' }}>{item.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="av2-pane">
        <SectionHead>Automation and Agent Pickup</SectionHead>
        <div className="space-y-3" style={{ fontSize: 'var(--a-text-sm)' }}>
          {data.automation.latestInsightId ? (
            <>
              <p style={{ color: 'var(--a-text)' }}>
                Latest packet: <strong>{data.automation.latestTitle ?? 'Marketing optimization packet'}</strong>
              </p>
              <p style={{ color: 'var(--a-text-2)' }}>
                Generated: {data.automation.latestGeneratedAt ? new Date(data.automation.latestGeneratedAt).toLocaleString() : 'Unknown'} •
                Status: {data.automation.latestStatus ?? 'pending'}
              </p>
              <p style={{ color: 'var(--a-text-2)' }}>
                This packet is stored in `agent_insights` with type `marketing_optimization_weekly` and can be picked up by any agent.
              </p>
              <div className="rounded-md p-3" style={{ background: 'var(--a-inset)' }}>
                <p className="mb-2 font-medium" style={{ color: 'var(--a-text)' }}>Agent pickup prompt</p>
                <pre
                  className="overflow-x-auto whitespace-pre-wrap"
                  style={{ fontFamily: 'var(--a-font-mono)', fontSize: 'var(--a-text-xs)', color: 'var(--a-text)' }}
                >
                  {data.automation.latestPickupPrompt ?? 'No pickup prompt found in latest packet.'}
                </pre>
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--a-text-2)' }}>
              No automated packet yet. Cron will generate one at `/api/cron/marketing-optimization-report` each Monday.
            </p>
          )}

          <div style={{ borderTop: '1px solid var(--a-border)' }} />

          {data.automation.latestExecutionInsightId ? (
            <div className="space-y-2">
              <p style={{ color: 'var(--a-text)' }}>
                Latest outreach execution packet:{' '}
                <strong>{data.automation.latestExecutionTitle ?? 'Outreach execution packet'}</strong>
              </p>
              <p style={{ color: 'var(--a-text-2)' }}>
                Generated:{' '}
                {data.automation.latestExecutionGeneratedAt
                  ? new Date(data.automation.latestExecutionGeneratedAt).toLocaleString()
                  : 'Unknown'}{' '}
                • Status: {data.automation.latestExecutionStatus ?? 'pending'} • Mode:{' '}
                {data.automation.latestExecutionMode ?? 'dry_run'}
              </p>
              <p className="a-num" style={{ color: 'var(--a-text-2)' }}>
                Packets generated: {data.automation.latestExecutionGeneratedCount ?? 0} • Applied:{' '}
                {data.automation.latestExecutionAppliedCount ?? 0}
              </p>
              <p style={{ color: 'var(--a-text-2)' }}>
                Execution only targets Matt My Leads and suppresses likely realtors before any automation tags/stage updates.
              </p>
            </div>
          ) : (
            <p style={{ color: 'var(--a-text-2)' }}>
              No outreach execution packet yet. Packets are stored in `agent_insights` when an execution run completes.
            </p>
          )}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--a-border)' }} />

      <div className="space-y-2">
        <p className="font-medium" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>Next actions</p>
        <ul className="space-y-1">
          {data.nextActions.slice(0, 6).map((action) => (
            <li key={action} className="flex gap-2" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              <span aria-hidden className="shrink-0" style={{ color: 'var(--a-text)' }}>
                •
              </span>
              <span className="min-w-0 break-words">{action}</span>
            </li>
          ))}
        </ul>
        {data.nextActions.length > 6 ? (
          <p className="a-num" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            Showing top 6 of {data.nextActions.length} recommendations.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-4" style={{ fontSize: 'var(--a-text-sm)' }}>
        <Link
          href="https://adsmanager.facebook.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
          style={{ color: 'var(--a-ok)' }}
        >
          Open Meta Ads Manager
        </Link>
        <Link
          href="https://analytics.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
          style={{ color: 'var(--a-ok)' }}
        >
          Open Google Analytics
        </Link>
      </div>
    </div>
  )
}

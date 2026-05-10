import Link from 'next/link'
import type { DashboardMarketingData } from '@/app/actions/dashboard'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

type Props = {
  data: DashboardMarketingData
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

function getVerdictLabel(verdict: DashboardMarketingData['reportCard']['verdict']): string {
  if (verdict === 'strong') return 'Strong'
  if (verdict === 'needs_attention') return 'Needs attention'
  return 'At risk'
}

export default function DashboardMarketingCommandCenterPanel({ data }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Unified Facebook, Google Analytics, and Follow Up Boss seller pipeline view for {data.windowLabel}.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Meta Ads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!data.metaAds.configured ? (
              <p className="text-muted-foreground">{data.metaAds.error ?? 'Meta Ads API is not configured yet.'}</p>
            ) : !data.metaAds.summary ? (
              <p className="text-muted-foreground">{data.metaAds.error ?? 'No Meta Ads summary available.'}</p>
            ) : (
              <>
                <p className="text-foreground">Spend: <strong>{formatCurrency(data.metaAds.summary.spend)}</strong></p>
                <p className="text-foreground">Impressions: <strong>{data.metaAds.summary.impressions.toLocaleString()}</strong></p>
                <p className="text-foreground">CTR: <strong>{data.metaAds.summary.ctr.toFixed(2)}%</strong></p>
                <p className="text-foreground">Frequency: <strong>{data.metaAds.summary.frequency.toFixed(2)}</strong></p>
                <p className="text-foreground">Lead actions: <strong>{data.metaAds.summary.leadActions.toLocaleString()}</strong></p>
                <p className="text-foreground">
                  Cost per lead:{' '}
                  <strong>
                    {data.metaAds.summary.costPerLead === null
                      ? 'N/A'
                      : formatCurrency(data.metaAds.summary.costPerLead)}
                  </strong>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Google Analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!data.ga4.ok ? (
              <p className="text-muted-foreground">{data.ga4.error ?? 'GA4 is not configured yet.'}</p>
            ) : (
              <>
                <p className="text-foreground">Sessions: <strong>{data.ga4.sessions.toLocaleString()}</strong></p>
                <p className="text-foreground">Social sessions: <strong>{data.ga4.socialSessions.toLocaleString()}</strong></p>
                <p className="text-foreground">Facebook lead events: <strong>{data.ga4.facebookLeadEvents.toLocaleString()}</strong></p>
                <p className="text-foreground">Lead event rate: <strong>{formatPercent(data.ga4.leadEventRate)}</strong></p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Follow Up Boss</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!data.fub.configured ? (
              <p className="text-muted-foreground">{data.fub.error ?? 'Follow Up Boss is not configured yet.'}</p>
            ) : (
              <>
                <p className="text-foreground">Contacts synced: <strong>{data.fub.contactsSynced30d.toLocaleString()}</strong></p>
                <p className="text-foreground">Facebook sourced contacts: <strong>{data.fub.facebookContacts30d.toLocaleString()}</strong></p>
                <p className="text-foreground">
                  Facebook event to FUB capture rate:{' '}
                  <strong>
                    {data.fub.facebookContactCaptureRate === null
                      ? 'N/A'
                      : formatPercent(data.fub.facebookContactCaptureRate)}
                  </strong>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Seller Funnel Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-foreground">
            Seller page visits: <strong>{data.website.sellerVisits30d.toLocaleString()}</strong>
          </p>
          <p className="text-foreground">
            Seller visits from Facebook UTMs: <strong>{data.website.sellerVisitsFromFacebook30d.toLocaleString()}</strong>
          </p>
          <p className="text-foreground">
            Valuation requests: <strong>{data.website.valuationRequests30d.toLocaleString()}</strong>
          </p>
          <p className="text-foreground">
            Facebook seller visit to valuation rate:{' '}
            <strong>
              {data.website.valuationRateFromFacebookSellerVisits === null
                ? 'N/A'
                : formatPercent(data.website.valuationRateFromFacebookSellerVisits)}
            </strong>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">My Leads Pipeline (FUB)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-foreground">
            Matt broker link: <strong>{data.fubPipeline.mattBrokerId ? 'Resolved' : 'Not resolved'}</strong>
          </p>
          <p className="text-foreground">
            My Leads contacts: <strong>{data.fubPipeline.myLeadsTotal.toLocaleString()}</strong>
          </p>
          <p className="text-foreground">
            Realtor contacts excluded from targeting: <strong>{data.fubPipeline.realtorExcludedCount.toLocaleString()}</strong>
          </p>
          <p className="text-foreground">
            Targetable seller pool: <strong>{data.fubPipeline.targetableLeadPool.toLocaleString()}</strong>
          </p>
          <p className="text-foreground">
            Active pipeline count: <strong>{data.fubPipeline.activePipelineCount.toLocaleString()}</strong>
          </p>
          <div className="space-y-1 pt-1">
            <p className="font-medium text-foreground">Top stages</p>
            {data.fubPipeline.stageCounts.length === 0 ? (
              <p className="text-muted-foreground">No stage data found in this window.</p>
            ) : (
              data.fubPipeline.stageCounts.slice(0, 6).map((stage) => (
                <p key={stage.stage} className="text-muted-foreground">
                  {stage.stage}: {stage.count.toLocaleString()}
                </p>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Automated Outreach Playbook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.fubPipeline.outreachAutomationPlan.map((step) => (
            <div key={step} className="rounded-md bg-muted p-3 text-muted-foreground">
              {step}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Weekly Optimization Report Card</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Score {data.reportCard.score}/100</Badge>
            <Badge variant="secondary">{getVerdictLabel(data.reportCard.verdict)}</Badge>
          </div>
          <div className="space-y-2">
            {data.reportCard.items.map((item) => (
              <div key={`${item.action}-${item.title}`} className="rounded-md bg-muted p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.action}</Badge>
                  <Badge variant="secondary">{item.priority}</Badge>
                  <p className="font-medium text-foreground">{item.title}</p>
                </div>
                <p className="mt-1 text-muted-foreground">{item.rationale}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Automation and Agent Pickup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {data.automation.latestInsightId ? (
            <>
              <p className="text-foreground">
                Latest packet: <strong>{data.automation.latestTitle ?? 'Marketing optimization packet'}</strong>
              </p>
              <p className="text-muted-foreground">
                Generated: {data.automation.latestGeneratedAt ? new Date(data.automation.latestGeneratedAt).toLocaleString() : 'Unknown'} •
                Status: {data.automation.latestStatus ?? 'pending'}
              </p>
              <p className="text-muted-foreground">
                This packet is stored in `agent_insights` with type `marketing_optimization_weekly` and can be picked up by any agent.
              </p>
              <div className="rounded-md bg-muted p-3">
                <p className="mb-2 font-medium text-foreground">Agent pickup prompt</p>
                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-foreground">
                  {data.automation.latestPickupPrompt ?? 'No pickup prompt found in latest packet.'}
                </pre>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              No automated packet yet. Cron will generate one at `/api/cron/marketing-optimization-report` each Monday.
            </p>
          )}

          <Separator />

          {data.automation.latestExecutionInsightId ? (
            <div className="space-y-2">
              <p className="text-foreground">
                Latest FUB execution packet:{' '}
                <strong>{data.automation.latestExecutionTitle ?? 'FUB outreach execution packet'}</strong>
              </p>
              <p className="text-muted-foreground">
                Generated:{' '}
                {data.automation.latestExecutionGeneratedAt
                  ? new Date(data.automation.latestExecutionGeneratedAt).toLocaleString()
                  : 'Unknown'}{' '}
                • Status: {data.automation.latestExecutionStatus ?? 'pending'} • Mode:{' '}
                {data.automation.latestExecutionMode ?? 'dry_run'}
              </p>
              <p className="text-muted-foreground">
                Packets generated: {data.automation.latestExecutionGeneratedCount ?? 0} • Applied in FUB:{' '}
                {data.automation.latestExecutionAppliedCount ?? 0}
              </p>
              <p className="text-muted-foreground">
                Execution only targets Matt My Leads and suppresses likely realtors before any automation tags/stage updates.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              No FUB execution packet yet. Cron will generate one at `/api/cron/fub-outreach-execution` each Monday.
            </p>
          )}
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Next actions</p>
        <div className="flex flex-wrap gap-2">
          {data.nextActions.map((action) => (
            <Badge key={action} variant="secondary">
              {action}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="https://adsmanager.facebook.com" target="_blank" rel="noopener noreferrer" className="text-success hover:underline">
          Open Meta Ads Manager
        </Link>
        <Link href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-success hover:underline">
          Open Google Analytics
        </Link>
      </div>
    </div>
  )
}


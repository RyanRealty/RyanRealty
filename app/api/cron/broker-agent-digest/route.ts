/**
 * broker-agent-digest cron route — R3.5 supervision digest
 * (docs/plans/BROKER_SMS_AGENT_2026-07-31.md Phase 3 + DONE item 7: "Matt
 * receives a daily digest of every broker-initiated action, approval,
 * publish, and law Q&A exchange").
 *
 * Emails Matt everything the broker SMS agent's brokers did in the last 24h,
 * grouped by broker: action rows the agent created (create_action, R2.2),
 * which of those the broker self-approved via the literal APPROVE token (the
 * §1 amendment — every approval on a `generated_by='broker_sms_agent'` row is
 * the requesting broker's own stamp, never Matt's, which is exactly why
 * principal-broker supervision needs it named), every law_lookup Q&A pair,
 * and per-broker LLM spend (R2.1 cost ledger — "nothing is zero cost").
 *
 * Sends nothing when the window was quiet: `getBrokerAgentDigest().hasActivity
 * === false` short-circuits to `{ skipped: true }` before any email goes out
 * (no empty-digest noise; the R3.5 accept bar is "renders with a seeded day's
 * activity," not "always sends").
 *
 * Reuses the exact internal-notification email path the inbound-SMS broker
 * alert uses (app/api/twilio/inbound-sms/route.ts ~L289): sendCrmEmail from
 * lib/crm/gmail, sent matt@ryan-realty.com -> matt@ryan-realty.com — the same
 * "internal alert to the broker's own mailbox" pattern as the westside-cohort
 * digest and the new-text alert. Never a lead/client send, so no suppression
 * gate applies.
 *
 * Schedule: daily 14:00 UTC (07:00 PT summer / 06:00 PT winter) — registered
 * in vercel.json "crons" (ci:cron-registered).
 *
 * Manual invocation: GET /api/cron/broker-agent-digest?dryRun=true&sinceHours=24
 *   dryRun returns the computed report as JSON without sending, regardless of
 *   activity (so the "renders with a seeded day's activity" accept bar is
 *   checkable without waiting for the schedule or risking a real send).
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { getBrokerAgentDigest, type BrokerAgentDigestData, type BrokerAgentDigestGroup } from '@/lib/data/agent/digest'
import { sendCrmEmail, CRM_MAILBOXES } from '@/lib/crm/gmail'
import { CRM_BROKER_DISPLAY, type CrmBrokerSlug } from '@/lib/crm/constants'
import { escapeHtml } from '@/lib/westside-digest-email'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const SUBJECT = 'Broker SMS agent daily digest'

function brokerLabel(slug: string): string {
  return CRM_BROKER_DISPLAY[slug as CrmBrokerSlug] ?? slug
}

/** LLM/producer spend is cents-and-fractions-of-a-cent per turn — 4 decimals
 *  keeps a $0.0031 line from rounding to $0.00 and reading as free. */
function fmtCost(n: number): string {
  return `$${n.toFixed(4)}`
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' })} PT`
}

function renderGroupHtml(group: BrokerAgentDigestGroup): string {
  const name = brokerLabel(group.brokerSlug)

  const actionsHtml = group.actions.length
    ? `<ul>${group.actions
        .map(
          (a) =>
            `<li>${escapeHtml(a.topic || a.actionType)} &mdash; ${escapeHtml(a.actionType)} &mdash; status: ${escapeHtml(a.status)} (target: ${escapeHtml(a.target)})</li>`,
        )
        .join('')}</ul>`
    : '<p>No actions initiated.</p>'

  const approvedHtml = group.selfApproved.length
    ? `<ul>${group.selfApproved
        .map(
          (a) =>
            `<li>${escapeHtml(a.topic || a.actionType)} &mdash; approved by ${escapeHtml(a.approvedBy ?? '')} at ${fmtDateTime(a.approvedAt ?? '')}</li>`,
        )
        .join('')}</ul>`
    : '<p>No self-approved publishes.</p>'

  const lawHtml = group.lawQa.length
    ? `<ul>${group.lawQa
        .map((q) => {
          const cites = q.citations.length
            ? q.citations.map((c) => `${escapeHtml(c.figure)} (${escapeHtml(c.source)})`).join('; ')
            : 'none recorded'
          return `<li><strong>Q:</strong> ${escapeHtml(q.question)}<br/><strong>A:</strong> ${escapeHtml(q.answer)}<br/>Citations: ${cites}</li>`
        })
        .join('')}</ul>`
    : '<p>No law questions.</p>'

  return `
<h2 style="margin:24px 0 8px;">${escapeHtml(name)}</h2>
<h3 style="margin:16px 0 4px;">Actions initiated (${group.actions.length})</h3>
${actionsHtml}
<h3 style="margin:16px 0 4px;">Self-approved publishes (${group.selfApproved.length})</h3>
${approvedHtml}
<h3 style="margin:16px 0 4px;">Law Q&amp;A (${group.lawQa.length})</h3>
${lawHtml}
<p>Spend: ${fmtCost(group.costUsd)}</p>`
}

function renderDigestHtml(data: BrokerAgentDigestData): string {
  const sections = data.groups.map(renderGroupHtml).join('\n')
  return `<div style="font-size:14px;max-width:640px;">
<p>Broker SMS agent activity, ${fmtDateTime(data.windowStartIso)} through ${fmtDateTime(data.generatedAtIso)}.</p>
${sections}
<p style="margin-top:24px;font-weight:600;">Total spend: ${fmtCost(data.totalCostUsd)}</p>
</div>`
}

function renderDigestText(data: BrokerAgentDigestData): string {
  const lines: string[] = [
    `Broker SMS agent activity, ${fmtDateTime(data.windowStartIso)} through ${fmtDateTime(data.generatedAtIso)}.`,
    '',
  ]
  for (const group of data.groups) {
    lines.push(brokerLabel(group.brokerSlug))
    lines.push(`  Actions initiated (${group.actions.length}):`)
    for (const a of group.actions) {
      lines.push(`    - ${a.topic || a.actionType} - ${a.actionType} - status: ${a.status} (target: ${a.target})`)
    }
    lines.push(`  Self-approved publishes (${group.selfApproved.length}):`)
    for (const a of group.selfApproved) {
      lines.push(`    - ${a.topic || a.actionType} - approved by ${a.approvedBy} at ${fmtDateTime(a.approvedAt ?? '')}`)
    }
    lines.push(`  Law Q&A (${group.lawQa.length}):`)
    for (const q of group.lawQa) {
      const cites = q.citations.length ? q.citations.map((c) => `${c.figure} (${c.source})`).join('; ') : 'none recorded'
      lines.push(`    - Q: ${q.question}`)
      lines.push(`      A: ${q.answer}`)
      lines.push(`      Citations: ${cites}`)
    }
    lines.push(`  Spend: ${fmtCost(group.costUsd)}`)
    lines.push('')
  }
  lines.push(`Total spend: ${fmtCost(data.totalCostUsd)}`)
  return lines.join('\n')
}

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === 'true'
  const sinceHoursParam = url.searchParams.get('sinceHours')
  const sinceHoursNum = sinceHoursParam ? Number(sinceHoursParam) : NaN
  const sinceHours = Number.isFinite(sinceHoursNum) && sinceHoursNum > 0 ? sinceHoursNum : undefined

  let data: BrokerAgentDigestData
  try {
    data = await getBrokerAgentDigest({ sinceHours })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('broker-agent-digest:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  if (dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, ...data })
  }

  if (!data.hasActivity) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      windowStartIso: data.windowStartIso,
      generatedAtIso: data.generatedAtIso,
    })
  }

  const matt = CRM_MAILBOXES.find((m) => m.slug === 'matt') ?? CRM_MAILBOXES[0]

  const result = await sendCrmEmail({
    fromMailbox: matt.email,
    to: matt.email,
    subject: SUBJECT,
    bodyText: renderDigestText(data),
    bodyHtml: renderDigestHtml(data),
  })

  if (!result.ok) {
    console.error('broker-agent-digest: send failed', result.error)
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    windowStartIso: data.windowStartIso,
    generatedAtIso: data.generatedAtIso,
    groups: data.groups.map((g) => ({
      brokerSlug: g.brokerSlug,
      actions: g.actions.length,
      selfApproved: g.selfApproved.length,
      lawQa: g.lawQa.length,
      costUsd: g.costUsd,
    })),
    totalCostUsd: data.totalCostUsd,
  })
}

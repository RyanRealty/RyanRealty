/**
 * Smart follow-ups (Matt directive 2026-06-09) — the daily engine that finds
 * leads going quiet and DRAFTS the next touch in Matt's voice.
 *
 * For each broker's working leads with no outbound touch inside the tier
 * window (hot 2d / warm 5d / other 14d) and signs of life (recent activity or
 * recently created): build a context pack from the unified timeline, ask
 * Claude for a short personal follow-up, brand-voice-scan it, and stage it as
 * a note + review task on the contact. Each broker gets one digest email with
 * every draft. NOTHING auto-sends to clients — brokers send with one tap from
 * the composer (per the locked comms model: Matt sends client comms himself).
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CRM_MAILBOXES, sendCrmEmail } from '@/lib/crm/gmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const CAP_PER_BROKER = Number(process.env.CRM_SMART_FOLLOWUP_CAP ?? '8')
const WORKING_STAGES = ['Lead', 'Seller Prospect', 'A - Hot 1-3 Months', 'B - Warm 3-6 Months', 'Active Client']

// brand-voice hard fails (subset of voice_guidelines §6.2 — em/en dash, semicolon, worst words)
const HARD_FAIL = /[—–;]|\b(stunning|breathtaking|gorgeous|charming|pristine|nestled|boasts|must-see|dream home|meticulously|truly|luxurious|immaculate|captivating|exquisite|delve|tapestry|robust|seamless|elevate|unlock|vibrant|bustling|curated|bespoke|don't miss out|act fast|won't last)\b/i

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) return !isProd
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

function tierOf(tags: string[]): 'hot' | 'warm' | 'other' {
  if (tags.some((t) => /:(hot)$/.test(t))) return 'hot'
  if (tags.some((t) => /:(warm)$/.test(t))) return 'warm'
  return 'other'
}
const QUIET_DAYS = { hot: 2, warm: 5, other: 14 } as const

type Draft = { personId: number; name: string; broker: string; channel: string; subject: string | null; body: string; why: string }

async function draftFollowUp(context: string): Promise<{ channel: 'email' | 'sms'; subject: string | null; body: string; why: string } | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  if (!key) return null
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: [
        'You draft short follow-up messages for Matt Ryan, principal broker at Ryan Realty in Bend, Oregon.',
        'Voice: direct, specific, kind, honest. Plain English. Short sentences. Two clauses max per sentence.',
        'HARD RULES: no em dashes, no semicolons, no exclamation marks. Banned words: stunning, gorgeous, charming, nestled, boasts, dream home, truly, luxurious, delve, seamless, elevate, vibrant, curated, act fast, anything salesy.',
        'Never invent market numbers, prices, or facts not present in the context. Reference what the lead actually did or asked.',
        'Favorite phrases: "I am always here if you need anything down the road", "a small business like ours", "no pressure at all".',
        'Output STRICT JSON only: {"channel":"email"|"sms","subject":string|null,"body":string,"why":string}. channel sms only when the context shows texting history. body under 120 words for email, under 280 chars for sms. why = one sentence on the trigger.',
      ].join(' '),
      messages: [{ role: 'user', content: context }],
    }),
  })
  if (!res.ok) {
    console.warn('[smart-followups] claude error', res.status, (await res.text()).slice(0, 200))
    return null
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  const text = data.content?.find((c) => c.type === 'text')?.text ?? ''
  try {
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
    if (!parsed.body) return null
    return parsed
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const startMs = Date.now()
  const sb = createServiceClient()

  // working set with signs of life
  const { data: candidates, error } = await sb
    .from('crm_people')
    .select('id,name,first_name,tags,stage,assigned_broker,custom,last_activity_at,fub_created_at,emails,phones')
    .in('stage', WORKING_STAGES)
    .or(`last_activity_at.gte.${new Date(Date.now() - 60 * 86400e3).toISOString()},fub_created_at.gte.${new Date(Date.now() - 14 * 86400e3).toISOString()}`)
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .limit(400)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const drafts: Draft[] = []
  const perBroker: Record<string, number> = {}
  const skips: Record<string, number> = {}
  const skip = (reason: string) => { skips[reason] = (skips[reason] ?? 0) + 1 }

  for (const p of candidates ?? []) {
    const broker = (p.assigned_broker as string) ?? 'matt'
    if ((perBroker[broker] ?? 0) >= CAP_PER_BROKER) { skip('broker-cap'); continue }
    const tags = (p.tags as string[]) ?? []
    if (tags.includes('compliance:hard-stop')) { skip('hard-stop'); continue }

    const quietDays = QUIET_DAYS[tierOf(tags)]
    const since = new Date(Date.now() - quietDays * 86400e3).toISOString()

    // any outbound touch (or staged draft) inside the window → skip
    const { count: recentOutbound } = await sb
      .from('crm_timeline')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', p.id)
      .in('kind', ['email_out', 'sms_out', 'note', 'call'])
      .gte('ts', since)
    if ((recentOutbound ?? 0) > 0) { skip('recent-outbound'); continue }

    // hard-stop / all-channel suppression
    const { count: suppressed } = await sb
      .from('crm_suppressions')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', p.id)
      .eq('channel', 'all')
    if ((suppressed ?? 0) > 0) { skip('suppressed'); continue }

    // context pack
    const { data: timeline } = await sb
      .from('crm_timeline')
      .select('ts,kind,title,body')
      .eq('person_id', p.id)
      .order('ts', { ascending: false })
      .limit(12)
    const custom = (p.custom ?? {}) as Record<string, unknown>
    const context = [
      `Lead: ${p.name ?? 'unknown'} | stage ${p.stage} | tags: ${tags.join(', ') || 'none'}`,
      custom.customSellerPropertyAddress ? `Property: ${custom.customSellerPropertyAddress}` : '',
      custom.customMoveTimeline ? `Stated timeline: ${custom.customMoveTimeline}` : '',
      `Days since last outbound touch: at least ${quietDays}`,
      'Recent activity (newest first):',
      ...(timeline ?? []).map((t) => `- [${String(t.ts).slice(0, 10)}] ${t.kind}: ${(t.title ?? '').slice(0, 80)} ${(t.body ?? '').replace(/\s+/g, ' ').slice(0, 200)}`),
      'Draft the next follow-up from Matt.',
    ].filter(Boolean).join('\n')

    const draft = await draftFollowUp(context)
    if (!draft) { skip('draft-failed'); continue }
    if (HARD_FAIL.test(`${draft.subject ?? ''} ${draft.body}`)) {
      console.warn('[smart-followups] draft failed brand-voice scan, skipping person', p.id)
      skip('brand-voice-fail')
      continue
    }

    await sb.from('crm_timeline').insert({
      person_id: p.id,
      kind: 'note',
      title: `Suggested follow-up (AI draft, ${draft.channel})`,
      body: `${draft.subject ? `Subject: ${draft.subject}\n\n` : ''}${draft.body}\n\nWhy now: ${draft.why}`,
      broker,
      source: 'smart-followup',
    })
    await sb.from('crm_tasks').insert({
      person_id: p.id,
      name: `Send follow-up to ${p.first_name ?? p.name ?? 'lead'} (draft ready on timeline)`,
      type: draft.channel === 'sms' ? 'Text' : 'Email',
      due_at: new Date(Date.now() + 6 * 3600e3).toISOString(),
      assigned_broker: broker,
      origin: 'smart-followup',
    })
    drafts.push({ personId: p.id, name: p.name ?? `#${p.id}`, broker, channel: draft.channel, subject: draft.subject ?? null, body: draft.body, why: draft.why })
    perBroker[broker] = (perBroker[broker] ?? 0) + 1
  }

  // per-broker digest
  for (const [broker, count] of Object.entries(perBroker)) {
    if (!count) continue
    const mailbox = CRM_MAILBOXES.find((m) => m.slug === broker) ?? CRM_MAILBOXES[0]
    const lines = drafts
      .filter((d) => d.broker === broker)
      .map((d) => `• ${d.name} (${d.channel})${d.subject ? ` — ${d.subject}` : ''}\n  ${d.body.slice(0, 220)}\n  Why: ${d.why}\n  https://ryan-realty.com/admin/crm/${d.personId}`)
    void sendCrmEmail({
      fromMailbox: mailbox.email,
      to: mailbox.email,
      subject: `${count} smart follow-up${count === 1 ? '' : 's'} ready to send`,
      bodyText: `Drafts are staged on each contact's timeline. Open the contact, review, and send from the composer.\n\n${lines.join('\n\n')}`,
    })
  }

  return NextResponse.json({
    ok: true,
    scanned: (candidates ?? []).length,
    drafted: drafts.length,
    perBroker,
    skips,
    duration_ms: Date.now() - startMs,
  })
}

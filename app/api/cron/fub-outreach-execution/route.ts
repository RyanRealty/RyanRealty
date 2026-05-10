import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { addPersonNote, updatePersonAutomationState } from '@/lib/followupboss'

export const runtime = 'nodejs'

type FubSnapshotRow = {
  fub_id: string
  broker_id: string | null
  stage: string | null
  tags: unknown
  name: string | null
  email: string | null
  source: string | null
}

type OutreachPlan = {
  triggerTag: string
  targetStage: string
  sms: string
  emailSubject: string
  emailBody: string
  reason: string
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return createClient(url, key)
}

function isLikelyRealtor(row: Pick<FubSnapshotRow, 'tags' | 'name' | 'email'>): boolean {
  const tags = Array.isArray(row.tags) ? row.tags.map((value) => String(value).toLowerCase()) : []
  const tagHit = tags.some((tag) =>
    ['realtor', 'real estate agent', 'agent', 'broker', 'lender', 'loan officer', 'title rep', 'escrow'].some((keyword) =>
      tag.includes(keyword)
    )
  )
  if (tagHit) return true

  const name = (row.name ?? '').toLowerCase()
  if (/\b(realtor|agent|broker)\b/.test(name)) return true

  const email = (row.email ?? '').toLowerCase()
  return /\b(realty|properties|brokerage|kw\.com|remax|coldwellbanker|sothebys|exprealty)\b/.test(email)
}

function chooseOutreachPlan(stage: string): OutreachPlan {
  const normalized = stage.trim().toLowerCase()

  if (normalized === 'new lead' || normalized === 'lead' || normalized === 'unstaged') {
    return {
      triggerTag: 'auto:seller-seq:new',
      targetStage: 'Attempting Contact',
      reason: 'Fast response for fresh inbound interest.',
      sms: 'Hi {firstName}, this is Matt at Ryan Realty. Thanks for reaching out. If selling is on your mind this year, I can send a simple price and timing snapshot for your home. Want me to send it?',
      emailSubject: 'Quick home value and timing snapshot',
      emailBody:
        'Hi {firstName},\n\nThanks for connecting with Ryan Realty. If a move is on your radar, I can share a clear snapshot of current pricing and timing in Bend so you can decide next steps without pressure.\n\nReply with your address and I will send it over.\n\nMatt Ryan\nRyan Realty',
    }
  }

  if (normalized === 'attempting contact') {
    return {
      triggerTag: 'auto:seller-seq:attempt',
      targetStage: 'Attempting Contact',
      reason: 'Continue calm follow-up without pressure.',
      sms: 'Hi {firstName}, quick check in from Matt at Ryan Realty. If now is not the right time, no problem. If you want current pricing for your home, I can send a short snapshot.',
      emailSubject: 'Open when timing is right',
      emailBody:
        'Hi {firstName},\n\nJust a quick note so you have this when timing is right. If you want a plain-English estimate of current value and selling conditions in Bend, I can send it with no obligation.\n\nIf you prefer no follow-up, just reply and I will close this out.\n\nMatt Ryan\nRyan Realty',
    }
  }

  if (normalized === 'connected' || normalized === 'seller nurture') {
    return {
      triggerTag: 'auto:seller-seq:nurture',
      targetStage: 'Seller Nurture',
      reason: 'Nurture with value updates and clear next step.',
      sms: 'Hi {firstName}, Matt here. I just updated local seller numbers for Bend. If you want, I can send a quick update with where your home likely sits in today’s market.',
      emailSubject: 'Updated Bend seller snapshot',
      emailBody:
        'Hi {firstName},\n\nI updated this week’s Bend seller trends. If helpful, I can send a short snapshot showing likely pricing range and market pace for homes like yours.\n\nIf you want that, reply with your address and best timing.\n\nMatt Ryan\nRyan Realty',
    }
  }

  return {
    triggerTag: 'auto:seller-seq:watch',
    targetStage: stage || 'Seller Nurture',
    reason: 'No aggressive automation for this stage.',
    sms: 'Hi {firstName}, Matt here. If selling becomes a priority, I can help with a clear plan and current pricing snapshot.',
    emailSubject: 'Here when you need a clear plan',
    emailBody:
      'Hi {firstName},\n\nIf and when selling becomes a priority, I can provide a clear plan built around your timeline and current Bend market conditions.\n\nMatt Ryan\nRyan Realty',
  }
}

function renderTemplate(template: string, firstName: string): string {
  const safeFirstName = firstName.trim() || 'there'
  return template.replaceAll('{firstName}', safeFirstName)
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const applyExecution = ['1', 'true', 'yes', 'on'].includes(
    (process.env.FOLLOWUPBOSS_EXECUTION_ENABLED ?? '').trim().toLowerCase()
  )

  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: mattBrokerRow } = await supabase
    .from('brokers')
    .select('id, slug, display_name, email')
    .or('slug.eq.matt-ryan,display_name.ilike.%matt%ryan%,email.ilike.%matt%')
    .limit(1)
    .maybeSingle()

  const mattBroker = (mattBrokerRow ?? null) as { id: string } | null
  const mattBrokerId = mattBroker?.id ?? null
  const { data: fubRows, error: fubRowsError } = await supabase
    .from('fub_contacts_cache')
    .select('fub_id, broker_id, stage, tags, name, email, source, synced_at')
    .gte('synced_at', weekAgoIso)
    .limit(5000)

  if (fubRowsError) {
    return NextResponse.json({ error: fubRowsError.message }, { status: 500 })
  }

  const rows = ((fubRows ?? []) as FubSnapshotRow[])
  const myLeads = mattBrokerId ? rows.filter((row) => row.broker_id === mattBrokerId) : rows
  const targetable = myLeads.filter((row) => !isLikelyRealtor(row))

  const executionItems: Array<{
    fubId: number
    stage: string
    triggerTag: string
    targetStage: string
    sms: string
    emailSubject: string
    emailBody: string
    applied: boolean
  }> = []

  for (const row of targetable.slice(0, 150)) {
    const fubId = Number(row.fub_id)
    if (!Number.isFinite(fubId) || fubId <= 0) continue

    const stage = (row.stage ?? 'Unstaged').trim()
    if (['Listing Signed', 'Closed', 'Disqualified', 'Do Not Contact', 'Archive'].includes(stage)) {
      continue
    }

    const plan = chooseOutreachPlan(stage)
    const firstName = (row.name ?? '').trim().split(/\s+/)[0] || 'there'
    const sms = renderTemplate(plan.sms, firstName)
    const emailSubject = renderTemplate(plan.emailSubject, firstName)
    const emailBody = renderTemplate(plan.emailBody, firstName)

    let applied = false
    if (applyExecution) {
      const stateApplied = await updatePersonAutomationState({
        personId: fubId,
        stage: plan.targetStage,
        tags: [plan.triggerTag, 'auto:brand-voice:plain-honest', 'segment:my-leads'],
      })
      const noteApplied = await addPersonNote(
        fubId,
        [
          'Automated outreach packet generated.',
          `Reason: ${plan.reason}`,
          `Suggested SMS: ${sms}`,
          `Suggested Email Subject: ${emailSubject}`,
          `Suggested Email Body: ${emailBody}`,
        ].join('\n')
      )
      applied = stateApplied || noteApplied
    }

    executionItems.push({
      fubId,
      stage,
      triggerTag: plan.triggerTag,
      targetStage: plan.targetStage,
      sms,
      emailSubject,
      emailBody,
      applied,
    })
  }

  const summary = [
    `FUB outreach execution run for Matt Ryan leads.`,
    `My Leads considered: ${myLeads.length}.`,
    `Targetable after realtor exclusion: ${targetable.length}.`,
    `Execution mode: ${applyExecution ? 'APPLY' : 'DRY_RUN'}.`,
    `Outreach packets generated: ${executionItems.length}.`,
  ].join(' ')

  const { data: insertedInsight, error: insightError } = await supabase
    .from('agent_insights')
    .insert({
      insight_type: 'fub_outreach_execution_weekly',
      title: `FUB Outreach Execution Packet ${new Date().toISOString().slice(0, 10)}`,
      description: summary,
      priority: 'high',
      status: 'pending',
      data: {
        execution_mode: applyExecution ? 'apply' : 'dry_run',
        matt_broker_id: mattBrokerId,
        my_leads_count: myLeads.length,
        targetable_count: targetable.length,
        execution_items: executionItems,
        voice_rules: [
          'honest',
          'trustworthy',
          'plain language',
          'no pandering',
          'no editorializing',
          'respect time',
          'service quality implied, not claimed',
        ],
      },
    })
    .select('id')
    .single()

  if (insightError) {
    console.error('[fub-outreach-execution] Failed to write insight:', insightError)
    return NextResponse.json(
      {
        ok: false,
        error: insightError.message,
        execution_mode: applyExecution ? 'apply' : 'dry_run',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    insight_id: insertedInsight.id,
    execution_mode: applyExecution ? 'apply' : 'dry_run',
    my_leads_count: myLeads.length,
    targetable_count: targetable.length,
    generated_outreach: executionItems.length,
    applied_count: executionItems.filter((item) => item.applied).length,
  })
}


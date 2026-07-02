#!/usr/bin/env node
/**
 * Wire Twilio Conversations so GROUP texts reach the CRM. Idempotent — safe to
 * re-run any time. Two pieces (both verified against Twilio docs 2026-07-02):
 *
 * 1. GLOBAL SERVICE WEBHOOK (Configuration/Webhooks): post-event
 *    onMessageAdded → /api/twilio/conversations-events. Fires for every
 *    conversation in the default service — CRM-created group threads AND
 *    autocreated ones. Without it, replies inside any group thread are
 *    recorded nowhere.
 *
 * 2. ADDRESS AUTOCREATION (Configuration/Addresses) for every broker Twilio
 *    line + the marketing line. Programmable Messaging does NOT support group
 *    MMS: an inbound group text to a line without Conversations autocreation
 *    is silently dropped (no webhook, no message log). With autocreation, a
 *    phone-era group text (e.g. a client group thread that predates the
 *    number port) autocreates a Conversation and our webhook records it.
 *    1:1 inbound is unaffected: the per-number inbound-sms webhook always
 *    fires regardless of Conversations, and the conversations-events route
 *    skips non-group conversations to avoid double-recording.
 *
 * Usage: node scripts/setup-conversations-webhooks.mjs
 * Env:   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 *        NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (broker lines)
 */

import { readFileSync, existsSync } from 'node:fs'

// Minimal .env.local loader (no dotenv dep in scripts).
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

const SID = process.env.TWILIO_ACCOUNT_SID
const TOKEN = process.env.TWILIO_AUTH_TOKEN
const WEBHOOK_URL = 'https://ryan-realty.com/api/twilio/conversations-events'
const MARKETING = (process.env.TWILIO_NUMBER_MARKETING || '+15412245025').trim()
if (!SID || !TOKEN) { console.error('Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN'); process.exit(1) }

const auth = 'Basic ' + Buffer.from(`${SID}:${TOKEN}`).toString('base64')
const form = (o) => new URLSearchParams(o)

async function twilio(path, init = {}) {
  const res = await fetch(`https://conversations.twilio.com/v1${path}`, {
    ...init,
    headers: { Authorization: auth, ...(init.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function brokerLines() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const lines = new Set([MARKETING])
  if (url && key) {
    const res = await fetch(`${url}/rest/v1/brokers?select=slug,twilio_number`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (res.ok) for (const b of await res.json()) if (b.twilio_number) lines.add(b.twilio_number.trim())
  }
  for (const k of ['TWILIO_NUMBER_MATT', 'TWILIO_NUMBER_PAUL', 'TWILIO_NUMBER_REBECCA']) {
    if (process.env[k]) lines.add(process.env[k].trim())
  }
  return [...lines].filter(Boolean)
}

// 1. Global post-event webhook (idempotent overwrite).
{
  const { status, json } = await twilio('/Configuration/Webhooks', {
    method: 'POST',
    body: form({
      Target: 'webhook',
      Method: 'POST',
      'PostWebhookUrl': WEBHOOK_URL,
      'Filters': 'onMessageAdded',
    }),
  })
  console.log(`[global webhook] ${status} post_webhook_url=${json.post_webhook_url} filters=${JSON.stringify(json.filters)}`)
}

// 2. Address autocreation per line (create; on 409/conflict, update).
const lines = await brokerLines()
for (const address of lines) {
  const body = form({
    Type: 'sms',
    Address: address,
    FriendlyName: `CRM autocreation ${address}`,
    'AutoCreation.Enabled': 'true',
    'AutoCreation.Type': 'default',
  })
  let { status, json } = await twilio('/Configuration/Addresses', { method: 'POST', body })
  if (status === 409 || json.code === 50355 || /already exists/i.test(json.message ?? '')) {
    // Find the existing config sid, then update it.
    const list = await twilio(`/Configuration/Addresses?PageSize=100`)
    const existing = (list.json.address_configurations ?? []).find((c) => c.address === address)
    if (existing) {
      ;({ status, json } = await twilio(`/Configuration/Addresses/${existing.sid}`, {
        method: 'POST',
        body: form({ 'AutoCreation.Enabled': 'true', 'AutoCreation.Type': 'default' }),
      }))
    }
  }
  console.log(`[autocreation] ${address} → ${status} enabled=${json?.auto_creation?.enabled}`)
}
console.log('Done.')

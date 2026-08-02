/**
 * scripts/_smoke-broker-agent.ts — real end-to-end smoke for the broker SMS agent.
 *
 * Drives the exact production path in-process (the HTTP/signature layer above it
 * is covered by unit tests + ci:broker-agent-send-safety): handleAgentInbound →
 * 20s debounce → runAgentTurn (Claude Opus 5 + live DAL) → sendAgentSms
 * (whitelisted; marketing line → the broker's cell). Real DB, real model, real SMS.
 *
 * Usage: npx tsx scripts/_smoke-broker-agent.ts [broker-env-suffix] ["question"]
 *   default broker MATT, default question about the Redmond market.
 * Requires .env.local (dotenv loaded below). Sends ONE real text to the broker's
 * own cell — the pilot demo, not a client send.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const { handleAgentInbound, processAfterDebounce } = await import('@/lib/agent/ingress')
  const who = (process.argv[2] ?? 'MATT').toUpperCase()
  const from = process.env[`TWILIO_FORWARD_${who}`]
  const to = process.env.TWILIO_NUMBER_MARKETING ?? '+15412245025'
  if (!from) throw new Error(`TWILIO_FORWARD_${who} not set`)
  const body = process.argv[3] ?? "What's the Redmond market looking like right now?"
  const messageSid = `SMe2e${Date.now()}`

  console.log('[smoke] inbound →', { to, messageSid, body })
  const res = await handleAgentInbound({ from, to, body, messageSid, mediaUrls: [] })
  console.log('[smoke] ingress result:', JSON.stringify(res))
  if (res.status !== 'queued') throw new Error(`expected status 'queued', got '${res.status}'`)

  const t0 = Date.now()
  await processAfterDebounce(res.sessionId, res.messageSid, res.ctx)
  console.log('[smoke] turn complete in', ((Date.now() - t0) / 1000).toFixed(1), 's — check the broker phone for the reply')
}

main().then(
  () => { console.log('[smoke] OK'); process.exit(0) },
  (err) => { console.error('[smoke] FAILED:', err); process.exit(1) },
)

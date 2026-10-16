/**
 * xAI SIP voice session (Grok Voice 3.0). The only place that opens the realtime
 * WebSocket for SIP calls, per the lib/grok chokepoint.
 */
import WebSocket from 'ws'
import {
  LET_ME_CHECK_EN,
  LOOKUP_PUBLIC_RECORDS_TOOL,
  runLookupPublicRecords,
  type PublicRecordsDeps,
} from '@/lib/sarah/public-records'

export type TransferTarget = 'matt' | 'rebecca' | 'paul'
export type SipSessionConfig = {
  instructions: string
  greeting: string
  voice?: string
  /** Resolve a transfer target to an E.164 number; null disables that target. */
  resolveTransfer?: (who: TransferTarget) => string | null
  /**
   * Optional conference / barge transfer. When this returns true, skip SIP REFER.
   * referSipCall stays the fallback so an unanswered conference add can still REFER.
   */
  onTransfer?: (who: TransferTarget, reason: string) => Promise<boolean>
  /** Caller transcript hook (recording objection, urgent escalate). */
  onCallerTurn?: (text: string) => Promise<{ mode: string; reply?: string | null } | void>
  /** take_message tool handler; returns whether the message was delivered. */
  onMessage?: (m: { who: TransferTarget; caller_name: string; callback_number: string; message: string }) => Promise<boolean>
  onEnd?: (lines: TranscriptLine[]) => Promise<void>
  /** Desk broker first name for the public-records closer. Matt when omitted. */
  brokerFirstName?: string
}
export type TranscriptLine = { speaker: 'caller' | 'agent'; text: string }

export const SIP_PUBLIC_RECORDS_FILLER = LET_ME_CHECK_EN
export { LOOKUP_PUBLIC_RECORDS_TOOL }

/** Drop empty lines and consecutive repeats (xAI can emit the same final line twice). */
export function cleanTranscript(lines: TranscriptLine[]): TranscriptLine[] {
  const out: TranscriptLine[] = []
  for (const l of lines) {
    const text = l.text.replace(/\s+/g, ' ').trim()
    if (!text) continue
    const prev = out[out.length - 1]
    if (prev && prev.speaker === l.speaker && (prev.text === text || text.startsWith(prev.text))) { prev.text = text; continue }
    if (prev && prev.speaker === l.speaker && prev.text.startsWith(text)) continue
    out.push({ speaker: l.speaker, text })
  }
  return out
}

const TRANSFER_TOOL = {
  type: 'function',
  name: 'transfer_call',
  description: 'Transfer the live call to Matt (emergency or caller needs Matt now), or to agent Rebecca or Paul when asked by name.',
  parameters: {
    type: 'object',
    properties: {
      who: { type: 'string', enum: ['matt', 'rebecca', 'paul'] },
      reason: { type: 'string' },
    },
    required: ['who'],
  },
}

const MESSAGE_TOOL = {
  type: 'function',
  name: 'take_message',
  description: 'Deliver a message from the caller to Matt, Rebecca, or Paul by text.',
  parameters: {
    type: 'object',
    properties: {
      who: { type: 'string', enum: ['matt', 'rebecca', 'paul'] },
      caller_name: { type: 'string' },
      callback_number: { type: 'string' },
      message: { type: 'string' },
    },
    required: ['who', 'caller_name', 'callback_number', 'message'],
  },
}

export type SipTool = { type: string; name: string }

/** Tools registered on the xAI phone session. Public records is always on. */
export function sipSessionTools(
  cfg: Pick<SipSessionConfig, 'resolveTransfer' | 'onMessage'>,
): SipTool[] {
  const tools: SipTool[] = []
  if (cfg.resolveTransfer) tools.push(TRANSFER_TOOL)
  if (cfg.onMessage) tools.push(MESSAGE_TOOL)
  tools.push(LOOKUP_PUBLIC_RECORDS_TOOL)
  return tools
}

export function parseSipToolArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}') as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

/** Spoken public-records answer for the phone tool. No URLs. Does not transfer. */
export async function handleSipPublicRecordsCall(
  argsRaw: string,
  opts?: { brokerFirstName?: string; deps?: PublicRecordsDeps },
): Promise<string> {
  const a = parseSipToolArgs(argsRaw)
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() ? Number(v) : null
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  return runLookupPublicRecords({
    question: str(a.question) ?? '',
    streetNumber: str(a.streetNumber) ?? null,
    streetName: str(a.streetName) ?? null,
    city: str(a.city) ?? null,
    county: str(a.county) ?? null,
    parcelNumber: str(a.parcelNumber) ?? null,
    latitude: num(a.latitude),
    longitude: num(a.longitude),
    brokerFirstName: opts?.brokerFirstName,
  }, opts?.deps)
}

/** SIP REFER the xAI call to a PSTN number. Resolves true only if the destination answered (200). */
export async function referSipCall(callId: string, e164: string): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(`https://api.x.ai/v1/realtime/calls/${encodeURIComponent(callId)}/refer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.XAI_API_KEY ?? ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_uri: `tel:${e164}` }),
    })
    return { ok: res.ok, status: res.status }
  } catch {
    return { ok: false, status: 0 }
  }
}

export function runSipCall(callId: string, from: string, cfg: SipSessionConfig): Promise<void> {
  return new Promise((resolve) => {
    const log = (m: string) => console.log(`[xai-sip] call=${callId} ${m}`)
    const ws = new WebSocket(`wss://api.x.ai/v1/realtime?call_id=${encodeURIComponent(callId)}`, {
      headers: { Authorization: `Bearer ${process.env.XAI_API_KEY ?? ''}` },
    })
    const lines: TranscriptLine[] = []
    const done = async () => {
      try { await cfg.onEnd?.(cleanTranscript(lines)) } catch (err) { log(`onEnd failed ${(err as Error).message}`) }
      resolve()
    }
    const timer = setTimeout(() => { log('max duration reached'); ws.close() }, 780_000)
    ws.on('open', () => {
      log(`joined from=${from}`)
      ws.send(JSON.stringify({
        type: 'session.update',
        session: {
          voice: cfg.voice ?? 'eve',
          instructions: cfg.instructions,
          turn_detection: { type: 'server_vad' },
          audio: { input: { transcription: { model: 'grok-transcribe' } } },
          tools: sipSessionTools(cfg),
        },
      }))
      ws.send(JSON.stringify({
        type: 'response.create',
        response: { instructions: `Greet the caller with exactly: "${cfg.greeting}"` },
      }))
    })
    const handleTransfer = async (fnCallId: string, argsRaw: string) => {
      let who: TransferTarget = 'matt'
      let reason = ''
      try {
        const a = JSON.parse(argsRaw || '{}') as { who?: string; reason?: string }
        if (a.who === 'rebecca' || a.who === 'paul') who = a.who
        reason = String(a.reason ?? '')
      } catch { /* default matt */ }
      if (cfg.onTransfer) {
        const bridged = await cfg.onTransfer(who, reason).catch(() => false)
        log(`conference transfer who=${who} ok=${bridged}`)
        if (bridged) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'conversation.item.create',
              item: { type: 'function_call_output', call_id: fnCallId, output: JSON.stringify({ ok: true, note: 'Connected in conference.' }) },
            }))
          }
          return
        }
      }
      const target = cfg.resolveTransfer?.(who) ?? null
      log(`transfer requested who=${who} target=${target ?? 'none'}`)
      const r = target ? await referSipCall(callId, target) : { ok: false, status: 0 }
      log(`transfer result ok=${r.ok} status=${r.status}`)
      if (r.ok || ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: fnCallId, output: JSON.stringify({ ok: false, note: 'No answer. Take a message.' }) },
      }))
      ws.send(JSON.stringify({ type: 'response.create' }))
    }
    const handlePublicRecords = async (fnCallId: string, argsRaw: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'response.create',
          response: { instructions: `Say exactly: "${SIP_PUBLIC_RECORDS_FILLER}" Then wait.` },
        }))
      }
      const spoken = await handleSipPublicRecordsCall(argsRaw, { brokerFirstName: cfg.brokerFirstName }).catch(
        () => 'I did not find that in the public records I can read. Want me to connect you with Matt?',
      )
      log(`public records filler=${SIP_PUBLIC_RECORDS_FILLER}`)
      if (ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: fnCallId, output: spoken },
      }))
      ws.send(JSON.stringify({
        type: 'response.create',
        response: { instructions: 'Say the tool result exactly. Do not add a URL or a second caveat.' },
      }))
    }
    const handleMessage = async (fnCallId: string, argsRaw: string) => {
      let a: Record<string, string> = {}
      try { a = JSON.parse(argsRaw || '{}') } catch { /* empty */ }
      const who: TransferTarget = a.who === 'rebecca' || a.who === 'paul' ? a.who : 'matt'
      const ok = await (cfg.onMessage?.({ who, caller_name: a.caller_name ?? '', callback_number: a.callback_number ?? '', message: a.message ?? '' }) ?? Promise.resolve(false)).catch(() => false)
      log(`message for=${who} delivered=${ok}`)
      if (ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: fnCallId, output: JSON.stringify({ delivered: ok }) } }))
      ws.send(JSON.stringify({ type: 'response.create' }))
    }
    ws.on('message', (raw) => {
      let e: { type?: string; transcript?: string; error?: unknown; name?: string; call_id?: string; arguments?: string }
      try { e = JSON.parse(raw.toString()) } catch { return }
      if (!e.type) return
      if (e.type === 'response.function_call_arguments.done' && e.name === 'transfer_call') {
        void handleTransfer(e.call_id ?? '', e.arguments ?? '{}')
        return
      }
      if (e.type === 'response.function_call_arguments.done' && e.name === 'take_message') {
        void handleMessage(e.call_id ?? '', e.arguments ?? '{}')
        return
      }
      if (e.type === 'response.function_call_arguments.done' && e.name === 'lookup_public_records') {
        void handlePublicRecords(e.call_id ?? '', e.arguments ?? '{}')
        return
      }
      if (e.type === 'error') log(`error ${JSON.stringify(e.error ?? e)}`)
      else if (/input_audio_transcription\.completed$/.test(e.type)) {
        const text = e.transcript ?? ''
        log(`CALLER: ${text}`)
        lines.push({ speaker: 'caller', text })
        if (cfg.onCallerTurn && text.trim()) {
          void cfg.onCallerTurn(text).then((turn) => {
            if (!turn || ws.readyState !== WebSocket.OPEN) return
            if (turn.mode === 'stop-recording') {
              log('recording objection — ending AI session')
              if (turn.reply) {
                ws.send(JSON.stringify({
                  type: 'response.create',
                  response: { instructions: `Say exactly: "${turn.reply}" Then stop.` },
                }))
              }
              setTimeout(() => { try { ws.close() } catch { /* already closed */ } }, 8000)
              return
            }
            if (turn.mode === 'escalate') {
              void handleTransfer('urgent', JSON.stringify({ who: 'matt', reason: 'urgent' }))
            }
          }).catch((err) => log(`onCallerTurn failed ${(err as Error).message}`))
        }
      }
      else if (/output_audio_transcript\.done$|audio_transcript\.done$/.test(e.type)) { log(`AGENT: ${e.transcript ?? ''}`); lines.push({ speaker: 'agent', text: e.transcript ?? '' }) }
    })
    ws.on('error', (err) => log(`ws error ${err.message}`))
    ws.on('close', (code) => { clearTimeout(timer); log(`ended code=${code}`); void done() })
  })
}


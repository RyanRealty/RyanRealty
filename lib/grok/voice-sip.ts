/**
 * xAI SIP voice session (Grok Voice 3.0). The only place that opens the realtime
 * WebSocket for SIP calls, per the lib/grok chokepoint.
 */
import WebSocket from 'ws'

export type TransferTarget = 'matt' | 'rebecca' | 'paul'
export type SipSessionConfig = {
  instructions: string
  greeting: string
  voice?: string
  /** Resolve a transfer target to an E.164 number; null disables that target. */
  resolveTransfer?: (who: TransferTarget) => string | null
  /** Called once when the call ends with the cleaned transcript lines. */
  onEnd?: (lines: TranscriptLine[]) => Promise<void>
}
export type TranscriptLine = { speaker: 'caller' | 'agent'; text: string }

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
          ...(cfg.resolveTransfer ? { tools: [TRANSFER_TOOL] } : {}),
        },
      }))
      ws.send(JSON.stringify({
        type: 'response.create',
        response: { instructions: `Greet the caller with exactly: "${cfg.greeting}"` },
      }))
    })
    const handleTransfer = async (fnCallId: string, argsRaw: string) => {
      let who: TransferTarget = 'matt'
      try { const a = JSON.parse(argsRaw || '{}'); if (a.who === 'rebecca' || a.who === 'paul') who = a.who } catch { /* default matt */ }
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
    ws.on('message', (raw) => {
      let e: { type?: string; transcript?: string; error?: unknown; name?: string; call_id?: string; arguments?: string }
      try { e = JSON.parse(raw.toString()) } catch { return }
      if (!e.type) return
      if (e.type === 'response.function_call_arguments.done' && e.name === 'transfer_call') {
        void handleTransfer(e.call_id ?? '', e.arguments ?? '{}')
        return
      }
      if (e.type === 'error') log(`error ${JSON.stringify(e.error ?? e)}`)
      else if (/input_audio_transcription\.completed$/.test(e.type)) { log(`CALLER: ${e.transcript ?? ''}`); lines.push({ speaker: 'caller', text: e.transcript ?? '' }) }
      else if (/output_audio_transcript\.done$|audio_transcript\.done$/.test(e.type)) { log(`AGENT: ${e.transcript ?? ''}`); lines.push({ speaker: 'agent', text: e.transcript ?? '' }) }
    })
    ws.on('error', (err) => log(`ws error ${err.message}`))
    ws.on('close', (code) => { clearTimeout(timer); log(`ended code=${code}`); void done() })
  })
}


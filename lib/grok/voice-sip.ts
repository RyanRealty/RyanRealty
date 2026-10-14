/**
 * xAI SIP voice session (Grok Voice 3.0). The only place that opens the realtime
 * WebSocket for SIP calls, per the lib/grok chokepoint.
 */
import WebSocket from 'ws'

export type SipSessionConfig = { instructions: string; greeting: string; voice?: string }

export function runSipCall(callId: string, from: string, cfg: SipSessionConfig): Promise<void> {
  return new Promise((resolve) => {
    const log = (m: string) => console.log(`[xai-sip] call=${callId} ${m}`)
    const ws = new WebSocket(`wss://api.x.ai/v1/realtime?call_id=${encodeURIComponent(callId)}`, {
      headers: { Authorization: `Bearer ${process.env.XAI_API_KEY ?? ''}` },
    })
    const done = () => resolve()
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
        },
      }))
      ws.send(JSON.stringify({
        type: 'response.create',
        response: { instructions: `Greet the caller with exactly: "${cfg.greeting}"` },
      }))
    })
    ws.on('message', (raw) => {
      let e: { type?: string; transcript?: string; error?: unknown }
      try { e = JSON.parse(raw.toString()) } catch { return }
      if (!e.type) return
      if (e.type === 'error') log(`error ${JSON.stringify(e.error ?? e)}`)
      else if (/input_audio_transcription\.completed$/.test(e.type)) log(`CALLER: ${e.transcript ?? ''}`)
      else if (/output_audio_transcript\.done$|audio_transcript\.done$/.test(e.type)) log(`AGENT: ${e.transcript ?? ''}`)
    })
    ws.on('error', (err) => log(`ws error ${err.message}`))
    ws.on('close', (code) => { clearTimeout(timer); log(`ended code=${code}`); done() })
  })
}


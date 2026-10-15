import { NextResponse } from 'next/server'

type StageRow = { t: number; stage: string; detail?: Record<string, unknown> }

const RING_MAX = 200
const ring: StageRow[] = []

function clipDetail(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (/secret|token|audio|key|authorization/i.test(key)) continue
    if (typeof item === 'string') out[key] = item.slice(0, 240)
    else if (typeof item === 'number' || typeof item === 'boolean' || item == null) out[key] = item
  }
  return out
}

export async function POST(request: Request) {
  let body: { stage?: unknown; detail?: unknown; t?: unknown }
  try {
    body = (await request.json()) as { stage?: unknown; detail?: unknown; t?: unknown }
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  if (typeof body.stage !== 'string' || !body.stage.trim()) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const row: StageRow = {
    t: typeof body.t === 'number' ? body.t : Date.now(),
    stage: body.stage.slice(0, 64),
    detail: clipDetail(body.detail),
  }
  ring.push(row)
  if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX)
  console.info('[sarahVoice]', row)
  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({ events: ring.slice(-80) })
}

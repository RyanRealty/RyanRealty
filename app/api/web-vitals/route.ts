/**
 * Real-user Core Web Vitals (RUM) ingest.
 *
 * Receives one metric per call from components/WebVitalsReporter.tsx (sent via
 * navigator.sendBeacon on real page loads) and stores it in public.web_vitals so
 * the scoreboard can show the FIELD p75 — the number Google actually ranks on.
 *
 * Telemetry must NEVER break a page: every failure path returns 204 quietly.
 * Public endpoint by design (anonymous visitors report their own vitals); we
 * validate the metric name + numeric value and ignore anything else.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB', 'FID'])

export async function POST(request: Request) {
  try {
    // sendBeacon delivers a text body; parse defensively.
    const raw = await request.text()
    const data = JSON.parse(raw) as Record<string, unknown>

    const metric = typeof data.name === 'string' ? data.name.toUpperCase() : ''
    const value = typeof data.value === 'number' ? data.value : Number(data.value)
    if (!ALLOWED.has(metric) || !Number.isFinite(value)) {
      return new NextResponse(null, { status: 204 }) // ignore junk silently
    }

    const supabase = createServiceClient()
    await supabase.from('web_vitals').insert({
      metric,
      value,
      rating: typeof data.rating === 'string' ? data.rating : null,
      path: typeof data.path === 'string' ? data.path.slice(0, 512) : null,
      navigation_type: typeof data.navigationType === 'string' ? data.navigationType : null,
      device: typeof data.device === 'string' ? data.device : null,
    })
  } catch {
    // Never surface telemetry failures to the visitor.
  }
  return new NextResponse(null, { status: 204 })
}

/**
 * Real-user Core Web Vitals (RUM) ingest.
 *
 * Receives one metric per call from components/WebVitalsReporter.tsx (sent via
 * navigator.sendBeacon on real page loads) and stores it in public.web_vitals so
 * the scoreboard can show the FIELD p75 — the number Google actually ranks on.
 *
 * Telemetry must NEVER break a page: every failure path returns 204 quietly.
 * Public endpoint by design (anonymous visitors report their own vitals); every
 * sample passes parseWebVitalSample (lib/analytics/web-vitals-sample.ts) first:
 * LCP/INP/CLS/FCP/TTFB only (FID dropped), no negative or > 120 s timings, and
 * no framework/API paths (visibility audit 2026-09-22, TRACK-3).
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { parseWebVitalSample } from '@/lib/analytics/web-vitals-sample'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // sendBeacon delivers a text body; parse defensively.
    const raw = await request.text()
    const data = JSON.parse(raw) as Record<string, unknown>
    const verdict = parseWebVitalSample(data && typeof data === 'object' ? data : {})
    if (!verdict.ok) {
      return new NextResponse(null, { status: 204 }) // ignore junk silently
    }

    const supabase = createServiceClient()
    await supabase.from('web_vitals').insert(verdict.row)
  } catch {
    // Never surface telemetry failures to the visitor.
  }
  return new NextResponse(null, { status: 204 })
}

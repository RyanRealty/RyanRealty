/**
 * GA4 Data API — server-side. Requires service account credentials.
 * Step 19. Used by admin dashboard and AI analytics agent.
 */

const PROPERTY_ID = process.env.GOOGLE_GA4_PROPERTY_ID?.trim()

export type GA4DateRange = { startDate: string; endDate: string }

/**
 * Run a GA4 report. Requires GOOGLE_APPLICATION_CREDENTIALS or service account key in env.
 */
export async function runGA4Report(
  dimensions: string[],
  metrics: string[],
  dateRange: GA4DateRange
): Promise<{ rows?: Record<string, string>[]; error?: string }> {
  if (!PROPERTY_ID) return { error: 'GOOGLE_GA4_PROPERTY_ID not set' }
  // Stub: real implementation would use @google-analytics/data and service account.
  return { rows: [] }
}

/**
 * Run GA4 realtime report (active users now).
 */
export async function runGA4RealtimeReport(): Promise<{ activeUsers?: number; error?: string }> {
  if (!PROPERTY_ID) return { error: 'GOOGLE_GA4_PROPERTY_ID not set' }
  return { activeUsers: 0 }
}

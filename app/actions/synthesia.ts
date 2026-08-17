'use server'

/**
 * Synthesia generate is refused (G32 / R-213). Imagine is the camera.
 * Upload an intro video instead. Cancel the Synthesia subscription (cancel-now).
 */

const REFUSE =
  'Synthesia generate is canceled. Use lib/grok-video.ts (Imagine) or upload a real intro clip. Do not invent a listing.'

export async function checkSynthesiaConfigured(): Promise<{ configured: boolean }> {
  return { configured: false }
}

/** Refused. G32 cancel-now: no required live Synthesia generate path. */
export async function createSynthesiaVideo(_params: {
  avatarId: string
  scriptText: string
  title?: string
}): Promise<{ ok: true; videoId: string; downloadUrl: string; status: string } | { ok: false; error: string }> {
  return { ok: false, error: REFUSE }
}

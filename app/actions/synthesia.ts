'use server'

/**
 * Synthesia API integration for broker intro videos.
 * Requires SYNTHESIA_API_KEY (Creator plan or above).
 * @see https://docs.synthesia.io/reference/create-video
 * @see https://docs.synthesia.io/reference/avatars
 */

const SYNTHESIA_BASE = 'https://api.synthesia.io'

function getApiKey(): string | null {
  const key = process.env.SYNTHESIA_API_KEY?.trim()
  return key || null
}

export async function checkSynthesiaConfigured(): Promise<{ configured: boolean }> {
  return { configured: !!getApiKey() }
}

type VideoResponse = {
  id?: string
  status?: 'complete' | 'in_progress' | 'error' | 'deleted' | 'rejected' | 'approved'
  download?: string
  error?: string
  context?: string
}

/** Create a video via Synthesia API, poll until complete, then return the download URL. */
export async function createSynthesiaVideo(params: {
  avatarId: string
  scriptText: string
  title?: string
}): Promise<{ ok: true; videoId: string; downloadUrl: string; status: string } | { ok: false; error: string }> {
  const apiKey = getApiKey()
  if (!apiKey) return { ok: false, error: 'Synthesia API key is not configured. Add SYNTHESIA_API_KEY to your environment.' }

  const { avatarId, scriptText, title } = params
  const body = {
    title: title || 'Broker intro',
    input: [
      {
        avatar: avatarId,
        background: 'white_studio',
        scriptText: scriptText.trim() || 'Hello.',
      },
    ],
    visibility: 'private' as const,
    test: false,
  }

  const createRes = await fetch(`${SYNTHESIA_BASE}/v2/videos`, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!createRes.ok) {
    const errBody = await createRes.text()
    let errMsg = `Synthesia API error ${createRes.status}`
    try {
      const j = JSON.parse(errBody) as { error?: string; context?: string }
      if (j.error) errMsg = j.error
      if (j.context) errMsg += `: ${j.context}`
    } catch {
      if (errBody) errMsg += `: ${errBody.slice(0, 200)}`
    }
    return { ok: false, error: errMsg }
  }

  const created = (await createRes.json()) as VideoResponse
  const videoId = created.id
  if (!videoId) return { ok: false, error: 'Synthesia did not return a video ID.' }

  if (created.status === 'complete' && created.download) {
    return { ok: true, videoId, downloadUrl: created.download, status: 'complete' }
  }

  const maxAttempts = 20
  const pollIntervalMs = 15000
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollIntervalMs))
    const getRes = await fetch(`${SYNTHESIA_BASE}/v2/videos/${videoId}`, {
      headers: { Authorization: apiKey },
    })
    if (!getRes.ok) {
      return { ok: false, error: `Failed to poll video status: ${getRes.status}` }
    }
    const video = (await getRes.json()) as VideoResponse
    if (video.status === 'complete' && video.download) {
      return { ok: true, videoId, downloadUrl: video.download, status: 'complete' }
    }
    if (video.status === 'error') {
      return { ok: false, error: video.error || video.context || 'Video generation failed.' }
    }
  }

  return { ok: false, error: 'Video generation timed out. Check your Synthesia dashboard for the video.' }
}

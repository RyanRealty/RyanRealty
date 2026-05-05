const BUFFER_BASE_URL = 'https://api.bufferapp.com/1'

type BufferPlatform = 'x' | 'pinterest' | 'threads'

interface BufferPublishOptions {
  platform: BufferPlatform
  text: string
  mediaUrl: string
  scheduledAt?: string
}

interface BufferCreateResponse {
  id?: string
  error?: string
}

function getBufferProfileId(platform: BufferPlatform): string {
  const byPlatform: Record<BufferPlatform, string | undefined> = {
    x: process.env.BUFFER_PROFILE_X,
    pinterest: process.env.BUFFER_PROFILE_PINTEREST,
    threads: process.env.BUFFER_PROFILE_THREADS,
  }

  const profileId = byPlatform[platform]
  if (!profileId?.trim()) {
    throw new Error(`Buffer profile ID not configured for ${platform}`)
  }
  return profileId
}

function getBufferToken(): string {
  const token = process.env.BUFFER_ACCESS_TOKEN
  if (!token?.trim()) {
    throw new Error('BUFFER_ACCESS_TOKEN is not configured')
  }
  return token
}

export async function publishViaBuffer(options: BufferPublishOptions): Promise<string> {
  const token = getBufferToken()
  const profileId = getBufferProfileId(options.platform)

  const params = new URLSearchParams()
  params.set('access_token', token)
  params.set('profile_ids[]', profileId)
  params.set('text', options.text)
  params.set('media[video]', options.mediaUrl)

  if (options.scheduledAt?.trim()) {
    const epoch = Math.floor(new Date(options.scheduledAt).getTime() / 1000)
    if (Number.isFinite(epoch) && epoch > 0) {
      params.set('scheduled_at', `${epoch}`)
    } else {
      params.set('now', 'true')
    }
  } else {
    params.set('now', 'true')
  }

  const response = await fetch(`${BUFFER_BASE_URL}/updates/create.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    throw new Error(`Buffer publish failed: ${response.status} ${response.statusText}`)
  }

  const json = (await response.json()) as BufferCreateResponse
  if (!json.id) {
    throw new Error(json.error || 'Buffer publish response missing id')
  }

  return json.id
}

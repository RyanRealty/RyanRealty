/**
 * Tours stay on this listing page. Spark leftover is a URL. Some hosts
 * (Matterport, Aryeo) frame. Zillow view-imx and brochure microsites do
 * not — they captcha or take the buyer off-site. Those URLs are not
 * leftover 3D models. Floor-plan stills and the lot mesh are.
 */

export function isOffsiteTourHost(url: string | null | undefined): boolean {
  const raw = url?.trim() ?? ''
  if (!raw) return true
  let host = ''
  let path = '/'
  try {
    const parsed = new URL(raw.startsWith('//') ? `https:${raw}` : raw)
    host = parsed.hostname.toLowerCase()
    path = parsed.pathname || '/'
  } catch {
    return true
  }
  if (host === 'zillow.com' || host.endsWith('.zillow.com')) return true
  if (host.includes('matterport.com')) return false
  if (host.includes('aryeo.com')) return false
  if (host.includes('cloudflarestream.com') || host.includes('videodelivery.net')) return false
  if (host.includes('player.vimeo.com') || host.includes('youtube.com') || host.includes('youtu.be')) {
    return false
  }
  if (host.includes('google.com') && path.includes('/file/d/')) return false
  if (path === '/' || path === '') return true
  return false
}

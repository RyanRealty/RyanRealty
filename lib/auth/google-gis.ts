/**
 * Google Identity Services (One Tap / FedCM) for the public site.
 * Same GIS client the admin door uses. The prompt is Google's compact
 * "Continue as …" sheet. If Google has no session, the prompt does not
 * display and the caller shows the leftover sign-in card.
 */

export const RR_OPEN_SIGNIN = 'rr-open-signin'
export const RR_OPEN_SIGNIN_FLAG = 'rr_open_signin'

interface GoogleIdConfig {
  client_id: string
  callback: (resp: { credential: string }) => void
  nonce?: string
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
  use_fedcm_for_prompt?: boolean
}

/** Options for the official Google-rendered button (accounts.id.renderButton). */
export interface GoogleButtonOptions {
  type?: string
  theme?: string
  size?: string
  text?: string
  shape?: string
  logo_alignment?: string
  width?: number
}

interface GisPromptNotification {
  isNotDisplayed?: () => boolean
  isSkippedMoment?: () => boolean
  isDismissedMoment?: () => boolean
  isDisplayMoment?: () => boolean
}

interface GisGoogle {
  accounts: {
    id: {
      initialize: (c: GoogleIdConfig) => void
      renderButton: (el: HTMLElement, o: GoogleButtonOptions) => void
      prompt: (cb?: (n: GisPromptNotification) => void) => void
      cancel: () => void
    }
  }
}

const DEFAULT_BUTTON_OPTIONS: GoogleButtonOptions = {
  type: 'standard',
  theme: 'outline',
  size: 'large',
  text: 'continue_with',
  shape: 'pill',
  logo_alignment: 'left',
  width: 320,
}

function gis(): GisGoogle | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { google?: GisGoogle }).google
}

export function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (gis()?.accounts?.id) return resolve()
    const existing = document.getElementById('google-gsi-client') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('gsi load failed')))
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.id = 'google-gsi-client'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('gsi load failed'))
    document.head.appendChild(s)
  })
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** True when Google did not show the compact continue sheet (no Google session). */
export function googlePromptUnavailable(n: GisPromptNotification): boolean {
  return Boolean(n.isNotDisplayed?.() || n.isSkippedMoment?.())
}

export function googlePromptDisplayed(n: GisPromptNotification): boolean {
  return Boolean(n.isDisplayMoment?.())
}

export async function promptGoogleOneTap(input: {
  clientId: string
  onCredential: (rawNonce: string, credential: string) => void
  onUnavailable: () => void
}): Promise<() => void> {
  const rawNonce = crypto.randomUUID()
  const hashedNonce = await sha256Hex(rawNonce)
  await loadGis()
  const g = gis()
  if (!g) {
    input.onUnavailable()
    return () => {}
  }
  g.accounts.id.initialize({
    client_id: input.clientId,
    callback: (resp) => input.onCredential(rawNonce, resp.credential),
    nonce: hashedNonce,
    auto_select: false,
    cancel_on_tap_outside: true,
    use_fedcm_for_prompt: true,
  })
  let settled = false
  const timer = window.setTimeout(() => unavailable(), 1800)
  const cancel = () => {
    window.clearTimeout(timer)
    try {
      g.accounts.id.cancel()
    } catch {
      /* noop */
    }
  }
  const unavailable = () => {
    if (settled) return
    settled = true
    cancel()
    input.onUnavailable()
  }
  g.accounts.id.prompt((notification) => {
    if (googlePromptDisplayed(notification)) {
      settled = true
      window.clearTimeout(timer)
      return
    }
    if (googlePromptUnavailable(notification)) unavailable()
  })
  return cancel
}

/**
 * Initialize GIS once and render Google's OWN button — the streamlined,
 * unmistakably-Google control (not a lookalike we drew) — into `buttonEl`.
 * Optionally also fires the One Tap avatar prompt in the same beat, for
 * surfaces (login) where there is no separate silent-prompt-then-fallback
 * dance already running. Returns a cancel function; call it on unmount so a
 * stale nonce cannot fire the callback after the caller stopped caring.
 */
export async function renderGoogleButton(input: {
  clientId: string
  buttonEl: HTMLElement
  onCredential: (rawNonce: string, credential: string) => void
  prompt?: boolean
  options?: GoogleButtonOptions
}): Promise<() => void> {
  const rawNonce = crypto.randomUUID()
  const hashedNonce = await sha256Hex(rawNonce)
  await loadGis()
  const g = gis()
  if (!g) return () => {}
  g.accounts.id.initialize({
    client_id: input.clientId,
    callback: (resp) => input.onCredential(rawNonce, resp.credential),
    nonce: hashedNonce,
    auto_select: false,
    cancel_on_tap_outside: true,
    use_fedcm_for_prompt: true,
  })
  g.accounts.id.renderButton(input.buttonEl, { ...DEFAULT_BUTTON_OPTIONS, ...input.options })
  if (input.prompt) g.accounts.id.prompt()
  return () => {
    try {
      g.accounts.id.cancel()
    } catch {
      /* noop */
    }
  }
}

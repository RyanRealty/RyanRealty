/**
 * lib/grok/client.ts — one xAI transport for every Grok surface.
 *
 * Everything Grok in this repo goes through here: text, Live Search, vision,
 * image, video. One key read, one retry policy, one error shape, one place
 * where model ids live.
 *
 * Model ids are NOT guessed. They are the ids the account actually serves
 * (GET https://api.x.ai/v1/models, verified 2026-08-26). `npm run
 * ci:grok-models` re-checks them against the live account so a silent xAI
 * deprecation fails a gate instead of a production render.
 */
import { cursorCliPresent, resolveGrokTransport } from './transport'


export const XAI_BASE_URL = 'https://api.x.ai/v1'

/** Live account model ids. Verified 2026-08-26 against GET /v1/models. */
export const GROK_MODELS = {
  /** Reasoning text: briefs, captions, editorial slate. */
  text: 'grok-4.6',
  /** Cheaper text for mechanical rewrites. */
  textFast: 'grok-4.5',
  /** Image understanding. Grok 4 chat models take image_url content parts. */
  vision: 'grok-4.6',
  /**
   * Site-queue taste evaluator (`scripts/taste-evaluate.ts`). Must differ from
   * `text` / `vision`: a Grok builder is grok-4.6, and ci:taste-canon refuses
   * evaluatorModel == builderModel. grok-4.5 still takes image_url parts.
   */
  taste: 'grok-4.5',
  /**
   * Frame judge for authored story films (lib/studio/story). The newest
   * vision-capable model on the account (grok-4.7, 2026-09, text+image, same
   * token price as 4.6). Kept separate from `vision` so the Studio's 85-point
   * bar, calibrated on 4.6, does not move under the listing formats.
   */
  judge: 'grok-4.7',
  /** Stills. $0.04/image. */
  image: 'grok-imagine-image-2.0',
  /** Cheap stills for candidate sweeps. $0.02/image. */
  imageDraft: 'grok-imagine-image',
  /**
   * Motion. $0.08/sec. The 1.5 model is the one that matters: it is the only
   * one with native 1080p on text-to-video and image-to-video, and the only
   * one that accepts reference_audios. grok-imagine-video is $0.05/sec but
   * caps lower, so we pay the 3 cents for the frame we actually ship.
   */
  video: 'grok-imagine-video-1.5',
  /** Cheaper motion for throwaway previz. $0.05/sec. */
  videoDraft: 'grok-imagine-video',
} as const

/** Published rates, 2026-08-26. Used for the studio spend ledger. */
export const GROK_RATES = {
  imageUsd: { 'grok-imagine-image': 0.02, 'grok-imagine-image-2.0': 0.04, 'grok-imagine-image-quality': 0.05 },
  videoUsdPerSecond: { 'grok-imagine-video': 0.05, 'grok-imagine-video-1.5': 0.08 },
} as const

/** xAI reports spend in ticks of 1e-9 USD. */
export function ticksToUsd(ticks: number | undefined | null): number | null {
  if (typeof ticks !== 'number' || !Number.isFinite(ticks)) return null
  return Math.round(ticks) / 1_000_000_000
}

export type GrokModel = (typeof GROK_MODELS)[keyof typeof GROK_MODELS]

export class GrokError extends Error {
  readonly status: number
  readonly body: string
  constructor(message: string, status: number, body: string) {
    super(message)
    this.name = 'GrokError'
    this.status = status
    this.body = body
  }
}

export function grokApiKey(): string {
  const key = process.env.XAI_API_KEY
  if (!key?.trim()) {
    throw new GrokError('XAI_API_KEY is not set. Add it to .env.local and Vercel env.', 0, '')
  }
  return key.trim()
}

/**
 * True when the active transport can serve a text/structured call.
 * Cursor transport (expired Auto-CMA / GROK_TRANSPORT=cursor): Cursor CLI present.
 * xAI transport (default, manual admin): XAI_API_KEY set.
 * Does not delete or require XAI_API_KEY for Cursor — key stays in env unused.
 */
export function grokConfigured(): boolean {
  // transport.ts does not import client — safe static import (cursor-cli does).
  if (resolveGrokTransport() === 'cursor') return cursorCliPresent()
  return Boolean(process.env.XAI_API_KEY?.trim())
}

const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504])
const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 1200

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export type XaiFetchOptions = {
  /** Per-attempt timeout. Video starts return fast; polls are separate calls. */
  timeoutMs?: number
  /** Retry idempotent reads and generation starts. Default true. */
  retry?: boolean
}

/**
 * POST/GET against the xAI API with the account key attached.
 * Retries 429 and 5xx with backoff, honouring Retry-After when xAI sends it.
 * Throws GrokError carrying the response body so callers can log the real cause.
 */
export async function xaiFetch(
  path: string,
  init: RequestInit = {},
  options: XaiFetchOptions = {},
): Promise<Response> {
  if (resolveGrokTransport() === 'cursor') {
    throw new GrokError(
      'xaiFetch blocked: Cursor transport active (no api.x.ai for this path)',
      0,
      path,
    )
  }
  const { timeoutMs = 120_000, retry = true } = options
  const url = path.startsWith('http') ? path : `${XAI_BASE_URL}${path}`
  const key = grokApiKey()
  const attempts = retry ? MAX_ATTEMPTS : 1

  let lastError: GrokError | null = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers ?? {}),
        },
      })
      if (res.ok) return res

      const body = await res.text()
      lastError = new GrokError(`xAI ${path} returned ${res.status}`, res.status, body.slice(0, 2000))
      if (!RETRY_STATUS.has(res.status) || attempt === attempts) throw lastError

      const retryAfter = Number(res.headers.get('retry-after'))
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : BASE_BACKOFF_MS * attempt * attempt
      await sleep(waitMs)
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof GrokError) {
        if (attempt === attempts) throw err
        continue
      }
      const aborted = err instanceof Error && err.name === 'AbortError'
      lastError = new GrokError(
        aborted ? `xAI ${path} timed out after ${timeoutMs}ms` : `xAI ${path} request failed`,
        0,
        err instanceof Error ? err.message : String(err),
      )
      if (attempt === attempts) throw lastError
      await sleep(BASE_BACKOFF_MS * attempt)
      continue
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError ?? new GrokError(`xAI ${path} failed`, 0, '')
}

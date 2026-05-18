/**
 * Anonymous like tracking + soft-signup gate for the /pulse feed.
 *
 * Likes persist in localStorage so visitors can favorite homes without signing up.
 * After 3 likes we surface the in-feed signup card; this file owns those triggers.
 *
 * The "save" naming in this file is retained for backwards compatibility with the
 * earlier draft; the public API is named for likes.
 */

const LIKES_KEY = 'pulse:likes'
const COUNTER_KEY = 'pulse:like_count'
const SIGNUP_DISMISSED_KEY = 'pulse:signup_dismissed'

export type PulseLikeListener = (liked: Set<string>) => void

const listeners = new Set<PulseLikeListener>()

function read(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(LIKES_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(arr.filter((s) => typeof s === 'string' && s.length > 0))
  } catch {
    return new Set()
  }
}

function write(set: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LIKES_KEY, JSON.stringify([...set]))
    listeners.forEach((l) => l(new Set(set)))
  } catch {
    // ignore quota errors; likes are best-effort on the client
  }
}

export function getLikedKeys(): Set<string> {
  return read()
}

export function isLiked(key: string): boolean {
  if (!key) return false
  return read().has(key)
}

export function toggleLike(key: string): { liked: boolean; total: number } {
  if (!key) return { liked: false, total: 0 }
  const set = read()
  let liked: boolean
  if (set.has(key)) {
    set.delete(key)
    liked = false
  } else {
    set.add(key)
    liked = true
  }
  write(set)
  if (liked) bumpLikeCounter()
  return { liked, total: set.size }
}

export function setLiked(key: string, value: boolean): { liked: boolean; total: number } {
  if (!key) return { liked: false, total: 0 }
  const set = read()
  const had = set.has(key)
  if (value && !had) set.add(key)
  if (!value && had) set.delete(key)
  write(set)
  if (value && !had) bumpLikeCounter()
  return { liked: set.has(key), total: set.size }
}

export function subscribeLiked(fn: PulseLikeListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function bumpLikeCounter() {
  if (typeof window === 'undefined') return
  try {
    const current = Number(window.localStorage.getItem(COUNTER_KEY) ?? '0') || 0
    window.localStorage.setItem(COUNTER_KEY, String(current + 1))
  } catch {
    // ignore
  }
}

export function getLifetimeLikeCount(): number {
  if (typeof window === 'undefined') return 0
  try {
    return Number(window.localStorage.getItem(COUNTER_KEY) ?? '0') || 0
  } catch {
    return 0
  }
}

export function isSignupDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SIGNUP_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissSignup(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SIGNUP_DISMISSED_KEY, '1')
  } catch {
    // ignore
  }
}

/* Legacy aliases for backwards compatibility with the earlier draft */
export const togglePulseSaved = toggleLike
export const isPulseSaved = isLiked
export const subscribePulseSaved = subscribeLiked
export const getPulseSaveCount = getLifetimeLikeCount
export const isSoftPromptDismissed = isSignupDismissed
export const dismissSoftPrompt = dismissSignup

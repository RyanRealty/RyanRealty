/**
 * lib/ask-source.ts — WHICH CONTROL SENT THE VISITOR TO THE ASK.
 *
 * THE PROBLEM. A valuation submit on /sell looks identical in GA4 whether the
 * visitor came from the hero field, the header's secondary "Value my home", or
 * the sticky control SITE-05 adds. Without a source stamp the sticky control
 * cannot be measured, which is the whole accept test of that node: at least 15%
 * of /sell valuation submits carrying `source='sticky'` within 28 days, with no
 * drop in total submits.
 *
 * THE CONTRACT, in three moves:
 *
 *   1. THE CONTROL STAMPS. On click, a control calls `markAskSource('sticky')`
 *      immediately before it navigates. One key, one value, session scope.
 *   2. THE FORM READS ONCE. On submit, the form calls `readAskSource()`, which
 *      returns the stamp AND CLEARS IT. Clearing on read is what stops one
 *      sticky click attributing every later submit in the session.
 *   3. THE PAYLOAD CARRIES IT. `withAskSource(payload)` merges `{ source }`
 *      into a GA4 payload when a stamp is present and leaves the payload
 *      untouched when it is not, so an unattributed submit never grows a
 *      `source: undefined` key that GA4 would report as a distinct value.
 *
 * WHY sessionStorage AND NOT A QUERY PARAM. The sticky control's href on /sell
 * is a same-page anchor (`#get-value`) — there is no navigation to hang a
 * parameter on. A cookie would ride on every request to every route for a fact
 * only one form needs. sessionStorage is the narrowest thing that survives the
 * one navigation this has to survive (a place page → /sell#get-value).
 *
 * WHY EVERY ACCESS IS WRAPPED. Safari private mode, a storage-partitioned
 * embed, and a visitor with site data blocked all throw on the ACCESSOR, not
 * just on the write. An unwrapped read there takes down the form it was
 * supposed to instrument, so every path here fails silent and unattributed:
 * losing a source stamp is a measurement gap, losing the submit is a lost lead.
 *
 * SSR: no function here touches storage at module load, and none may be called
 * from a client component's render body — the hydration gate (G37) treats a
 * storage read during render as a #418 risk and it is right. Call sites are
 * event handlers and effects only.
 */

/** The session key. Exported so a test asserts against the real name, not a copy. */
export const ASK_SOURCE_KEY = 'rr_ask_source'

/**
 * The controls that can send a visitor to a valuation ask. A closed union: a
 * new control adds itself here, so GA4 never receives a free-text source and
 * the report stays a fixed set of columns.
 *
 *   sticky  the SITE-05 bottom control (desktop pill / mobile bar)
 *   hero    the page's own hero address field
 *   chrome  the header's secondary "Value my home"
 *   inline  an in-body link or button inside a section
 *   footer  the footer's valuation link
 */
export type AskSource = 'sticky' | 'hero' | 'chrome' | 'inline' | 'footer'

const ASK_SOURCES: readonly AskSource[] = ['sticky', 'hero', 'chrome', 'inline', 'footer']

/** True for a value this module is willing to hand back as a source. */
export function isAskSource(value: unknown): value is AskSource {
  return typeof value === 'string' && (ASK_SOURCES as readonly string[]).includes(value)
}

/**
 * The storage handle, or null when there is not one. Every caller in this file
 * goes through here so the try/catch exists exactly once.
 */
function askSourceStore(): Storage | null {
  try {
    if (typeof globalThis === 'undefined') return null
    const candidate = (globalThis as { sessionStorage?: Storage }).sessionStorage
    return candidate ?? null
  } catch {
    return null
  }
}

/**
 * Stamp the control that is about to send the visitor to an ask.
 * Call it from a click handler, never from a render body.
 */
export function markAskSource(source: AskSource): void {
  const store = askSourceStore()
  if (!store) return
  try {
    store.setItem(ASK_SOURCE_KEY, source)
  } catch {
    /* storage full or blocked — the submit still goes through, unattributed */
  }
}

/**
 * Read the stamp WITHOUT clearing it. For a caller that needs the value in more
 * than one place in the same submit and does its own clearing.
 */
export function peekAskSource(): AskSource | null {
  const store = askSourceStore()
  if (!store) return null
  try {
    const raw = store.getItem(ASK_SOURCE_KEY)
    return isAskSource(raw) ? raw : null
  } catch {
    return null
  }
}

/** Drop the stamp. Safe to call when there is none. */
export function clearAskSource(): void {
  const store = askSourceStore()
  if (!store) return
  try {
    store.removeItem(ASK_SOURCE_KEY)
  } catch {
    /* nothing to do — a stamp we cannot clear is a stamp we could not read */
  }
}

/**
 * THE CONSUMING READ. Returns the stamp and clears it, so one click attributes
 * exactly one submit. This is what a form calls, once, on submit.
 */
export function readAskSource(): AskSource | null {
  const source = peekAskSource()
  if (source) clearAskSource()
  return source
}

/**
 * Merge `{ source }` into an analytics payload. NON-CONSUMING: pass the value
 * you already read (the normal case, so one `readAskSource()` can feed both the
 * GA4 event and the request metadata), or omit it and this peeks. A payload
 * with no stamp comes back byte-identical — never with `source: undefined`.
 */
export function withAskSource<T extends Record<string, unknown>>(
  payload: T,
  source?: AskSource | null,
): T | (T & { source: AskSource }) {
  const resolved = source === undefined ? peekAskSource() : source
  if (!resolved) return payload
  return { ...payload, source: resolved }
}

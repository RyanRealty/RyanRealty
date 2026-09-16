/**
 * lib/grok/transport.ts — which bill pays for a Grok text/structured call.
 *
 * Two transports:
 *   - `xai`    → https://api.x.ai with XAI_API_KEY (SpaceX/xAI console, per token)
 *   - `cursor` → `cursor-agent` CLI on the Cursor subscription (same pattern as
 *                Tip Ready taste receipts / scripts/taste-evaluate.ts). XAI_API_KEY
 *                is stripped from the spawn env so the CLI cannot fall through to
 *                api.x.ai.
 *
 * Default is `xai` so /admin/cmas rebuilds and other studio surfaces keep working
 * on the existing key. Expired Auto-CMA (requestSource expired-listing-cron) forces
 * `cursor` for the build so judge/audit do not burn RyanRealtyApp — see
 * lib/cma/worker.ts. Override globally with GROK_TRANSPORT=cursor|xai.
 *
 * Request-scoped via AsyncLocalStorage so a Cursor-forced expired build cannot
 * leak into a concurrent manual rebuild on the same isolate.
 */

import { AsyncLocalStorage } from 'node:async_hooks'

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

export const CURSOR_CLI = process.env.CURSOR_CLI?.trim() || 'cursor-agent'

let cliPresentCache: boolean | null = null

/** True when the Cursor CLI binary is on PATH / at CURSOR_CLI. Cached per process. */
export function cursorCliPresent(): boolean {
  if (cliPresentCache != null) return cliPresentCache
  const cli = CURSOR_CLI
  if (cli.includes('/') || cli.includes('\\')) {
    cliPresentCache = existsSync(cli)
    return cliPresentCache
  }
  const which = spawnSync('which', [cli], { encoding: 'utf8' })
  cliPresentCache = which.status === 0 && Boolean(which.stdout?.trim())
  return cliPresentCache
}

/** Test helper — reset the presence cache between cases. */
export function _resetCursorCliPresentCacheForTests(): void {
  cliPresentCache = null
}

export type GrokTransport = 'xai' | 'cursor'

const store = new AsyncLocalStorage<GrokTransport>()

/** Env override. Unset → xai (manual / studio default). */
export function grokTransportFromEnv(): GrokTransport {
  const raw = (process.env.GROK_TRANSPORT ?? '').trim().toLowerCase()
  if (raw === 'cursor') return 'cursor'
  if (raw === 'xai') return 'xai'
  return 'xai'
}

/** Active transport for this async chain (ALS), else env, else xai. */
export function resolveGrokTransport(): GrokTransport {
  return store.getStore() ?? grokTransportFromEnv()
}

/** Run `fn` with a forced transport for the whole async subtree. */
export function runWithGrokTransport<T>(transport: GrokTransport, fn: () => T): T {
  return store.run(transport, fn)
}

export async function runWithGrokTransportAsync<T>(
  transport: GrokTransport,
  fn: () => Promise<T>,
): Promise<T> {
  return store.run(transport, fn)
}

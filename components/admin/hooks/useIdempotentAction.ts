'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import type { MutationResult } from '@/lib/admin/mutation-result'
import { newIdempotencyKey } from '@/lib/admin/mutation-result'

/**
 * The client mutation primitive (admin rebuild Foundation, §4.2). This is the UI
 * half of the RC2 fix — the direct cause of "it hangs, I send multiple":
 *
 *  - `pending` flips true the instant you submit, so the caller can disable the
 *    button and show a sending state (no more "nothing happens for 2–6s").
 *  - A submit while already pending is IGNORED (the double-tap can't fire twice).
 *  - Each logical submission carries ONE idempotency key; a `retry()` reuses the
 *    SAME key, so the server dedupes instead of sending again.
 *  - The action returns a MutationResult the caller patches into local state — no
 *    router.refresh(), no full-page refetch.
 *
 * The action is `(input, idempotencyKey) => Promise<MutationResult<T>>`. Optimistic
 * list/bubble patching (useOptimistic) is applied per-surface by the consuming
 * component around this hook.
 */
export function useIdempotentAction<TInput, TData>(
  action: (input: TInput, idempotencyKey: string) => Promise<MutationResult<TData>>,
  opts?: {
    onSuccess?: (data: TData, input: TInput) => void
    onError?: (error: string, input: TInput) => void
  },
) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // The in-flight submission's key + input, so retry() re-drives the same one.
  const lastKey = useRef<string | null>(null)
  const lastInput = useRef<TInput | null>(null)
  // A synchronous guard: useTransition's `pending` updates a tick late, so a very
  // fast double-tap could slip through before React re-renders. This ref closes it.
  const inFlight = useRef(false)

  const run = useCallback(
    (input: TInput, key: string) => {
      if (inFlight.current) return
      inFlight.current = true
      lastKey.current = key
      lastInput.current = input
      setError(null)
      startTransition(async () => {
        try {
          const res = await action(input, key)
          if (res.ok) {
            opts?.onSuccess?.(res.data, input)
          } else if (res.code === 'in_flight') {
            // A sibling/duplicate is already processing this key — treat as a no-op,
            // not an error (the original send is happening).
          } else {
            setError(res.error)
            opts?.onError?.(res.error, input)
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Something went wrong. Try again.'
          setError(msg)
          opts?.onError?.(msg, input)
        } finally {
          inFlight.current = false
        }
      })
    },
    [action, opts],
  )

  /** Submit a new logical mutation (fresh idempotency key). */
  const submit = useCallback((input: TInput) => run(input, newIdempotencyKey()), [run])

  /** Retry the last failed submission with the SAME key (server dedupes). */
  const retry = useCallback(() => {
    if (lastKey.current == null || lastInput.current == null) return
    run(lastInput.current, lastKey.current)
  }, [run])

  const reset = useCallback(() => {
    setError(null)
    lastKey.current = null
    lastInput.current = null
  }, [])

  return { submit, retry, reset, pending, error }
}

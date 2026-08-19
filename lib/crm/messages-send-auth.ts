/**
 * Messages compose auth — the inbox send path refuses unsigned / under-privileged
 * callers before sendCrmSmsAction runs.
 */

export type MessagesSendAuth =
  | { ok: true }
  | { ok: false; error: string; code: 'unauthenticated' | 'forbidden' }

export function refuseMessagesSend(auth: MessagesSendAuth | { ok: false; error: string; code: 'unauthenticated' | 'forbidden' } | { ok: true }): {
  ok: false
  error: string
} | null {
  if (auth.ok) return null
  return { ok: false, error: auth.error }
}

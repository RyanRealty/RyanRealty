/**
 * ai-email-draft — pure format contract between aiEmailDraftAction (server)
 * and the EmailComposer AI pill strip (client).
 *
 * Lives here (not in the 'use server' action file) because a 'use server'
 * module may only export async functions; these are synchronous pure helpers,
 * unit-tested alongside (same pattern as composer-submit-guard.ts).
 *
 * The model is instructed to answer with:
 *   Subject: <subject line>
 *   <blank line>
 *   <body>
 * parseAiEmailDraft() splits that robustly and falls back to body-only when
 * the model skipped the subject line.
 */

export const AI_EMAIL_DRAFT_KINDS = [
  'introduction',
  'follow_up',
  'still_buying',
  'custom',
  'reply',
] as const

export type AiEmailDraftKind = (typeof AI_EMAIL_DRAFT_KINDS)[number]

export function isAiEmailDraftKind(v: unknown): v is AiEmailDraftKind {
  return typeof v === 'string' && (AI_EMAIL_DRAFT_KINDS as readonly string[]).includes(v)
}

export type AiEmailDraft = { subject: string; body: string }

/** Split a model answer into { subject, body }. Never throws. */
export function parseAiEmailDraft(text: string): AiEmailDraft {
  const raw = String(text ?? '').trim()
  if (!raw) return { subject: '', body: '' }
  const lines = raw.split('\n')
  const first = lines[0] ?? ''
  const m = /^\s*subject\s*:\s*(.*)$/i.exec(first)
  if (!m) return { subject: '', body: raw }
  const subject = (m[1] ?? '').trim().slice(0, 300)
  const body = lines.slice(1).join('\n').replace(/^\s*\n/, '').trim()
  return { subject, body }
}

/**
 * Flatten an inbound email's HTML to plain text for the reply-draft context.
 * Crude on purpose — this feeds a prompt, not a render.
 */
export function stripHtmlToText(html: string, max = 1200): string {
  return String(html ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

/**
 * templateValidation — pure input validation + key generation for CRM templates.
 *
 * Kept separate from app/actions/crm-templates.ts because a 'use server' module
 * may only export async functions; these are synchronous pure helpers, and
 * living here also makes them unit-testable (vitest scans lib/**). The action
 * imports validateTemplateInput + slugifyTemplateKey and does the DB I/O.
 *
 * Enforces: channel valid (email|sms), name present, email has a subject, SMS
 * has none, body present, and the brand-voice hard-fail gate on subject + body.
 */

import { validateChannel } from '@/lib/crm/templateReferences'
import { checkTemplateVoice } from '@/lib/crm/templateVoiceCheck'

/** Result of a template mutation action. */
export type CrmTemplateResult =
  | { ok: true; id?: number; message?: string }
  | { ok: false; error: string }

export type CrmTemplateInput = {
  channel: string
  name: string
  subject?: string | null
  body: string
  category?: string | null
}

export type ValidatedTemplateRow = {
  channel: 'email' | 'sms'
  name: string
  subject: string | null
  body: string
  category: string | null
}

export type TemplateValidationResult =
  | { ok: true; row: ValidatedTemplateRow }
  | { ok: false; error: string }

/**
 * Build a stable, URL-safe template key from a channel + name, matching the
 * seeded convention (<channel>-<slugified-name>). The action appends a numeric
 * suffix on collision.
 */
export function slugifyTemplateKey(channel: string, name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  const base = slug || 'template'
  return `${channel}-${base}`
}

/**
 * Validate + normalize a template input. Pure (no DB) so the rules are unit
 * tested. The brand-voice gate runs last so a structurally-valid template with
 * banned copy still fails.
 */
export function validateTemplateInput(input: CrmTemplateInput): TemplateValidationResult {
  const channelCheck = validateChannel(input.channel)
  if (!channelCheck.ok) return channelCheck
  const channel = channelCheck.channel

  const name = (input.name ?? '').trim()
  if (!name) return { ok: false, error: 'A template name is required' }

  const body = (input.body ?? '').trim()
  if (!body) return { ok: false, error: 'Template body is required' }

  let subject: string | null = null
  if (channel === 'email') {
    subject = (input.subject ?? '').trim()
    if (!subject) return { ok: false, error: 'An email template needs a subject line' }
  } else {
    // SMS has no subject line; ignore any supplied value.
    subject = null
  }

  const voice = checkTemplateVoice({ subject, body })
  if (!voice.ok) return { ok: false, error: voice.error }

  const category = (input.category ?? '').trim() || null

  return { ok: true, row: { channel, name, subject, body, category } }
}

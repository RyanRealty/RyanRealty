/**
 * marketing-brain: inbox-allowlist
 *
 * Sender allowlist enforcement for the marketing inbox. Reads the static
 * config at config/marketing-brain/inbox-senders.json at module load.
 *
 * Anyone with the inbox address can email marketing@ryan-realty.com, so
 * every parse + dispatch path must call isSenderAllowed() first.
 */

import fs from 'node:fs'
import path from 'node:path'

interface InboxSendersConfig {
  schema_version: number
  last_updated: string
  description: string
  allowlisted_emails: string[]
  allowlisted_domains: string[]
  default_action_on_unknown_sender: 'reject_silent' | 'reject_and_alert'
}

let _cached: InboxSendersConfig | null = null

function loadConfig(): InboxSendersConfig {
  if (_cached) return _cached
  const configPath = path.join(process.cwd(), 'config', 'marketing-brain', 'inbox-senders.json')
  const raw = fs.readFileSync(configPath, 'utf8')
  _cached = JSON.parse(raw) as InboxSendersConfig
  return _cached
}

export interface AllowlistDecision {
  allowed: boolean
  matched_by: 'email' | 'domain' | null
  default_action: 'reject_silent' | 'reject_and_alert'
  reason: string
}

/**
 * Decide if a sender is allowed to drive the brain. Email matching is
 * case-insensitive. Domain matching strips the local part and compares
 * the suffix (so subdomains do not match — `foo@notes.ryan-realty.com`
 * is NOT allowed by a `ryan-realty.com` domain entry).
 */
export function isSenderAllowed(senderEmail: string): AllowlistDecision {
  const config = loadConfig()
  const normalized = senderEmail.trim().toLowerCase()
  const at = normalized.lastIndexOf('@')
  const domain = at === -1 ? '' : normalized.slice(at + 1)

  for (const allowed of config.allowlisted_emails) {
    if (allowed.toLowerCase() === normalized) {
      return {
        allowed: true,
        matched_by: 'email',
        default_action: config.default_action_on_unknown_sender,
        reason: `Matched explicit email allowlist entry: ${allowed}`,
      }
    }
  }

  for (const allowedDomain of config.allowlisted_domains) {
    if (allowedDomain.toLowerCase() === domain) {
      return {
        allowed: true,
        matched_by: 'domain',
        default_action: config.default_action_on_unknown_sender,
        reason: `Matched domain allowlist entry: ${allowedDomain}`,
      }
    }
  }

  return {
    allowed: false,
    matched_by: null,
    default_action: config.default_action_on_unknown_sender,
    reason: `Sender ${normalized} not in allowlist; default action: ${config.default_action_on_unknown_sender}`,
  }
}

/**
 * Test-only helper that bypasses the on-disk cache so unit tests can
 * mutate the file without restarting the process.
 */
export function _resetAllowlistCache(): void {
  _cached = null
}

/**
 * A reader error that says nothing about the document: the provider account
 * or service is down. Found 2026-09-24 on the first production dry run: the
 * Anthropic account was out of credit ("Your credit balance is too low to
 * access the Anthropic API"). Such a failure is never stored on a document
 * and never counts toward its three attempts, or a billing lapse would retire
 * every contract before the account was topped up. Pure.
 */
const OUTAGE = new RegExp(
  [
    'credit balance',
    'billing',
    'insufficient[_ ]quota',
    'exceeded your current quota',
    'spending limit',
    'no credits',
    'authentication_error',
    'permission_error',
    'invalid x-api-key',
    'incorrect api key',
    'rate_limit_error',
    'overloaded_error',
    '\\bapi_error\\b',
    '\\b(429|500|502|503|504|529)\\b',
    'ECONNRESET',
    'ETIMEDOUT',
    'fetch failed',
    'socket hang up',
  ].join('|'),
  'i',
)

export function isReaderOutage(error: string | null | undefined): boolean {
  return !!error && OUTAGE.test(error)
}

import { CRM_BROKERS, type CrmBrokerSlug } from '@/lib/crm/constants'

/**
 * Resolve the broker scope for the Activity feed.
 *
 * A restricted broker is locked to their own leads (`callerScope`) — they can
 * never widen the feed to another broker. The owner/superuser (`callerScope`
 * null) honors the requested filter: a valid broker slug scopes to that broker's
 * contacts, while `'all'` / empty means everyone (null). Pure + unit-tested so the
 * authorization rule isn't prose.
 */
export function resolveActivityScope(
  callerScope: CrmBrokerSlug | null,
  requested: string | null | undefined,
): string | null {
  if (callerScope !== null) return callerScope
  if (!requested || requested === 'all') return null
  return (CRM_BROKERS as readonly string[]).includes(requested) ? requested : null
}

/**
 * Where a subscriber manages ONE listing alert — the /account alert manager,
 * anchored to that alert's card (SavedSearchControls renders each card with
 * id="alert-<id>").
 *
 * PURE (no env reads, no I/O) so the email builder, tests, and any server or
 * client caller agree on the link shape. The email builder
 * (lib/crm/listing-alert-email.ts) should call this for its per-alert
 * "Manage this alert" footer link instead of the whole-page
 * `/account/saved-searches` constant:
 *
 *   manageUrl: row.user_id ? getAlertManageUrl(row.id, siteUrl) : null
 *
 * Only signed-in primaries get a manage link — household recipients and
 * guests manage through their token unsubscribe link.
 */
export function getAlertManageUrl(alertId: string, siteUrl?: string): string {
  const base = (siteUrl ?? '').trim().replace(/\/$/, '')
  const id = (alertId ?? '').trim()
  const anchor = id ? `#alert-${encodeURIComponent(id)}` : ''
  return `${base}/account/saved-searches${anchor}`
}

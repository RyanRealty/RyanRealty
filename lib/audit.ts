/**
 * Audit logging for admin actions. Writes to admin_actions table.
 * Use this on every admin write (create, update, delete).
 */
import { logAdminAction } from '@/app/actions/log-admin-action'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

export type AuditAction = 'create' | 'update' | 'delete' | 'upsert'

export async function logAuditEvent(
  userId: string,
  action: AuditAction,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>
): Promise<void> {
  const session = await getSession()
  const adminEmail = session?.user?.email ?? ''
  const roleResult = await getAdminRoleForEmail(adminEmail)
  const role = roleResult?.role ?? null
  await logAdminAction({
    adminEmail: adminEmail || `user:${userId}`,
    role,
    actionType: action,
    resourceType: entityType,
    resourceId: entityId,
    details: details ?? null,
  })
}

/** Superuser admin email; only this user can access /admin. */
const SUPERUSER_ADMIN_EMAIL = 'matt@ryan-realty.com'

export function isSuperuserAdmin(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false
  return email.trim().toLowerCase() === SUPERUSER_ADMIN_EMAIL.toLowerCase()
}

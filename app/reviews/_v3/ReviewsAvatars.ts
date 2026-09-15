/**
 * Route-level shadcn-avatar install (SITE-109).
 *
 * V3Proof already imports Avatar for the house primitive. Tip Ready
 * `requireRouteImport` also needs this route's page/_v3 set to import
 * `@/components/ui/avatar`. public.reviews has no photo column — initials
 * only; do not invent portraits.
 */
export { Avatar, AvatarFallback } from '@/components/ui/avatar'

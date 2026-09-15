/**
 * Route-level shadcn-avatar install (SITE-109).
 *
 * Tip Ready `requireRouteImport` needs this route's page/_v3 set to import
 * `@/components/ui/avatar`. The live control is ReviewsAvatarGroup — AvatarGroup
 * + AvatarFallback initials + reviewer-identity dropdown. No portrait images:
 * public.reviews has no photo column.
 */
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from '@/components/ui/avatar'

export { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount }
export { ReviewsAvatarGroup } from './ReviewsAvatarGroup.client'

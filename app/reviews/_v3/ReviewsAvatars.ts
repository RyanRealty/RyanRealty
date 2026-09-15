/**
 * Route-level shadcn-avatar install (SITE-109).
 *
 * Tip Ready `requireRouteImport` needs this route's page/_v3 set to import
 * `@/components/ui/avatar`. The live control is ReviewsAvatarGroup — the
 * catalog AvatarGroup / AvatarImage / AvatarBadge / Dropdown composition.
 */
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@/components/ui/avatar'

export { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage }
export { ReviewsAvatarGroup } from './ReviewsAvatarGroup.client'

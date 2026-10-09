/**
 * Route-level shadcn-avatar install (SITE-109, SITE-167).
 *
 * reachability: entry-point — discovered by taste-receipt --ship's route-local
 * _v3 directory walk (requireRouteImport), which reads this file's source text
 * by path, not by any module import (scripts/lib/catalog-install.mjs).
 *
 * Tip Ready `requireRouteImport` needs this route's page/_v3 set to import
 * `@/components/ui/avatar`. The live control is ReviewsAvatarGroup — AvatarGroup
 * + AvatarImage of the brokers behind the 5.0. public.reviews has no photo
 * column: never invent a reviewer portrait.
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
export { REVIEW_BROKERS, brokersForReviews } from './reviews-faces'

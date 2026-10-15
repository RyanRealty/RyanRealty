/**
 * reachability: entry-point — Sarah visual identity.
 * Matt approved public/images/sarah/avatar.jpg as the final avatar on
 * 2026-10-15. The launcher and Sarah's chat messages both use this path.
 * Swap the file only; do not inline a second photo.
 */
export const SARAH_AVATAR_SRC = '/images/sarah/avatar.jpg' as const
export const SARAH_AVATAR_SRC_2X = '/images/sarah/avatar@2x.jpg' as const
export const SARAH_AVATAR_SRC_3X = '/images/sarah/avatar@3x.jpg' as const
export const SARAH_AVATAR_SRCSET =
  `${SARAH_AVATAR_SRC} 1x, ${SARAH_AVATAR_SRC_2X} 2x, ${SARAH_AVATAR_SRC_3X} 3x` as const
export const SARAH_AVATAR_ALT = 'Sarah, Ryan Realty AI assistant' as const

/** Matt's public headshot, used only when he has taken over a chat. */
export const MATT_CHAT_PHOTO_SRC = '/images/brokers/ryan-matt.png' as const
export const MATT_CHAT_PHOTO_ALT = 'Matt Ryan' as const

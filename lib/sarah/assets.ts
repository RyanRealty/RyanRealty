/**
 * reachability: entry-point — Sarah visual identity.
 * Matt approved public/images/sarah/avatar.jpg as the source photo on
 * 2026-10-15. Square crops at 1x/2x/3x live beside it as sarah-headshot.
 * Swap the source file and regenerate the crops; do not inline a second photo.
 */
export const SARAH_HEADSHOT_SRC = '/images/sarah/sarah-headshot.jpg' as const
export const SARAH_HEADSHOT_SRC_2X = '/images/sarah/sarah-headshot@2x.jpg' as const
export const SARAH_HEADSHOT_SRC_3X = '/images/sarah/sarah-headshot@3x.jpg' as const
export const SARAH_AVATAR_SRC = SARAH_HEADSHOT_SRC
export const SARAH_AVATAR_SRCSET =
  `${SARAH_HEADSHOT_SRC} 1x, ${SARAH_HEADSHOT_SRC_2X} 2x, ${SARAH_HEADSHOT_SRC_3X} 3x` as const
export const SARAH_AVATAR_ALT = 'Sarah, Ryan Realty AI assistant' as const

/** Matt's public headshot, used only when he has taken over a chat. */
export const MATT_CHAT_PHOTO_SRC = '/images/brokers/ryan-matt.png' as const
export const MATT_CHAT_PHOTO_ALT = 'Matt Ryan' as const

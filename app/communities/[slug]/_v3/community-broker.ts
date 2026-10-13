/**
 * "Your local broker" block on every community page. Matt Ryan only.
 * Name, title, and team URL come from the brand roster. No closing
 * count and no invented specialty.
 */

import { BROKERS } from '@/lib/brand/contact'
import { teamPath } from '@/lib/slug'

export type CommunityBrokerBlock = {
  heading: string
  name: string
  title: string
  href: string
  body: string
}

export function communityBrokerBlock(placeName: string): CommunityBrokerBlock {
  const place = placeName.trim() || 'this community'
  const matt = BROKERS.matt
  return {
    heading: 'Your local broker',
    name: matt.nameShort,
    title: matt.title,
    href: teamPath(matt.slug),
    body: `${matt.nameShort} is the owner and principal broker at Ryan Realty. Ask him about buying or selling in ${place}.`,
  }
}

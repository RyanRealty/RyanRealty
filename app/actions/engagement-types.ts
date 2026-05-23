// Pure type module for engagement actions. Lives outside the 'use server'
// boundary because Next.js 15 server-action files may not export anything
// other than async functions. Consumers import `EngagementCounts` and
// `ListingDetailEngagement` from here while server actions live in
// `@/app/actions/engagement`.
import type { EngagementCounts as DALEngagementCounts } from '@/lib/data'

export type EngagementCounts = DALEngagementCounts
export type ListingDetailEngagement = EngagementCounts

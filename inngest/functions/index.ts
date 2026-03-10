import { initialFullSync } from './initialSync'
import { deltaSync } from './deltaSync'
import { finalizeListing } from './finalizeListing'
import {
  matchSavedSearches,
  queuePriceDropNotifications,
  queueStatusChangeNotifications,
  updateEngagementMetrics,
} from './postSyncProcessors'
import { processNotifications } from './processNotifications'
import { precomputeCMA } from './precomputeCMA'
import { computeMarketStats } from './computeMarketStats'
import { computeBrokerStats } from './computeBrokerStats'
import { generateBlogPost } from './generateBlogPost'
import { computeLeadScores } from './computeLeadScores'
import { leadWorkflows } from './leadWorkflows'
import { aiAnalyticsAgent } from './aiAnalyticsAgent'
import { regenerateSitemap } from './regenerateSitemap'

export const functions = [
  initialFullSync,
  deltaSync,
  finalizeListing,
  matchSavedSearches,
  queuePriceDropNotifications,
  queueStatusChangeNotifications,
  updateEngagementMetrics,
  processNotifications,
  precomputeCMA,
  computeMarketStats,
  computeBrokerStats,
  generateBlogPost,
  computeLeadScores,
  ...leadWorkflows,
  aiAnalyticsAgent,
  regenerateSitemap,
]

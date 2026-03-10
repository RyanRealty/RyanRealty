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
]

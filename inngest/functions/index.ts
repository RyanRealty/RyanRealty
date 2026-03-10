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

export const functions = [
  initialFullSync,
  deltaSync,
  finalizeListing,
  matchSavedSearches,
  queuePriceDropNotifications,
  queueStatusChangeNotifications,
  updateEngagementMetrics,
  processNotifications,
]

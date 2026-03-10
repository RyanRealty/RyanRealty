import { initialFullSync } from './initialSync'
import { deltaSync } from './deltaSync'
import { finalizeListing } from './finalizeListing'
import {
  matchSavedSearches,
  queuePriceDropNotifications,
  queueStatusChangeNotifications,
  updateEngagementMetrics,
} from './postSyncProcessors'

export const functions = [
  initialFullSync,
  deltaSync,
  finalizeListing,
  matchSavedSearches,
  queuePriceDropNotifications,
  queueStatusChangeNotifications,
  updateEngagementMetrics,
]

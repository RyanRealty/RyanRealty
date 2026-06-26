/**
 * CRM bulk mutation handler registry (Wave 3).
 *
 * Importing this module registers every real bulk handler with the bulk-jobs
 * framework (registerBulkHandler). The worker cron imports this module once at
 * the top of app/api/cron/crm-bulk-worker/route.ts so getBulkHandler(kind)
 * resolves a real mutation for every job kind below.
 *
 * Each handler:
 *   - receives a chunk of <=250 ids, the job params, and the FROZEN broker scope
 *   - mirrors its single-record server action's logic, scoped to the job's book
 *   - returns { processed, skipped, breakdown } with EVERY id accounted for
 *     (processed + skipped === chunk.length) so the worker offset drains
 *   - is suppression / compliance safe: tag handlers refuse protected compliance
 *     tags; enroll delegates to manualEnrollPerson (hard-stop fail-closed);
 *     report-subscription is a preference (delivery is suppression-gated at send).
 *
 * Kinds + params:
 *   crm:assign-broker          { brokerSlug }   superuser-gated at ENQUEUE
 *   crm:add-tag                { tag }          refuses protected compliance tags
 *   crm:remove-tag             { tag }          refuses protected compliance tags
 *   crm:set-stage              { stage }        validates against live crm_stages
 *   crm:enroll-workflow        { sequenceId }   per-id manualEnrollPerson
 *   crm:set-report-subscription{ areas, frequency, isActive }
 *
 * This module exports nothing — its only job is the registration side effect.
 */

import { registerBulkHandler } from '@/lib/crm/bulk-jobs'
import { assignBrokerHandler } from './assign-broker'
import { addTagHandler } from './add-tag'
import { removeTagHandler } from './remove-tag'
import { setStageHandler } from './set-stage'
import { enrollWorkflowHandler } from './enroll-workflow'
import { setReportSubscriptionHandler } from './set-report-subscription'
import { registerEmailCohortHandler } from './email-cohort'
import { deleteContactsHandler } from './delete'

registerBulkHandler('crm:assign-broker', assignBrokerHandler)
registerBulkHandler('crm:add-tag', addTagHandler)
registerBulkHandler('crm:remove-tag', removeTagHandler)
registerBulkHandler('crm:set-stage', setStageHandler)
registerBulkHandler('crm:enroll-workflow', enrollWorkflowHandler)
registerBulkHandler('crm:set-report-subscription', setReportSubscriptionHandler)
registerBulkHandler('crm:delete', deleteContactsHandler)

// The email-cohort SEND handler is owned by a sibling agent and exposes an
// explicit registration fn so it never has to edit this index. Wire it here so
// the worker's single side-effect import registers every handler (mutation +
// send) in one place. Suppression gating lives inside emailCohortHandler.
registerEmailCohortHandler()

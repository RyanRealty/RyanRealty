/**
 * Writes docs/gtm/ga4-browser-events.import.json: a GTM container import
 * (Admin > Import Container > Merge) holding the GA4 Event tag, its Custom Event
 * trigger, the "GA4 - page_view" tag with its trigger, and one Data Layer
 * Variable per parameter, all built from
 * lib/analytics/ga4-browser-events.ts so the import cannot drift from the code.
 *
 * Usage: npx tsx scripts/build-gtm-ga4-import.ts
 * ga4-browser-events.test.ts fails when the committed file is out of date.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  GA4_EVENT_PARAMS,
  GA4_MEASUREMENT_ID,
  GA4_PAGE_VIEW_PARAMS,
  GA4_PAGE_VIEW_TAG_NAME,
  GA4_PAGE_VIEW_TRIGGER_NAME,
  ga4BrowserEventTriggerRegex,
} from '../lib/analytics/ga4-browser-events'

export const GTM_TAG_NAME = 'GA4 - dataLayer events'
export const GTM_TRIGGER_NAME = 'CE - GA4 browser events'
export const gtmVariableName = (param: string) => `DLV - ga4 ${param}`

const tpl = (key: string, value: string) => ({ type: 'TEMPLATE', key, value })

export function buildGtmImport() {
  // One Data Layer Variable per distinct dataLayer key: the event tag's table,
  // then the page_view tag's keys it does not already read.
  const eventKeys = new Set<string>(GA4_EVENT_PARAMS.map((p) => p.name))
  const variableParams = [...GA4_EVENT_PARAMS, ...GA4_PAGE_VIEW_PARAMS.filter((p) => !eventKeys.has(p.name))]
  const variables = variableParams.map((p, i) => ({
    accountId: '0',
    containerId: '0',
    variableId: String(100 + i),
    name: gtmVariableName(p.name),
    type: 'v',
    parameter: [
      { type: 'INTEGER', key: 'dataLayerVersion', value: '2' },
      { type: 'BOOLEAN', key: 'setDefaultValue', value: 'false' },
      tpl('name', p.from),
    ],
    formatValue: {},
  }))
  const trigger = {
    accountId: '0',
    containerId: '0',
    triggerId: '90',
    name: GTM_TRIGGER_NAME,
    type: 'CUSTOM_EVENT',
    customEventFilter: [
      { type: 'MATCH_REGEX', parameter: [tpl('arg0', '{{_event}}'), tpl('arg1', ga4BrowserEventTriggerRegex())] },
    ],
  }
  const tag = {
    accountId: '0',
    containerId: '0',
    tagId: '91',
    name: GTM_TAG_NAME,
    type: 'gaawe',
    parameter: [
      { type: 'BOOLEAN', key: 'sendEcommerceData', value: 'false' },
      { type: 'BOOLEAN', key: 'enhancedUserId', value: 'false' },
      tpl('eventName', '{{Event}}'),
      tpl('measurementIdOverride', GA4_MEASUREMENT_ID),
      {
        type: 'LIST',
        key: 'eventSettingsTable',
        list: GA4_EVENT_PARAMS.map((p) => ({
          type: 'MAP',
          map: [tpl('parameter', p.name), tpl('parameterValue', `{{${gtmVariableName(p.name)}}}`)],
        })),
      },
    ],
    firingTriggerId: [trigger.triggerId],
    tagFiringOption: 'ONCE_PER_EVENT',
    monitoringMetadata: { type: 'MAP' },
    consentSettings: { consentStatus: 'NOT_SET' },
  }
  // The only page_view sender (GTM version 9). Needs the Google tag's
  // send_page_view set to false and enhanced measurement's "page changes based
  // on browser history events" off, or page views double (analytics-audit checks).
  const pageViewTrigger = {
    accountId: '0',
    containerId: '0',
    triggerId: '92',
    name: GA4_PAGE_VIEW_TRIGGER_NAME,
    type: 'CUSTOM_EVENT',
    customEventFilter: [{ type: 'EQUALS', parameter: [tpl('arg0', '{{_event}}'), tpl('arg1', 'page_view')] }],
  }
  const pageViewTag = {
    accountId: '0',
    containerId: '0',
    tagId: '93',
    name: GA4_PAGE_VIEW_TAG_NAME,
    type: 'gaawe',
    parameter: [
      { type: 'BOOLEAN', key: 'sendEcommerceData', value: 'false' },
      { type: 'BOOLEAN', key: 'enhancedUserId', value: 'false' },
      tpl('eventName', 'page_view'),
      tpl('measurementIdOverride', GA4_MEASUREMENT_ID),
      {
        type: 'LIST',
        key: 'eventSettingsTable',
        list: GA4_PAGE_VIEW_PARAMS.map((p) => ({
          type: 'MAP',
          map: [tpl('parameter', p.name), tpl('parameterValue', `{{${gtmVariableName(p.name)}}}`)],
        })),
      },
    ],
    firingTriggerId: [pageViewTrigger.triggerId],
    tagFiringOption: 'ONCE_PER_EVENT',
    monitoringMetadata: { type: 'MAP' },
    consentSettings: { consentStatus: 'NOT_SET' },
  }
  return {
    exportFormatVersion: 2,
    exportTime: '2026-10-08 00:00:00',
    containerVersion: {
      accountId: '0',
      containerId: '0',
      containerVersionId: '0',
      container: { accountId: '0', containerId: '0', name: 'ryan-realty.com', publicId: 'GTM-WV6R4NZ5', usageContext: ['WEB'] },
      tag: [tag, pageViewTag],
      trigger: [trigger, pageViewTrigger],
      variable: variables,
      builtInVariable: [{ accountId: '0', containerId: '0', type: 'EVENT', name: 'Event' }],
    },
  }
}

export const GTM_IMPORT_PATH = join('docs', 'gtm', 'ga4-browser-events.import.json')

if (process.argv[1] && /build-gtm-ga4-import/.test(process.argv[1])) {
  writeFileSync(GTM_IMPORT_PATH, `${JSON.stringify(buildGtmImport(), null, 2)}\n`)
  console.log(`wrote ${GTM_IMPORT_PATH}`)
}

'use server'

/**
 * Retired Expireds + FSBO compose-and-send. Those dashboards redirect to
 * /admin/prospecting. Names stay so a stale import cannot send.
 */

import {
  retiredProspectingSendDataError,
} from '@/lib/prospecting/retired-send'

export type DocKind = 'expired' | 'fsbo'

export async function prepareDocSendAction(
  _kind: DocKind,
  _id: string,
): Promise<{ data: null; error: string }> {
  return retiredProspectingSendDataError()
}

export async function sendDocEmailAction(
  _kind: DocKind,
  _id: string,
  _input: { subject: string; body: string; acknowledgeReview?: boolean },
): Promise<{ data: null; error: string }> {
  return retiredProspectingSendDataError()
}

export async function sendDocSmsAction(
  _kind: DocKind,
  _id: string,
  _input: { body: string },
): Promise<{ data: null; error: string }> {
  return retiredProspectingSendDataError()
}

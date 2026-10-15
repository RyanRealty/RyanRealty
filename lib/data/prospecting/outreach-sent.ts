/**
 * Worklist rows that already went out do not need the listings relist probe.
 * classifyProspect returns `sent` first when the doc is stamped, and the send
 * path still runs verifyNotRelisted before anything leaves.
 */
export function prospectOutreachAlreadySent(raw: {
  outreach_sms_sent_at?: string | null
  outreach_email_sent_at?: string | null
}): boolean {
  return Boolean(raw.outreach_sms_sent_at || raw.outreach_email_sent_at)
}

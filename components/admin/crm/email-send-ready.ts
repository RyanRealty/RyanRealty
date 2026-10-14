/**
 * Email send enablement. The Send button used to stay enabled with an empty
 * subject and body (person-page audit 2026-10-13). Disable when either field
 * is blank, a file is still uploading, or the host already gated send.
 */
export function emailSendIsReady(input: {
  subject: string
  body: string
  uploading?: boolean
  sendDisabled?: boolean
}): boolean {
  return !emailSendBlocked(input)
}

export function emailSendBlocked(input: {
  subject: string
  body: string
  uploading?: boolean
  sendDisabled?: boolean
}): boolean {
  return Boolean(
    input.uploading || input.sendDisabled || !input.subject.trim() || !input.body.trim(),
  )
}

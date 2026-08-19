/** Pure merge for attachCmaToPerson — fills blanks on kickoff, copies the person on replace. */

export function mergeCmaClientFields(params: {
  replace: boolean
  row: { client_name?: unknown; client_email?: unknown; client_phone?: unknown }
  person: { name: string | null; primaryEmail: string | null; primaryPhone: string | null }
}): { clientName: string | null; clientEmail: string | null; clientPhone: string | null } {
  const existingName = trimOrNull(params.row.client_name)
  const existingEmail = trimOrNull(params.row.client_email)
  const existingPhone = trimOrNull(params.row.client_phone)
  if (params.replace) {
    return {
      clientName: params.person.name || existingName,
      clientEmail: params.person.primaryEmail || existingEmail,
      clientPhone: params.person.primaryPhone || existingPhone,
    }
  }
  return {
    clientName: existingName || params.person.name,
    clientEmail: existingEmail || params.person.primaryEmail,
    clientPhone: existingPhone || params.person.primaryPhone,
  }
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

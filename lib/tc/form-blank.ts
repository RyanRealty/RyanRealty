/** Licensed blanks live in tc-forms. Deal copies and uploads live in tc-documents. */
export function formBlankStorageBucket(path: string): 'tc-forms' | 'tc-documents' {
  const p = path.replace(/^\/+/, '')
  if (p.startsWith('inbox/') || p.startsWith('forms/')) return 'tc-documents'
  return 'tc-forms'
}

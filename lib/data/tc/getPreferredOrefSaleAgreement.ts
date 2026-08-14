import 'server-only'

import { loadPreferredOrefForm } from '@/lib/data/tc/oref-packet-reads'

export type PreferredOrefForm = {
  id: string
  formNumber: string
  name: string
  fieldCount: number
}

export async function getPreferredOrefSaleAgreement(): Promise<{
  data: PreferredOrefForm | null
  error: string | null
}> {
  try {
    const picked = await loadPreferredOrefForm()
    if (!picked) return { data: null, error: 'No OREF sale agreement is in the form library.' }
    return {
      data: {
        id: picked.id,
        formNumber: picked.formNumber ?? '',
        name: picked.name,
        fieldCount: picked.fieldCount,
      },
      error: null,
    }
  } catch (err) {
    console.error('[getPreferredOrefSaleAgreement]', err)
    return { data: null, error: 'Database is not configured.' }
  }
}

'use client'

import { createContext, useContext } from 'react'

/** Shot helpers: force the catalog error shake or success check into frame. */
export type ContactFieldDemo = 'idle' | 'error' | 'success'

export const ContactFieldDemoContext = createContext<ContactFieldDemo>('idle')

export function useContactFieldDemo(): ContactFieldDemo {
  return useContext(ContactFieldDemoContext)
}

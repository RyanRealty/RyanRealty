'use client'

/**
 * SITE-96. Route-local catalog install.
 *
 * Tip Ready (`taste-receipt --ship`) requires the contact page/_v3 set to
 * import the catalog specifiers (requireRouteImport). ContactField.client.tsx
 * is the live import; this file keeps the same specifiers on the route set.
 */
import { Input as BeuiInput } from '@/components/motion/input'
import { Input as ShadcnInput } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export { BeuiInput, ShadcnInput, Select, SelectContent, SelectItem, SelectTrigger, SelectValue }

'use client'

/**
 * SITE-96. Route-local catalog install.
 *
 * reachability: entry-point — discovered by taste-receipt --ship's route-local
 * _v3 directory walk (requireRouteImport), which reads this file's SOURCE TEXT
 * by path, not by any module import. See scripts/lib/catalog-install.mjs
 * (listRoutePageV3Files + catalogInstallProblems).
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

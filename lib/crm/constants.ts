/** CRM constants shared by pages and server actions (must NOT live in a 'use server' file). */

export const CRM_STAGES = [
  'Lead', 'Seller Prospect', 'A - Hot 1-3 Months', 'B - Warm 3-6 Months', 'C - Cold 6+ Months',
  'Renter - future buyer', 'Active Client', 'Pending', 'Past Client', 'Sphere', 'Nurture',
  'Closed', 'Archive', 'Real Estate Agent', 'Vendor', 'Trash',
] as const

export const CRM_BROKERS = ['matt', 'rebecca', 'paul'] as const

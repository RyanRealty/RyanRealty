'use client'

/**
 * SITE-103. Route-local catalog install.
 *
 * Tip Ready requires this route's page/_v3 set to import the install
 * specifiers. InsightCards is the beautifului source; DigitSwap is the
 * beUI number source. House wrappers re-export the same modules.
 */
import { InsightCards } from '@/components/motion/insight-cards'
import { DigitSwap, DigitSwapReplay } from '@/components/motion/digit-swap'

void InsightCards
void DigitSwap
void DigitSwapReplay

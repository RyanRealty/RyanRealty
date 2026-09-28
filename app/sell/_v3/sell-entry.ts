/**
 * The /sell?from=cma entry flag, shared by the server page (inline pre-paint
 * script) and the client island (SellEntryFlag). A plain module on purpose: a
 * string exported from a 'use client' file reaches a server component as a
 * client reference, not as the string.
 */
export const SELL_ENTRY_ATTR = 'data-sell-entry'

/** Runs before first paint. Sets html[data-sell-entry="cma"] on from=cma. */
export const SELL_ENTRY_SCRIPT = `(function(){try{if(/[?&]from=cma(&|$)/.test(location.search)){document.documentElement.setAttribute('${SELL_ENTRY_ATTR}','cma')}}catch(e){}})();`

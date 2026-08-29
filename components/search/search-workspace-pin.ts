/** Site chrome height. V3Chrome is 3.5rem (56px). */
export const SEARCH_CHROME_PX = 56

/**
 * Pin dock + Field while the reserved workspace still overlaps the chrome
 * line. Release after the block has scrolled past so the email ask and
 * footer can enter the viewport without the fixed overlay covering them.
 */
export function shouldPinSearchWorkspace(
  naturalTop: number,
  reservedHeight: number,
  chrome = SEARCH_CHROME_PX,
): boolean {
  return naturalTop <= chrome && naturalTop + reservedHeight > chrome
}

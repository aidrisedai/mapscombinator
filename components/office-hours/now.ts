/** The current instant for a server render (pages render once per request). */
export function requestNow(): number {
  return Date.now();
}

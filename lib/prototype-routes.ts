/** Preserved development examples must never be mistaken for operational modules. */
export function isPrototypeRoute(path: string) {
  return /^\/panel\/(test-\d+|fleet-map-old-but-gold)(?:\/|$)/.test(path);
}

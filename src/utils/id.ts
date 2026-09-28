/**
 * Generates a short, collision-resistant, human-readable identifier.
 *
 * Format: `<prefix>_<epochMillis>_<base36 random>`.
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

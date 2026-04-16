/**
 * Parse backend datetime strings (which are naive UTC, no 'Z' suffix).
 * Appends 'Z' if no timezone info is present so the browser interprets as UTC.
 */
export function parseBackendDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (dateStr.includes('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) return new Date(dateStr);
  return new Date(dateStr + 'Z');
}

export function formatTimeAgo(dateStr: string): string {
  const date = parseBackendDate(dateStr);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "À l'instant";
  const s = Math.floor(diffMs / 1000);
  if (s < 30) return "À l'instant";
  if (s < 60) return `Il y a ${s}s`;
  const m = Math.floor(diffMs / 60000);
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(diffMs / 3600000);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(diffMs / 86400000);
  if (d === 1) return 'Hier';
  if (d < 7) return `Il y a ${d} jours`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function formatRelDate(dateStr: string): string {
  const date = parseBackendDate(dateStr);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 3600000) return `Il y a ${Math.max(1, Math.floor(diffMs / 60000))} min`;
  if (diffMs < 86400000) return `Il y a ${Math.floor(diffMs / 3600000)}h`;
  if (diffMs < 604800000) return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  return date.toLocaleDateString('fr-FR');
}

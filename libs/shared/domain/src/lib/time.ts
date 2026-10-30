export function minutesSince(from: number, now: number): number {
  return Math.max(0, Math.floor((now - from) / 60_000));
}

export function elapsed(from: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - from) / 1000));
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function timeOfDay(at: number): string {
  return new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

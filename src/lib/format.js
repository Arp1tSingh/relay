export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function pluralise(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

const RELATIVE_UNITS = [
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

export function formatRelativeTime(timestamp, now = Date.now()) {
  if (!timestamp) return '';

  const elapsed = Math.max(0, now - timestamp);

  for (const [unit, ms] of RELATIVE_UNITS) {
    const count = Math.floor(elapsed / ms);
    if (count >= 1) return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
  }

  return 'just now';
}
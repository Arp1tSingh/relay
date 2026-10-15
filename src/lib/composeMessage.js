export const PLATFORMS = [
  { key: 'spotify', label: 'Spotify' },
  { key: 'apple_music', label: 'Apple Music' },
  { key: 'youtube_music', label: 'YouTube Music' },
];

export function labelFor(key) {
  return PLATFORMS.find((platform) => platform.key === key)?.label ?? key;
}

export function composeMessage({ title, artist, links = {} }) {
  const lines = [];

  const header = [title, artist].filter(Boolean).join(' - ');
  if (header) lines.push(header);

  for (const platform of PLATFORMS) {
    const url = links[platform.key];
    if (url) lines.push(`${platform.label}: ${url}`);
  }

  return lines.join('\n');
}
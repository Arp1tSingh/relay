export const PRIORITY_PLATFORMS = [
  { key: 'spotify', label: 'Spotify' },
  { key: 'apple_music', label: 'Apple Music' },
  { key: 'youtube_music', label: 'YouTube Music' },
  { key: 'youtube', label: 'YouTube' },
];

export const PLATFORM_LABELS = {
  deezer: 'Deezer',
  tidal: 'TIDAL',
  amazon_music: 'Amazon Music',
  amazon_store: 'Amazon Store',
  qobuz: 'Qobuz',
  soundcloud: 'SoundCloud',
  yandex: 'Yandex Music',
  anghami: 'Anghami',
  napster: 'Napster',
  pandora: 'Pandora',
  boomplay: 'Boomplay',
  audiomack: 'Audiomack',
  shazam: 'Shazam',
  jiosaavn: 'JioSaavn',
  bandcamp: 'Bandcamp',
};

export function labelFor(key) {
  if (key === 'musiclink') return 'Anywhere';
  return PLATFORM_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function deriveYouTubeUrl(youtubeMusicUrl) {
  if (!youtubeMusicUrl) return undefined;
  const videoId = youtubeMusicUrl.match(/[?&]v=([\w-]{6,})/)?.[1];
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined;
}

export function composeMessage({ title, artist, links = {}, universal }) {
  const available = { ...links };
  if (!available.youtube) available.youtube = deriveYouTubeUrl(available.youtube_music);
  delete available.musiclink;

  const lines = [];
  const header = [title, artist].filter(Boolean).join(' - ');
  if (header) lines.push(header);

  const used = new Set();
  for (const platform of PRIORITY_PLATFORMS) {
    const url = available[platform.key];
    if (!url) continue;
    lines.push(`${platform.label}: ${url}`);
    used.add(platform.key);
  }

  const rest = Object.keys(available)
    .filter((key) => !used.has(key) && available[key])
    .sort((a, b) => labelFor(a).localeCompare(labelFor(b)));

  if (rest.length > 0) {
    lines.push('More:');
    for (const key of rest) lines.push(`${labelFor(key)}: ${available[key]}`);
  }

  if (universal) lines.push(`Anywhere: ${universal}`);

  return lines.join('\n');
}
import { formatDuration } from './format.js';

const SEARCH_ENDPOINT = 'https://itunes.apple.com/search';

export const STOREFRONT = 'US';

const EXPLICIT_BADGES = {
  explicit: 'Explicit',
  cleaned: 'Clean',
};

export function artworkAtSize(url, size = 300) {
  if (!url) return undefined;
  return url.replace(/\/\d+x\d+(bb)?\.(jpg|png)/, `/${size}x${size}bb.$2`);
}

export function cleanAppleUrl(url) {
  if (!url) return undefined;

  const [base, query] = url.split('?');
  if (!query) return base;

  const params = new URLSearchParams(query);
  params.delete('uo');

  const kept = params.toString();
  return kept ? `${base}?${kept}` : base;
}

export function explicitBadge(result) {
  return EXPLICIT_BADGES[result.trackExplicitness] ?? null;
}

export function isSingleTrack(result) {
  return result.trackCount === 1 || / - Single$/.test(result.collectionName ?? '');
}

export function normaliseTrack(result) {
  return {
    trackId: result.trackId,
    title: result.trackName,
    artist: result.artistName,
    album: result.collectionName,
    year: result.releaseDate ? new Date(result.releaseDate).getFullYear() : null,
    artwork: artworkAtSize(result.artworkUrl100, 300),
    appleMusicUrl: cleanAppleUrl(result.trackViewUrl),
    durationMs: result.trackTimeMillis ?? null,
    durationLabel: formatDuration(result.trackTimeMillis),
    badge: explicitBadge(result),
    isSingle: isSingleTrack(result),
  };
}

export function dedupeTracks(tracks) {
  const seen = new Set();
  const unique = [];

  for (const track of tracks) {
    const bucket = Number.isFinite(track.durationMs) ? Math.round(track.durationMs / 5000) : null;
    const key = bucket === null ? `id:${track.trackId}` : `${track.artist}|${track.title}|${bucket}`.toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(track);
  }

  return unique;
}

export async function searchSongs(term, { limit = 20, signal } = {}) {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    term: trimmed,
    media: 'music',
    entity: 'song',
    limit: String(limit),
    country: STOREFRONT,
  });

  const res = await fetch(`${SEARCH_ENDPOINT}?${params}`, { signal });
  if (!res.ok) throw new Error(`Search failed with status ${res.status}`);

  const body = await res.json();
  const tracks = (body.results ?? []).filter((r) => r.trackId && r.trackViewUrl).map(normaliseTrack);

  return dedupeTracks(tracks);
}
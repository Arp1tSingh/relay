const SEARCH_ENDPOINT = 'https://itunes.apple.com/search';

export const STOREFRONT = 'US';

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

export function normaliseTrack(result) {
  return {
    trackId: result.trackId,
    title: result.trackName,
    artist: result.artistName,
    album: result.collectionName,
    year: result.releaseDate ? new Date(result.releaseDate).getFullYear() : null,
    artwork: artworkAtSize(result.artworkUrl100, 300),
    appleMusicUrl: cleanAppleUrl(result.trackViewUrl),
    durationMs: result.trackTimeMillis,
  };
}

export async function searchSongs(term, { limit = 10, signal } = {}) {
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
  return (body.results ?? []).filter((r) => r.trackId && r.trackViewUrl).map(normaliseTrack);
}
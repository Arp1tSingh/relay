import { formatDuration } from './format.js';

const SEARCH_ENDPOINT = 'https://itunes.apple.com/search';
const LOOKUP_ENDPOINT = 'https://itunes.apple.com/lookup';

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

export function normalise(term) {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function parseQuery(term) {
  const match = term.trim().match(/^(.+?)\s+by\s+(.+)$/i);
  if (!match) return { title: normalise(term), artist: null };
  return { title: normalise(match[1]), artist: normalise(match[2]) };
}

export function titleMatches(trackName, hint) {
  if (!hint) return false;
  const name = normalise(trackName);
  return name === hint || name.startsWith(`${hint} `) || name.includes(hint);
}

export function artistMatches(artistName, hint) {
  if (!hint) return false;
  const name = normalise(artistName).replace(/ /g, '');
  const wanted = hint.replace(/ /g, '');
  return name === wanted || name.includes(wanted) || wanted.includes(name);
}

async function fetchJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`iTunes request failed with status ${res.status}`);
  return res.json();
}

async function findArtistId(artistName, signal) {
  const params = new URLSearchParams({
    term: artistName,
    entity: 'musicArtist',
    limit: '5',
    country: STOREFRONT,
  });
  const body = await fetchJson(`${SEARCH_ENDPOINT}?${params}`, signal);
  return body.results?.[0]?.artistId ?? null;
}

async function lookupArtistCatalog(artistId, signal) {
  const params = new URLSearchParams({
    id: String(artistId),
    entity: 'song',
    limit: '200',
    country: STOREFRONT,
  });
  const body = await fetchJson(`${LOOKUP_ENDPOINT}?${params}`, signal);
  return (body.results ?? []).filter((r) => r.wrapperType === 'track' && r.trackViewUrl);
}

function dominantArtistId(results) {
  const counts = new Map();
  for (const result of results.slice(0, 5)) {
    if (!result.artistId) continue;
    counts.set(result.artistId, (counts.get(result.artistId) ?? 0) + 1);
  }

  let best = null;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

async function searchArtistCatalog({ artistHint, results, titleHint, signal }) {
  let artistId = artistHint ? await findArtistId(artistHint, signal) : null;
  if (!artistId) artistId = dominantArtistId(results);
  if (!artistId) return [];

  const catalog = await lookupArtistCatalog(artistId, signal);

  return catalog
    .filter((track) => (titleHint ? titleMatches(track.trackName, titleHint) : normalise(track.artistName) === artistHint))
    .slice(0, 5);
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

  const body = await fetchJson(`${SEARCH_ENDPOINT}?${params}`, signal);
  const results = (body.results ?? []).filter((r) => r.trackId && r.trackViewUrl);

  const { title: titleHint, artist: artistHint } = parseQuery(trimmed);
  const alreadyFound =
    titleHint &&
    results.some(
      (r) => titleMatches(r.trackName, titleHint) && (!artistHint || artistMatches(r.artistName, artistHint)),
    );

  let merged = results;

  if (!alreadyFound) {
    try {
      const rescued = await searchArtistCatalog({ artistHint, results, titleHint, signal });
      if (rescued.length > 0) merged = [...rescued, ...results];
    } catch {
      /* fallback is best-effort; the primary results still stand */
    }
  }

  return dedupeTracks(merged.map(normaliseTrack));
}
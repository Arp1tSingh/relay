const API_BASE = 'https://api.musiclink.one/v2';

export class MusicLinkError extends Error {
  constructor(status, message, retryAfter = null) {
    super(message);
    this.name = 'MusicLinkError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function call(endpoint, params, timeout) {
  const key = process.env.MUSICLINK_API_KEY;
  if (!key) {
    throw new MusicLinkError(500, 'Server is missing MUSICLINK_API_KEY');
  }

  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(name, value);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
  } catch (cause) {
    if (cause?.name === 'AbortError') {
      throw new MusicLinkError(504, 'Timed out talking to MusicLink');
    }
    throw new MusicLinkError(502, 'Could not reach MusicLink');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) {
    throw new MusicLinkError(429, 'Rate limited by MusicLink', res.headers.get('retry-after'));
  }
  if (res.status === 404) {
    throw new MusicLinkError(404, 'MusicLink has no match for this track');
  }
  if (!res.ok) {
    throw new MusicLinkError(res.status, `MusicLink returned ${res.status}`);
  }

  const body = await res.json();
  if (body?.success === false) {
    throw new MusicLinkError(400, body.error || 'MusicLink rejected the request');
  }
  return body;
}

export function resolveTrack(q, timeout = 45000) {
  return call('resolve', { q }, timeout);
}

export function convertTo(q, to, timeout = 12000) {
  return call('convert', { q, to }, timeout);
}

export function platformsFromResolve(body) {
  const item = body?.data?.[0];
  if (!item) return {};
  return { ...item.platforms, ...(item.url ? { musiclink: item.url } : {}) };
}

export function urlFromConvert(body) {
  const value = body?.data?.to?.value;
  return typeof value === 'string' && value.startsWith('http') ? value : undefined;
}

export function sendJson(res, status, payload, { cacheSeconds = 604800 } = {}) {
  res.setHeader('Cache-Control', `s-maxage=${cacheSeconds}, stale-while-revalidate=86400`);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).json(payload);
}
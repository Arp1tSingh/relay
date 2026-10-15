import { platformsFromResolve, resolveTrack, sendJson } from './_lib/musiclink.js';

export const config = { maxDuration: 60 };

function readParam(req, name) {
  const raw = req.query?.[name];
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === 'string' ? raw : undefined;
}

export default async function handler(req, res) {
  const appleMusicUrl = readParam(req, 'ap');

  if (!appleMusicUrl || !/^https:\/\//i.test(appleMusicUrl)) {
    return sendJson(res, 400, { error: 'A valid Apple Music URL is required.' }, { cacheSeconds: 0 });
  }

  try {
    const body = await resolveTrack(appleMusicUrl);
    const item = body?.data?.[0];

    if (!item) {
      return sendJson(res, 404, { error: 'MusicLink has no match for this track.' }, { cacheSeconds: 60 });
    }

    return sendJson(res, 200, {
      links: platformsFromResolve(body),
      universal: item.url,
      artwork: item.image_url,
      isrc: item.isrc,
    });
  } catch (error) {
    const status = error?.status === 429 ? 429 : error?.status === 404 ? 404 : 502;

    if (status === 429) {
      return sendJson(
        res,
        429,
        { error: 'Too many lookups right now. Please try again in a moment.' },
        { cacheSeconds: 0 },
      );
    }

    return sendJson(res, status, { error: error?.message || 'Lookup failed.' }, { cacheSeconds: 60 });
  }
}
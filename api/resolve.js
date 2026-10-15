import { convertTo, sendJson, urlFromConvert } from './_lib/musiclink.js';

export const config = { maxDuration: 30 };

const TARGETS = [
  { to: 'spotify', key: 'spotify' },
  { to: 'youtube_music', key: 'youtube_music' },
];

const REQUEST_SPACING_MS = 1250;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readParam(req, name) {
  const raw = req.query?.[name];
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === 'string' ? raw : undefined;
}

export default async function handler(req, res) {
  const appleMusicUrl = readParam(req, 'ap');
  const title = readParam(req, 't');
  const artist = readParam(req, 'a');

  if (!appleMusicUrl || !/^https:\/\//i.test(appleMusicUrl)) {
    return sendJson(res, 400, { error: 'A valid Apple Music URL is required.' }, { cacheSeconds: 0 });
  }

  const links = { apple_music: appleMusicUrl };
  const missing = [];
  let rateLimited = false;

  for (const [index, target] of TARGETS.entries()) {
    if (index > 0) await sleep(REQUEST_SPACING_MS);

    try {
      const body = await convertTo(appleMusicUrl, target.to);
      const url = urlFromConvert(body);
      if (url) links[target.key] = url;
      else missing.push(target.key);
    } catch (error) {
      missing.push(target.key);
      if (error?.status === 429) rateLimited = true;
    }
  }

  if (rateLimited && missing.length === TARGETS.length) {
    return sendJson(
      res,
      429,
      { title, artist, links, missing, error: 'Too many lookups right now. Please try again in a moment.' },
      { cacheSeconds: 0 },
    );
  }

  const configured = Boolean(process.env.MUSICLINK_API_KEY);

  return sendJson(res, 200, {
    title,
    artist,
    links,
    missing,
    warning: configured
      ? undefined
      : 'MUSICLINK_API_KEY is not set on the server, so only the Apple Music link is available.',
  });
}
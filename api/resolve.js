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
  const outcomes = {};
  const missing = [];
  let rateLimited = false;

  for (const [index, target] of TARGETS.entries()) {
    if (index > 0) await sleep(REQUEST_SPACING_MS);

    try {
      const body = await convertTo(appleMusicUrl, target.to);
      const url = urlFromConvert(body);

      if (url) {
        links[target.key] = url;
        outcomes[target.key] = 'found';
      } else {
        outcomes[target.key] = 'absent';
        missing.push(target.key);
      }
    } catch (error) {
      const status = error?.status;
      const genuine = status === 404;

      outcomes[target.key] = genuine ? 'absent' : 'error';
      missing.push(target.key);
      if (status === 429) rateLimited = true;
    }
  }

  const complete = TARGETS.every((target) => outcomes[target.key] !== 'error');
  const cacheSeconds = complete ? 604800 : 0;

  if (rateLimited && missing.length === TARGETS.length) {
    return sendJson(
      res,
      429,
      { title, artist, links, missing, complete: false, error: 'Too many lookups right now. Please try again in a moment.' },
      { cacheSeconds: 0 },
    );
  }

  const configured = Boolean(process.env.MUSICLINK_API_KEY);

  return sendJson(
    res,
    200,
    {
      title,
      artist,
      links,
      missing,
      complete,
      warning: configured
        ? undefined
        : 'MUSICLINK_API_KEY is not set on the server, so only the Apple Music link is available.',
    },
    { cacheSeconds },
  );
}
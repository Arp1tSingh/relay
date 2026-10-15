import { convertTo, sendJson, urlFromConvert } from './_lib/musiclink.js';

export const config = { maxDuration: 30 };

const TARGETS = [
  { to: 'spotify', key: 'spotify' },
  { to: 'youtube_music', key: 'youtube_music' },
];

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
  const settled = await Promise.allSettled(
    TARGETS.map((target) => convertTo(appleMusicUrl, target.to).then((body) => [target.key, body])),
  );

  let rateLimited = false;
  for (const outcome of settled) {
    if (outcome.status === 'rejected') {
      if (outcome.reason?.status === 429) rateLimited = true;
      continue;
    }
    const [key, body] = outcome.value;
    const url = urlFromConvert(body);
    if (url) links[key] = url;
  }

  const missing = TARGETS.map((t) => t.key).filter((key) => !links[key]);

  if (rateLimited) {
    return sendJson(
      res,
      429,
      { title, artist, links, universal: null, missing, error: 'Too many lookups right now. Please try again in a moment.' },
      { cacheSeconds: 0 },
    );
  }

  const configured = Boolean(process.env.MUSICLINK_API_KEY);

  return sendJson(res, 200, {
    title,
    artist,
    links,
    universal: null,
    missing,
    warning: configured
      ? undefined
      : 'MUSICLINK_API_KEY is not set on the server, so only the Apple Music link is available.',
  });
}
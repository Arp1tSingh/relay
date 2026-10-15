const PREFIX = 'songrelay:v1:track:';
const VERSION = 1;

export const LINKS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const HISTORY_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const MAX_RECORDS = 300;

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function keyFor(trackId) {
  return `${PREFIX}${trackId}`;
}

function readAll() {
  const store = storage();
  if (!store) return [];

  const records = [];

  try {
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;

      const raw = store.getItem(key);
      if (!raw) continue;

      try {
        const record = JSON.parse(raw);
        if (record && record.v === VERSION && record.trackId) records.push(record);
      } catch {
        store.removeItem(key);
      }
    }
  } catch {
    return [];
  }

  return records;
}

function writeAll(records) {
  const store = storage();
  if (!store) return;

  try {
    const existing = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && key.startsWith(PREFIX)) existing.push(key);
    }
    for (const key of existing) store.removeItem(key);
    for (const record of records) store.setItem(keyFor(record.trackId), JSON.stringify(record));
  } catch {
    /* quota exceeded or storage blocked; cache is best-effort */
  }
}

function activityOf(record) {
  return Math.max(record.resolvedAt ?? 0, record.sharedAt ?? 0);
}

function prune(records, now) {
  return records
    .filter((record) => {
      const linksFresh = now - (record.resolvedAt ?? 0) <= LINKS_TTL_MS;
      const historyFresh = record.sharedAt && now - record.sharedAt <= HISTORY_TTL_MS;
      return linksFresh || historyFresh;
    })
    .sort((a, b) => activityOf(b) - activityOf(a))
    .slice(0, MAX_RECORDS);
}

function upsert(patch, now) {
  const records = readAll();
  const index = records.findIndex((record) => record.trackId === patch.trackId);

  if (index === -1) {
    records.push({ v: VERSION, ...patch });
  } else {
    records[index] = { ...records[index], ...patch, v: VERSION };
  }

  writeAll(prune(records, now));
}

export function readLinks(trackId, now = Date.now()) {
  const record = readAll().find((entry) => entry.trackId === trackId);
  if (!record?.links || !record.resolvedAt) return null;
  if (now - record.resolvedAt > LINKS_TTL_MS) return null;
  return record.links;
}

export function readHistory(now = Date.now()) {
  return readAll()
    .filter((record) => record.sharedAt && now - record.sharedAt <= HISTORY_TTL_MS)
    .sort((a, b) => (b.sharedAt ?? 0) - (a.sharedAt ?? 0));
}

export function recordResolve(track, links, now = Date.now()) {
  if (!track?.trackId || !links) return;
  upsert(
    {
      trackId: track.trackId,
      title: track.title,
      artist: track.artist,
      artwork: track.artwork,
      links,
      resolvedAt: now,
    },
    now,
  );
}

export function recordShare(track, links, now = Date.now()) {
  if (!track?.trackId) return;

  const existing = readAll().find((entry) => entry.trackId === track.trackId);

  upsert(
    {
      trackId: track.trackId,
      title: track.title,
      artist: track.artist,
      artwork: track.artwork,
      links: links ?? existing?.links,
      resolvedAt: existing?.resolvedAt ?? now,
      sharedAt: now,
      shareCount: (existing?.shareCount ?? 0) + 1,
    },
    now,
  );
}

export function clearHistory(now = Date.now()) {
  const records = readAll()
    .filter((record) => record.sharedAt)
    .map((record) => ({ ...record, sharedAt: 0, shareCount: 0 }));
  writeAll(prune(records, now));
}

export function clearAll() {
  const store = storage();
  if (!store) return;

  try {
    const existing = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && key.startsWith(PREFIX)) existing.push(key);
    }
    for (const key of existing) store.removeItem(key);
  } catch {
    /* storage blocked */
  }
}
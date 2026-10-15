# Music Link Sharer: Project Plan

> **Revision 2 — 2026-10-15.** The original plan depended on the Odesli / song.link
> public API, which was retired on 2026-07-31. This revision replaces it with
> MusicLink (`api.musiclink.one`) and revises the resolver design, the latency
> strategy, and Definition of Done accordingly. Changes are called out in
> §12 "What changed from Revision 1".

## 1. Problem

Friends use different streaming platforms (Apple Music, Spotify, YouTube Music).
Sharing a song as a single platform's link adds friction for everyone not on that
platform.

## 2. Solution

A serverless, search-first website. The user types a song name, picks the right
result, and gets a ready-to-send message containing links for multiple streaming
platforms.

Example output:

```
Blinding Lights - The Weeknd
Spotify: https://open.spotify.com/track/...
Apple Music: https://music.apple.com/...
YouTube Music: https://music.youtube.com/watch?v=...
YouTube: https://www.youtube.com/watch?v=...
More:
Deezer: https://www.deezer.com/track/...
TIDAL: https://listen.tidal.com/track/...
Anywhere: https://musiclink.one/song/...
```

## 3. Scope

**In scope (MVP):** search by song name, result list with artwork, platform links,
message composer with Copy and Share.

**Out of scope (later):** paste-a-link mode, albums, accounts, playlists, analytics.

## 4. How It Works

| Step | Service | Purpose |
|------|---------|---------|
| 1. Search | iTunes Search API (free, no key) | Song name -> track, artist, artwork, Apple Music URL |
| 2. Resolve | MusicLink `/v2/resolve` + `/v2/convert` | Apple Music URL -> links on every platform |
| 3. Compose | Frontend code | Build message text, copy to clipboard, share |

Flow:

```
User types query
  -> GET itunes.apple.com/search?term=...&media=music&entity=song&limit=10&country=US
  -> user taps a result
  -> render Apple Music link instantly from the iTunes data already in memory
  -> GET /api/resolve?it=<itunesTrackId>
       -> MusicLink, three calls in parallel:
            convert?to=spotify        (fast, single platform)
            convert?to=youtube_music  (fast, single platform)
            v2/resolve                (slow, full catalogue + universal page)
       -> links render into the message preview as each resolves
  -> [Copy] [Share]
```

### Why MusicLink and not Odesli

The Odesli / song.link `v1-alpha.1` namespace was retired on 2026-07-31 and now
returns `401 PUBLIC_API_ACCESS_DEPRECATED`. API keys are no longer issued to new
applicants. MusicLink is a working replacement that returns all four priority
platforms and is free to start:

- Free tier: 300 requests/month, 1/sec, 10/min, 1 key, no credit card,
  no attribution required. Commercial use is **not** included on the free tier.
- Input: an Apple Music URL, an ISRC, or a bare `apple_music` ID — all three are
  available from the iTunes response.
- Output: 21 platforms including `spotify`, `apple_music`, `youtube`,
  `youtube_music`, `deezer`, `tidal`, `amazon_music`, `qobuz`, `jiosaavn`.

The API key is sent server-side only and never enters the client bundle.

## 5. Architecture

- **Frontend:** React + Vite, static build, hosted on Vercel.
- **Serverless function:** `api/resolve.js`. Holds the API key, makes the three
  MusicLink calls, and shapes the response into a flat object the UI can render
  directly. All MusicLink request and response handling is confined to this file.
- **Search:** called directly from the browser. The iTunes Search API sends
  `access-control-allow-origin: *`, verified live, so no proxy is needed.
- **Storage:** none. Caching uses the Vercel CDN via `Cache-Control` response
  headers. An in-memory `Map` is deliberately avoided: serverless function
  instances are not shared, so it would be unreliable under concurrent load.

```
music-link-sharer/
  src/
    components/  SearchBox.jsx, ResultList.jsx, MessagePreview.jsx
    lib/         itunes.js, composeMessage.js, share.js
    App.jsx
    main.jsx
  api/
    resolve.js
  index.html
  vite.config.js
  package.json
```

### `/api/resolve` contract

Input: `?it=<itunesTrackId>`.

Output is flat and UI-ready, so the MusicLink response shape never leaks into
components:

```json
{
  "title": "Blinding Lights",
  "artist": "The Weeknd",
  "links": { "apple_music": "...", "spotify": "...", "youtube_music": "..." },
  "universal": "https://musiclink.one/song/...",
  "artwork": "...",
  "isrc": "...",
  "pending": ["spotify", "youtube_music"]
}
```

## 6. Message Composer Rules

- Header: `Title - Artist`.
- Priority platforms first, one line per platform, skipping any that are absent:
  Spotify, Apple Music, YouTube Music, YouTube.
- Remaining platforms alphabetically under a `More:` heading. This groups the long
  tail rather than flattening it — MusicLink can return 15+ platforms and a flat
  list of all of them is unwieldy to read in a chat app.
- `youtube` is **derived, not requested**: `music.youtube.com/watch?v=X` becomes
  `www.youtube.com/watch?v=X`. The same video serves both, which saves an API call.
- Final line, labelled `Anywhere`: the MusicLink universal page, which redirects
  each visitor to whichever service they actually use.
- Share button uses `navigator.share()` where available, with Copy as the fallback.

## 7. Latency Strategy

MusicLink states that the **first** lookup of an item takes 10–15 seconds because
it searches every platform, and that later lookups of the same item come from
cache. The UI is therefore progressive rather than blocking:

| State | What is shown |
|---|---|
| On tap | Apple Music link, rendered instantly from iTunes data already in memory. No network round trip. |
| Resolving | `spotify` and `youtube_music` render as skeleton rows with a spinner |
| After ~4s | A "still resolving" hint, so a cold miss does not read as a hang |
| Partial | Copy stays enabled throughout. A partial message is still useful. |

`/v2/convert` exists precisely for this: it searches a single platform and returns
much faster than a full `/v2/resolve`. It is used for the two platforms the user
actually waits for, while the slow full resolve runs in parallel to supply the
universal page and the long tail.

## 8. Caching and Rate Limits

The free tier allows 300 requests/month, 10/minute, and a cold miss costs 3
requests, so caching is mandatory rather than an optimisation.

- Cache key: the iTunes track ID, which uniquely identifies the recording.
- `Cache-Control: s-maxage=604800, stale-while-revalidate=86400` — the Vercel CDN
  absorbs all repeat lookups; a warm response is instant.
- On `429`, read the `Retry-After` header and surface "too many requests, try again
  shortly" rather than failing silently.
- On `422` from `/v2/convert`, fall back to `/v2/resolve` for that platform, as the
  MusicLink docs instruct.
- On `404`, the track was not matched; show only the links we already have.

## 9. Milestones

1. **Key** — obtain a free MusicLink API key; add it to Vercel as `MUSICLINK_API_KEY`.
2. **Setup** — Vite + React project, deploy an empty page to Vercel to confirm the pipeline.
3. **Search** — search box with debounce, iTunes results with artwork, loading and
   empty states. Request artwork at 300px by swapping the size suffix on
   `artworkUrl100`.
4. **Resolve** — `api/resolve.js` with the three-call strategy, CDN caching, and
   mapping to a clean flat list with missing platforms handled.
5. **Compose** — progressive message preview, Copy, Share, toast confirmation.
6. **Hardening** — 429 / 404 / 422 handling, cold-miss latency check, mobile layout.
7. **Polish** — PWA manifest and icons, favicon, basic SEO, README.

## 10. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| MusicLink is maintained by one person (bus factor 1) | The resolver interface isolates it; Apple Music and the constructed `song.link/i/<id>` page keep working with zero dependency on it |
| Free tier is 300 requests/month with a 10/min limit | CDN caching keyed by track ID; ~100 uncached tracks per month |
| 10–15s cold lookup | Progressive render; instant on every repeat |
| Free tier excludes commercial use | This is a personal project; do not publish it commercially on the free tier |
| API key must never reach the browser | Key is read from a server-side env var inside `api/resolve.js` only |
| Wrong match (covers, remasters, live versions) | Show artwork, album and year in results so the user picks the exact track |
| Song missing on some platforms | Show only returned links; always include the universal page |
| Regional platforms not in the response | The response's own key set defines what is shown; JioSaavn and others appear automatically when available |
| Search API behaviour differs from expectation | Tested live during planning; CORS confirmed open, no proxy needed |

## 11. Open Questions

- Should the storefront be fixed to `US` (current choice) or auto-detected? The
  response content varies by region.
- Should the message support a rich preview card instead of plain text? Several
  apps render these; plain text works everywhere.
- Which platforms do friends actually use? That decides whether the `More:` list
  should be trimmed to a fixed shortlist.

## 12. What Changed from Revision 1

| Area | Revision 1 | Revision 2 |
|---|---|---|
| Resolver | Odesli / song.link `v1-alpha.1` | MusicLink `api.musiclink.one` |
| Status of resolver | Assumed working | Odesli retired 2026-07-31, verified `401 PUBLIC_API_ACCESS_DEPRECATED` |
| Latency | Not considered | Progressive render; instant Apple Music, async remainder |
| Caching | "Platform edge cache or in-memory cache" | CDN `Cache-Control` only; in-memory explicitly rejected |
| Request strategy | One resolve per tap | Three parallel calls, two of them single-platform |
| `youtube` link | Fetched from resolver | Derived from `youtube_music` |
| Message tail | Flat list | Grouped under `More:` |
| Universal fallback label | `Other: song.link/...` | `Anywhere: musiclink.one/song/...` |
| DoD item 2 | All links at once | Apple Music instant, others async |

## 13. Later Ideas

- Paste-a-link mode (any platform link -> message), which MusicLink also supports
  directly via `q`.
- Album and artist support. MusicLink already resolves all three entity types.
- PWA share target so the phone's share sheet can send a song straight to the app.
- Recent-shares history stored locally in the browser.
- ISRC-based lookups, which MusicLink documents as the most reliable input, if a
  future search source can supply ISRCs.

## 14. Definition of Done (MVP)

- Searching a song name returns relevant results in under 2 seconds on a normal
  connection.
- Selecting a result shows the Apple Music link instantly, and Spotify and YouTube
  Music links populate within roughly 15 seconds on a cold miss and instantly on
  repeat.
- Copy and Share work on both a phone and a desktop browser.
- The site is deployed on a public URL with no always-on server, and no API key is
  present in the client bundle.
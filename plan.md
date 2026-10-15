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
```

Only three platforms are requested and rendered. MusicLink can return around
twenty; everything else is ignored.

## 3. Scope

**In scope (MVP):** search by song name, result list with artwork, links for Apple
Music, Spotify and YouTube Music, message composer with Copy and Share.

**Out of scope (later):** paste-a-link mode, albums, accounts, playlists, analytics,
any platform other than the three above.

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
  -> render the Apple Music link instantly from the iTunes data already in memory
  -> GET /api/resolve?ap=<appleMusicUrl>
       -> MusicLink, two calls in parallel:
            convert?to=spotify
            convert?to=youtube_music
       -> links render into the message preview as each resolves
  -> [Copy] [Share]
```

### Why MusicLink and not Odesli

The Odesli / song.link `v1-alpha.1` namespace was retired on 2026-07-31 and now
returns `401 PUBLIC_API_ACCESS_DEPRECATED`. API keys are no longer issued to new
applicants. MusicLink is a working replacement that covers all three platforms and
is free to start:

- Free tier: 300 requests/month, 1/sec, 10/min, 1 key, no credit card,
  no attribution required. Commercial use is **not** included on the free tier.
- Input: an Apple Music URL, an ISRC, or a bare `apple_music` ID — all three are
  available from the iTunes response.
- Only `/v2/convert` is used. A full `/v2/resolve` searches every platform and
  takes 10–15 seconds on a first lookup, which would overrun the default
  serverless function timeout and is unnecessary when three platforms are wanted.

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
    _lib/musiclink.js
    resolve.js
  index.html
  vite.config.js
  package.json
```

### `/api/resolve` contract

Input: `?ap=<appleMusicUrl>`.

Output is flat and UI-ready, so the MusicLink response shape never leaks into
components:

```json
{
  "title": "Blinding Lights",
  "artist": "The Weeknd",
  "links": { "apple_music": "...", "spotify": "...", "youtube_music": "..." },
  "missing": ["spotify"],
  "warning": null
}
```

`links.apple_music` is echoed straight from the request, so the message still has
a usable link even when the API key is absent or MusicLink is unreachable.

## 6. Message Composer Rules

- Header: `Title - Artist`.
- Exactly three lines, in this fixed order, each skipped when that platform has no
  link: Spotify, Apple Music, YouTube Music.
- Share button uses `navigator.share()` where available, with Copy as the fallback.

## 7. Latency Strategy

MusicLink states that a first `/v2/resolve` takes 10–15 seconds because it
searches every platform. That endpoint is not used. `/v2/convert` searches a single
platform and returns much faster, which is why the fast path is built from two
`convert` calls rather than one `resolve`.

The UI is progressive rather than blocking:

| State | What is shown |
|---|---|
| On tap | Apple Music link, rendered instantly from iTunes data already in memory. No network round trip. |
| Resolving | `spotify` and `youtube_music` render as skeleton chips with a spinner |
| After ~4s | A "still resolving" hint, so a cold miss does not read as a hang |
| Partial | Copy stays enabled throughout. A partial message is still useful. |

## 8. Caching and Rate Limits

The free tier allows 300 requests/month and 10/minute, and a cold miss costs 2
requests, so caching is mandatory rather than an optimisation.

- Cache key: the Apple Music URL, which uniquely identifies the recording.
- `Cache-Control: s-maxage=604800, stale-while-revalidate=86400` — the Vercel CDN
  absorbs all repeat lookups; a warm response is instant.
- On `429`, read the `Retry-After` header and surface "too many requests, try again
  shortly" rather than failing silently. `429` responses are not cached.
- On `404`, the track was not matched on that platform; the line is simply omitted.
- With no API key set, the endpoint still returns 200 with the Apple Music link and
  a warning, so the app degrades rather than breaks.

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
| MusicLink is maintained by one person (bus factor 1) | Apple Music comes from iTunes and never touches MusicLink, so the app still half-works if the service disappears |
| Free tier is 300 requests/month with a 10/min limit | CDN caching keyed by track; ~150 uncached tracks per month at 2 requests each |
| Cold lookup latency | Progressive render; instant on every repeat |
| Free tier excludes commercial use | This is a personal project; do not publish it commercially on the free tier |
| API key must never reach the browser | Key is read from a server-side env var inside `api/resolve.js` only |
| Wrong match (covers, remasters, live versions) | Show artwork, album and year in results so the user picks the exact track |
| Song missing on one of the three platforms | Omit that line; the remaining links still stand |
| Search API behaviour differs from expectation | Tested live during planning; CORS confirmed open, no proxy needed |

## 11. Open Questions

- Should the storefront be fixed to `US` (current choice) or auto-detected? The
  response content varies by region.
- Should the message support a rich preview card instead of plain text? Several
  apps render these; plain text works everywhere.
- Is dropping the universal-page fallback right for the intended audience? Anyone
  on a platform outside the three has no way in. Revisit if that comes up.

## 12. What Changed from Revision 1

| Area | Revision 1 | Revision 2 |
|---|---|---|
| Resolver | Odesli / song.link `v1-alpha.1` | MusicLink `api.musiclink.one` |
| Status of resolver | Assumed working | Odesli retired 2026-07-31, verified `401 PUBLIC_API_ACCESS_DEPRECATED` |
| Platforms | Every platform returned, plus a `More:` group and a `song.link` fallback | Exactly three: Spotify, Apple Music, YouTube Music |
| Latency | Not considered | Progressive render; instant Apple Music, async remainder |
| Caching | "Platform edge cache or in-memory cache" | CDN `Cache-Control` only; in-memory explicitly rejected |
| Request strategy | One resolve per tap | Two parallel single-platform `convert` calls |
| Endpoints | One | One (`api/details.js` was added during Revision 2 to carry the long tail, then removed when scope narrowed to three platforms) |
| DoD item 2 | All links at once | Apple Music instant, others async |

## 13. Later Ideas

- Paste-a-link mode (any platform link -> message), which MusicLink also supports
  directly via `q`.
- Album and artist support. MusicLink already resolves all three entity types.
- Widening back out to more platforms, and restoring the universal-page fallback,
  if there is demand for them.
- PWA share target so the phone's share sheet can send a song straight to the app.
- Recent-shares history stored locally in the browser.
- ISRC-based lookups, which MusicLink documents as the most reliable input, if a
  future search source can supply ISRCs.

## 14. Definition of Done (MVP)

- Searching a song name returns relevant results in under 2 seconds on a normal
  connection.
- Selecting a result shows the Apple Music link instantly, and Spotify and YouTube
  Music links populate shortly afterwards on a cold miss and instantly on repeat.
- The message contains at most three links, in the order Spotify, Apple Music,
  YouTube Music, omitting any platform the song is not on.
- Copy and Share work on both a phone and a desktop browser.
- The site is deployed on a public URL with no always-on server, and no API key is
  present in the client bundle.
# SongRelay — Project Context

Everything a new contributor (or a future session) needs to work on this codebase.
Replaces the old `plan.md`, which was deleted once the architecture settled.

---

## 1. What it does

Search a song, pick the right version, and get one shareable message with links
for **Spotify, Apple Music and YouTube Music** — exactly three platforms.

Built for a small circle of friends on different streaming services. Sharing a
single-platform link leaves everyone else unable to listen.

- **Live:** https://songrelay.vercel.app
- **Repo:** https://github.com/Arp1tSingh/relay
- **Stack:** React + Vite, one Vercel serverless function, no database, no
  persistence dependencies.

---

## 2. Architecture

```
┌─ Browser ──────────────────────────────────────────────┐
│ SearchPage                                              │
│   search  ──────────────▶ iTunes Search API (CORS open) │
│   select track                                            │
│     ├─ localStorage hit? ──▶ render, no network          │
│     └─ miss ──▶ GET /api/resolve                        │
│   draft ──▶ editable message ──▶ Copy / Share           │
│                                                          │
│ RecentPage                                               │
│   history ◀── localStorage                              │
│   re-edit and re-send without any network call          │
└──────────────────────────────────────────────────────────┘
                              │
┌─ Vercel ───────────────┐   │
│ GET /api/resolve       │   │
│   CDN cache (7d)       │   │
│   └─ miss ──▶ MusicLink /v2/convert ×2 (serialised)     │
└──────────────────────────────────────────────────────────┘
```

### The three tiers that avoid spending quota

| Tier | Where | Lifetime | Cost on hit |
|---|---|---|---|
| `localStorage` | browser | 7 days (links) / 90 days (history) | zero network |
| Vercel CDN | edge | 7 days | zero MusicLink calls |
| MusicLink | upstream | — | 2 calls per cold miss |

Only a miss on **all three** spends quota. ~150 distinct tracks/month → 150 cold
lookups *ever*, not per month.

---

## 3. Data sources

### iTunes Search API — search only
`https://itunes.apple.com/search?term=…&media=music&entity=song&limit=20&country=US`

- No key required, sends `access-control-allow-origin: *`, so the browser calls
  it directly. No proxy.
- Storefront is fixed to `US`. Response content varies by region.
- `limit=20`, of which the first 5 are shown with a **Show more** button.

### MusicLink — resolution only
`https://api.musiclink.one/v2/convert` with `Authorization: Bearer <key>`

- Only `/v2/convert` is used. A full `/v2/resolve` searches every platform and
  takes 10–15s, which would overrun the Vercel function timeout and is
  unnecessary when only three platforms are wanted.
- Free tier: 300 requests/month, 1/second, 10/minute, 1 key, no card,
  no attribution required. **Commercial use is not included on the free tier.**
- Get a key at https://musiclink.one/sign-up → `MUSICLINK_API_KEY`.

### What is deliberately *not* used
Odesli / song.link. The `v1-alpha.1` namespace was retired on **2026-07-31** and
now returns `401 PUBLIC_API_ACCESS_DEPRECATED`. Scraping `song.link/i/<id>`
HTML was evaluated and rejected: it returns Apple Music, Tidal, Deezer, Amazon,
Yandex, Anghami, Napster, Boomplay and Pandora, but **never Spotify and never
YouTube Music** — the two platforms that mattered most.

---

## 4. API contract

### `GET /api/resolve?ap=<appleMusicUrl>&t=<title>&a=<artist>`

```jsonc
{
  "title": "West Coast",
  "artist": "Lana Del Rey",
  "links": {
    "apple_music": "https://music.apple.com/us/album/west-coast/1440818509?i=1440818520",
    "spotify": "https://open.spotify.com/track/5Y6nVaayzitvsD5F7nr3DV",
    "youtube_music": "https://music.youtube.com/watch?v=SNiInqEFdQk"
  },
  "missing": [],
  "complete": true,
  "warning": null          // set when the key is missing
}
```

`missing` lists platforms with no link — a song genuinely not being on Spotify is
normal, not an error.

### The `complete` flag — the most important rule in the codebase

Each target records an outcome, not just a URL:

| Outcome | Meaning | Cacheable |
|---|---|---|
| URL returned | found | yes |
| Success, no URL | not on that platform | yes |
| `404` | not on that platform | yes |
| `429` / `5xx` / timeout | transient failure | **no** |

`complete` is true when every target is cacheable. When complete the CDN gets
`s-maxage=604800`; when not, it gets `s-maxage=0`.

**Never cache a partial result.** One transient 429 would otherwise be served
from the CDN to every visitor for 7 days, and would sit in the user's
localStorage for the same period — permanently showing "no Spotify" for a song
that has one. Given the 1 req/sec limit this failure is likely, not theoretical.

---

## 5. localStorage schema

Key `songrelay:v1:track:{trackId}`. One record per track, with **independent
freshness per concern** so a 7-day link expiry does not also delete history.

```jsonc
{
  "v": 1,
  "trackId": 1440818520,
  "title": "West Coast",
  "artist": "Lana Del Rey",
  "artwork": "https://…/300x300bb.jpg",
  "links": { "apple_music": "…", "spotify": "…", "youtube_music": "…" },
  "resolvedAt": 1792070860261,  // drives the 7-day link TTL
  "sharedAt": 1792070860261,    // drives the 90-day history TTL
  "shareCount": 2
}
```

- Links expire 7 days after `resolvedAt`; history 90 days after `sharedAt`.
- Hard cap 300 records, oldest evicted first.
- Every call is wrapped in try/catch — Safari private mode throws on
  `localStorage` and the app degrades to no cache rather than crashing.
- `v1` in the key makes a future format change a one-line invalidation.

### Separate storage keys

`relay-theme` holds the light/dark preference. It keeps the old name on purpose —
renaming it would silently wipe the saved preference. New data uses the
`songrelay:v1:` prefix.

---

## 6. Key decisions and the traps behind them

Each of these was a live bug at some point. Do not "simplify" them away.

**Calls are serialised with 1250 ms spacing.** The free tier allows 1
request/second. The two `/v2/convert` calls originally ran in `Promise.all`,
which reliably returned `429` for the second and silently dropped YouTube Music
from the message.

**`cleanAppleUrl` preserves `?i=<trackId>`.** It once did `url.split('?')[0]` to
drop Apple's `&uo=4` tracking parameter, which also destroyed the track
identifier. Every Apple Music URL became an *album* URL, so MusicLink resolved
albums — producing `open.spotify.com/album/…` links and no YouTube Music line.

**`draft` is `null` until the user types; the textarea renders `draft ?? composed`.**
The previous design synced the draft in a `useEffect` keyed on the composed text.
Reselecting the *same* track from cache produced identical text, so the effect
never re-ran and the editor came up blank. The null-draft model removed the
effect and the `edited` flag entirely.

**CDN caching uses `CDN-Cache-Control` and `Vercel-CDN-Cache-Control`.** Setting
`Cache-Control` alone does nothing — Vercel rewrites it to
`public, max-age=0, must-revalidate` and `x-vercel-cache` stays `MISS` forever.
Browser caching stays at `max-age=0` so a stale payload is never served directly.

**The bottom-sheet scrim is a sibling of the card, not a child.** When nested
inside `.card`, it painted over the Copy button and swallowed taps.

**`brands.jsx` is `.jsx` because it contains JSX.** esbuild only parses JSX in
`.jsx` files; the build fails outright if this is renamed to `.js`.

**Keyboard focus is applied in an effect, not `requestAnimationFrame`.** rAF
races the React commit and leaves the focused row at `tabindex -1`.

---

## 7. Project layout

```
api/
  _lib/musiclink.js   all MusicLink request/response handling + sendJson
  resolve.js          the only endpoint; completeness tracking
src/
  App.jsx             shell: topbar, nav, theme, route switch
  components/         Brand, Link, ThemeToggle, SearchBox, ResultList,
                      MessagePreview, PlatformPill
  lib/                itunes.js, composeMessage.js, share.js, localStore.js,
                      router.js, format.js, brands.jsx
  pages/              SearchPage.jsx, RecentPage.jsx
  index.css           theme tokens + all component styles
vercel.json           build command, output dir, SPA fallback
```

**Routing** is hand-rolled in `src/lib/router.js` (`useRoute` + `popstate`).
`vercel.json` already rewrites every non-`/api` path to `index.html`, so
`/recent` deep links work with no config. Two routes did not justify
`react-router`; `dependencies` is React only.

---

## 8. UI

- **Themes** — light is the default. Tokens are CSS variables behind
  `data-theme`; an inline script in `index.html` applies the stored theme before
  first paint to avoid a flash.
- **Accent** — amber/ember (`#fbbf24 → #f97316`), used for the gradient brand
  mark, selected rows, primary button and focus rings.
- **Desktop** — two columns, `minmax(0,1fr) 380px`, card sticky at `top: 84px`.
- **Mobile** — single column, 16px gutters, 74px rows, card becomes a bottom
  sheet over a scrim, search pinned to the top.
- **Results** — `listbox` semantics with roving tabindex; ↑/↓ wrap, Home/End,
  Enter selects. Badges handle `explicit` → "Explicit" **and** `cleaned` →
  "Clean"; iTunes returns `cleaned` more often than you would expect.
- `dedupeTracks` collapses results matching on artist + title + duration
  (rounded to 5s), removing deluxe-vs-standard duplicates while keeping genuine
  variants like remixes.

---

## 9. Deployment

Vercel, Git-connected. Every push to `master` deploys.

1. Vercel → project → **Settings → Git → Connect Git Repository** → `Arp1tSingh/relay`
2. **Settings → Environment Variables** → `MUSICLINK_API_KEY` for Production
3. Redeploy

Enable **"Apply to Preview Deployments"** or PR previews will render Apple Music
links only and show a key warning.

Only one environment variable exists. The build needs none — verified by cloning
to a clean directory and building with no `.env.local` present.

---

## 10. Testing

**Unit** — `localStore` TTL boundaries, 300-record eviction, `shareCount`, and
throwing-storage paths, run in node against an in-memory `localStorage`.

**Browser** — headless Chromium via Playwright at 375px and 1440px. The cache
test asserts `apiCalls` does not increase on a repeat selection, using request
interception. Two traps when writing these:

- Grant `clipboard-read`/`clipboard-write` permissions, or Copy throws, no share
  is recorded, and the Recent page looks empty.
- After `fill()` on the search box, wait for the *new* results. A stale
  `waitForSelector` can match the previous query's rows and select the wrong
  track.

---

## 11. Known limitations

- **Preview audio** — iTunes 30s previews are `audio/x-m4p`, Apple's protected
  variant; playback in Chrome/Firefox is unverified. Deliberately not built.
  If added, give it an `onError` fallback that hides the button.
- **Global "top shared" leaderboard** — impossible without shared storage.
  `localStorage` only knows what one browser shared. `/recent` is the personal
  equivalent and was built instead.
- **Empty artwork** — iTunes returns no `artworkUrl100` for some tracks; these
  fall back to a grey placeholder.
- **Fixed US storefront** — not auto-detected.
- **No accounts, paste-a-link, albums, or playlists.**

---

## 12. Deliberately deferred: the database

A persistent store was scoped, researched and deferred. Recorded here so it is
not rediscovered from scratch.

**Recommendation: Upstash Redis**, 500K commands/month free, native `EXPIRE`,
HTTP REST so no connection pooler is needed in serverless, one-click connect from
Vercel's Storage tab. Vercel KV was deprecated and folded into Upstash. Our
usage would be ~300 commands/month (1 GET + 1 SET per cold miss) — 0.06% of the
allowance. Postgres was rejected as overkill for key-value, though it becomes
the right choice the moment analytics are wanted.

Two gotchas found in research: free Upstash databases are **archived after 30
days idle** (backed up first, with warning emails), and Neon free-tier compute
hours expire — neither matters if the store is designed to fail gracefully.

**When it lands**, the flow becomes:

```
localStorage (7d) → CDN (7d) → Redis (forever) → MusicLink
```

The critical design constraint is that **the database must stay a pure
optimization**. With no `UPSTASH_*` env vars, or when Redis is unreachable, the
endpoint must behave exactly as it does today and call MusicLink directly. The
`complete` flag already computed in `api/resolve.js` is the gate for writing to
it — the same flag that protects localStorage and the CDN.

A global top-shared page would then be a `ZINCRBY` per share (increment on the
Copy/Share click, **not** on resolve — repeat lookups never reach the server, so
counting resolves would undercount) plus a `ZREVRANGE` for `/api/top`.
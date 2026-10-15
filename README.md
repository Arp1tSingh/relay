# Music Link Sharer

Search a song, pick the right version, and send one message containing links for
Spotify, Apple Music, YouTube Music and every other platform the song is on.

Built to replace the Odesli / song.link API, which was retired on 2026-07-31.
See `plan.md` for the full design and the reasoning behind each choice.

## How it works

1. **Search** — the browser calls the iTunes Search API directly. It sends
   `access-control-allow-origin: *`, so no proxy is needed. Results are fixed to
   the `US` storefront.
2. **Resolve** — tapping a result calls `/api/resolve`, which asks MusicLink for
   the Spotify and YouTube Music links. A second call to `/api/details` fetches
   the universal page and the long tail of other platforms.
3. **Compose** — the browser builds a plain-text message and offers Copy and Share.

### Why two serverless endpoints

MusicLink states that the first lookup of an item takes 10–15 seconds because it
searches every platform, while `/v2/convert` searches a single platform and
returns much faster. A full resolve would exceed the default serverless function
timeout, so the two halves are separate endpoints:

- `api/resolve.js` — two `/v2/convert` calls in parallel. Fast. Supplies the links
  people actually wait for.
- `api/details.js` — one `/v2/resolve` call. Slow. Supplies the universal page,
  the artwork, the ISRC, and every other platform. Runs after the fast call and
  never blocks the message.

Apple Music renders instantly from the iTunes data already in the browser, so the
message is useful before either request finishes.

`youtube` is derived from `youtube_music` rather than requested — the same video
serves both, which saves an API call.

## Setup

```bash
npm install
npm run dev
```

Create a free API key at <https://musiclink.one/sign-up> (no credit card
required; 300 requests per month), then create a local env file:

```bash
cp .env.example .env.local
```

The key is read only inside `api/` and never enters the client bundle. Without it
the app still works, but only the Apple Music link is returned.

## Deploying to Vercel

```bash
vercel
vercel env add MUSICLINK_API_KEY
```

`vercel.json` builds to `dist` and routes everything except `/api/*` to
`index.html`.

## Caching

Both endpoints send `Cache-Control: s-maxage=604800, stale-while-revalidate=86400`,
so Vercel's CDN absorbs every repeat lookup. Each cold miss costs three
MusicLink requests, which makes caching necessary rather than an optimisation:
the free tier allows 300 requests per month and 10 per minute.

Responses on `429` are not cached and surface the MusicLink rate-limit message.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Build to `dist` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |

## Project layout

```
api/
  _lib/musiclink.js   All MusicLink request and response handling
  resolve.js          Fast path: Spotify + YouTube Music
  details.js          Slow path: universal page, artwork, ISRC, long tail
src/
  components/         SearchBox, ResultList, MessagePreview
  lib/                itunes.js, composeMessage.js, share.js
  App.jsx
```
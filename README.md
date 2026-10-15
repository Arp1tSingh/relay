# Music Link Sharer

Search a song, pick the right version, and send one message containing links for
Spotify, Apple Music and YouTube Music.

Built to replace the Odesli / song.link API, which was retired on 2026-07-31.
See `plan.md` for the full design and the reasoning behind each choice.

## How it works

1. **Search** — the browser calls the iTunes Search API directly. It sends
   `access-control-allow-origin: *`, so no proxy is needed. Results are fixed to
   the `US` storefront.
2. **Resolve** — tapping a result calls `/api/resolve`, which asks MusicLink for
   the Spotify and YouTube Music links. Apple Music is already known from the
   iTunes result.
3. **Compose** — the browser builds a plain-text message and offers Copy and Share.

Only the three platforms above are requested and rendered. MusicLink returns around
twenty, but nothing else is shown and nothing else is asked for.

### Why `/v2/convert` rather than `/v2/resolve`

MusicLink states that a full `/v2/resolve` searches every platform and takes 10–15
seconds on a first lookup, which would overrun the default serverless function
timeout. `/v2/convert` searches a single platform and returns much faster, so
`api/resolve.js` makes two of those in parallel — one for Spotify, one for YouTube
Music. Two requests per cold lookup instead of three.

Apple Music renders instantly from the iTunes data already in the browser, so the
message is usable before either request finishes.

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

### Option 1: Git integration (recommended)

Connect the repository once and every push to `master` deploys automatically:

1. Vercel dashboard → **Add New… → Project** → **Import** `Arp1tSingh/relay`
   (or, for an existing project, **Settings → Git → Connect Git Repository**)
2. Keep the detected settings: framework **Vite**, build `npm run build`,
   output `dist`. `vercel.json` already pins these.
3. **Settings → Environment Variables** → add `MUSICLINK_API_KEY`
4. Redeploy.

The build needs no environment variables; the key is only read at request time by
`api/resolve.js`.

### Option 2: CLI

```bash
npx vercel login
npx vercel link
npx vercel env add MUSICLINK_API_KEY
npx vercel --prod
```

### Branch previews

With the Git integration connected, every pull request gets its own preview URL
and its own environment variables, so changes can be checked before merging.

## Caching

Both endpoints send `Cache-Control: s-maxage=604800, stale-while-revalidate=86400`,
so Vercel's CDN absorbs every repeat lookup. Each cold miss costs two MusicLink
requests, which makes caching necessary rather than an optimisation: the free tier
allows 300 requests per month and 10 per minute.

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
  resolve.js          Spotify + YouTube Music, via parallel /v2/convert calls
src/
  components/         SearchBox, ResultList, MessagePreview
  lib/                itunes.js, composeMessage.js, share.js
  App.jsx
```
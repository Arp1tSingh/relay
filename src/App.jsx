import { useCallback, useEffect, useRef, useState } from 'react';
import ResultList from './components/ResultList.jsx';
import MessagePreview from './components/MessagePreview.jsx';
import SearchBox from './components/SearchBox.jsx';
import { composeMessage, PLATFORMS } from './lib/composeMessage.js';
import { searchSongs } from './lib/itunes.js';
import { canShare, copyText, shareOrCopy } from './lib/share.js';

const DEBOUNCE_MS = 300;

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [selected, setSelected] = useState(null);
  const [links, setLinks] = useState({});
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [toast, setToast] = useState(null);

  const requestIdRef = useRef(0);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearchError(null);
      setSearching(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchSongs(trimmed, { signal: controller.signal });
        setResults(found);
        setSearchError(null);
      } catch (error) {
        if (error.name !== 'AbortError') {
          setResults([]);
          setSearchError('Search is unavailable right now. Please try again.');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const resolveTrack = useCallback(
    async (track) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setSelected(track);
      setLinks({ apple_music: track.appleMusicUrl });
      setResolveError(null);
      setWarning(null);
      setResolving(true);

      const params = new URLSearchParams({ ap: track.appleMusicUrl, t: track.title, a: track.artist });

      try {
        const res = await fetch(`/api/resolve?${params}`);
        const body = await res.json();
        if (requestIdRef.current !== requestId) return;

        if (body?.warning) setWarning(body.warning);
        if (body?.links) setLinks((current) => ({ ...current, ...body.links }));

        if (res.status === 429) {
          setResolveError(body?.error ?? 'Too many lookups right now. Please try again in a moment.');
        } else if (!res.ok && body?.error) {
          setResolveError(body.error);
        }
      } catch {
        if (requestIdRef.current === requestId) {
          setResolveError('Could not reach the server, so only Apple Music is shown.');
        }
      }

      if (requestIdRef.current === requestId) setResolving(false);
    },
    [],
  );

  const message = selected ? composeMessage({ title: selected.title, artist: selected.artist, links }) : '';

  const pendingKeys = resolving ? PLATFORMS.map((p) => p.key).filter((key) => !links[key]) : [];

  const handleCopy = useCallback(async () => {
    try {
      await copyText(message);
      showToast('Message copied to clipboard');
    } catch {
      showToast('Could not copy automatically — select the text and copy it manually');
    }
  }, [message, showToast]);

  const handleShare = useCallback(async () => {
    try {
      const outcome = await shareOrCopy({ title: selected ? `${selected.title} - ${selected.artist}` : '', text: message });
      showToast(outcome === 'shared' ? 'Shared' : 'Message copied to clipboard');
    } catch (error) {
      if (error?.name !== 'AbortError') showToast('Sharing was cancelled');
    }
  }, [message, selected, showToast]);

  return (
    <main className="app">
      <header className="hero">
        <h1>Music Link Sharer</h1>
        <p>Search a song, pick the right version, and send one message with links for every platform.</p>
      </header>

      <SearchBox value={query} onChange={setQuery} busy={searching} />

      <ResultList
        results={results}
        loading={searching}
        error={searchError}
        hasQuery={query.trim().length > 0}
        selectedId={selected?.trackId}
        onSelect={resolveTrack}
      />

      <MessagePreview
        track={selected}
        message={message}
        pendingKeys={pendingKeys}
        resolving={resolving}
        error={resolveError}
        warning={warning}
        onCopy={handleCopy}
        onShare={handleShare}
        shareAvailable={canShare()}
      />

      <div className="toast-slot" role="status" aria-live="polite">
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    </main>
  );
}
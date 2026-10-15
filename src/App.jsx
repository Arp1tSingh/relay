import { useCallback, useEffect, useRef, useState } from 'react';
import Brand from './components/Brand.jsx';
import MessagePreview from './components/MessagePreview.jsx';
import ResultList from './components/ResultList.jsx';
import SearchBox from './components/SearchBox.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import { composeMessage, PLATFORMS } from './lib/composeMessage.js';
import { searchSongs } from './lib/itunes.js';
import { canShare, copyText, shareOrCopy } from './lib/share.js';

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 5;
const COPIED_MS = 2000;
const THEME_KEY = 'relay-theme';

function readTheme() {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export default function App() {
  const [theme, setTheme] = useState(readTheme);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [selected, setSelected] = useState(null);
  const [links, setLinks] = useState({});
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [draft, setDraft] = useState('');
  const [edited, setEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const requestIdRef = useRef(0);
  const toastTimerRef = useRef(null);
  const copiedTimerRef = useRef(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage unavailable, theme still applies for this session */
    }
  }, [theme]);

  useEffect(
    () => () => {
      clearTimeout(toastTimerRef.current);
      clearTimeout(copiedTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query]);

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

  const resolveTrack = useCallback(async (track) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setSelected(track);
    setLinks({ apple_music: track.appleMusicUrl });
    setDraft('');
    setEdited(false);
    setResolveError(null);
    setWarning(null);
    setResolving(true);
    setSheetOpen(true);

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
  }, []);

const composed = selected ? composeMessage({ title: selected.title, artist: selected.artist, links }) : '';

useEffect(() => {
    if (edited) return;
    setDraft(composed);
  }, [composed, edited]);

  const handleDraftChange = useCallback((value) => {
    setDraft(value);
    setEdited(true);
  }, []);

  const messageToSend = draft;

  const pendingKeys = resolving ? PLATFORMS.map((p) => p.key).filter((key) => !links[key]) : [];

  const handleCopy = useCallback(async () => {
    try {
      await copyText(messageToSend);
      setCopied(true);
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      showToast('Could not copy automatically — select the text and copy it manually');
    }
  }, [messageToSend, showToast]);

  const handleShare = useCallback(async () => {
    try {
      const outcome = await shareOrCopy({
        title: selected ? `${selected.title} - ${selected.artist}` : '',
        text: messageToSend,
      });
      showToast(outcome === 'shared' ? 'Shared' : 'Message copied to clipboard');
    } catch (error) {
      if (error?.name !== 'AbortError') showToast('Sharing was cancelled');
    }
  }, [messageToSend, selected, showToast]);

  return (
    <div className="app">
      <header className="topbar">
        <Brand />
        <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
      </header>

      <SearchBox value={query} onChange={setQuery} busy={searching} resultCount={results.length} />

      <div className="layout">
        <section className="results-pane">
          <ResultList
            results={results}
            loading={searching}
            error={searchError}
            hasQuery={query.trim().length > 0}
            selectedId={selected?.trackId}
            onSelect={resolveTrack}
            visibleCount={visibleCount}
            onShowMore={() => setVisibleCount((c) => c + PAGE_SIZE)}
          />

          <footer className="footer">
            Music Link Sharer · <a href="https://musiclink.one" target="_blank" rel="noopener noreferrer">Powered by MusicLink</a>
          </footer>
        </section>

        <aside className="card-pane">
          {selected ? (
            <span
              className={`scrim${sheetOpen ? ' scrim--on' : ''}`}
              onClick={() => setSheetOpen(false)}
              aria-hidden="true"
            />
          ) : null}

          <MessagePreview
            track={selected}
            links={links}
            draft={draft}
            onDraftChange={handleDraftChange}
            pendingKeys={pendingKeys}
            resolving={resolving}
            error={resolveError}
            warning={warning}
            onCopy={handleCopy}
            onShare={handleShare}
            shareAvailable={canShare()}
            copied={copied}
            sheetOpen={sheetOpen}
            onClose={() => setSheetOpen(false)}
          />
        </aside>
      </div>

      <div className="toast-slot" role="status" aria-live="polite">
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    </div>
  );
}
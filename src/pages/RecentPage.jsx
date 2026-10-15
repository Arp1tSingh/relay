import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MessagePreview from '../components/MessagePreview.jsx';
import { composeMessage } from '../lib/composeMessage.js';
import { formatRelativeTime } from '../lib/format.js';
import { clearHistory, readHistory, readLinks, recordShare } from '../lib/localStore.js';
import { canShare, copyText, shareOrCopy } from '../lib/share.js';

const COPIED_MS = 2000;

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <path d="M4 12.5l5.5 5.5L20 6.5" />
    </svg>
  );
}

export default function RecentPage() {
  const [entries, setEntries] = useState(() => readHistory());
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);

  const copiedTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  const active = useMemo(
    () => entries.find((entry) => entry.trackId === activeId) ?? null,
    [entries, activeId],
  );

  const showToast = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(
    () => () => {
      clearTimeout(copiedTimerRef.current);
      clearTimeout(toastTimerRef.current);
    },
    [],
  );

  const composed = useMemo(() => {
    if (!active) return '';
    const links = readLinks(active.trackId) ?? active.links ?? {};
    return composeMessage({ title: active.title, artist: active.artist, links });
  }, [active]);

  const messageValue = draft ?? composed;

  const openEntry = (entry) => {
    setDraft(null);
    setActiveId(entry.trackId);
  };

  const closeEntry = () => {
    setDraft(null);
    setActiveId(null);
  };

  const handleDraftChange = (value) => {
    setDraft(value);
  };

  const markShared = useCallback(() => {
    if (!active) return;
    recordShare(active, readLinks(active.trackId) ?? active.links);
    setEntries(readHistory());
  }, [active]);

  const handleCopy = useCallback(async () => {
    try {
      await copyText(messageValue);
      setCopied(true);
      markShared();
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      showToast('Could not copy automatically — select the text and copy it manually');
    }
  }, [messageValue, markShared, showToast]);

  const handleShare = useCallback(async () => {
    try {
      const outcome = await shareOrCopy({
        title: active ? `${active.title} - ${active.artist}` : '',
        text: messageValue,
      });
      if (outcome !== 'shared') return;
      markShared();
      showToast('Shared');
    } catch (error) {
      if (error?.name !== 'AbortError') showToast('Sharing was cancelled');
    }
  }, [messageValue, active, markShared, showToast]);

  const handleClear = () => {
    clearHistory();
    setEntries(readHistory());
    setActiveId(null);
    showToast('History cleared');
  };

  if (entries.length === 0) {
    return (
      <div className="recent">
        <p className="state">Nothing shared yet — search for a song to get started.</p>
      </div>
    );
  }

  return (
    <div className="layout">
      <section className="results-pane">
        <div className="recent__head">
          <h2>Recent shares</h2>
          <button type="button" className="showmore" onClick={handleClear}>
            Clear history
          </button>
        </div>

        <ul className="recent__list">
          {entries.map((entry) => {
            const isActive = entry.trackId === activeId;
            return (
              <li key={entry.trackId}>
                <button
                  type="button"
                  className={`result${isActive ? ' result--selected' : ''}`}
                  onClick={() => (isActive ? closeEntry() : openEntry(entry))}
                  aria-expanded={isActive}
                >
                  {entry.artwork ? (
                    <img className="result__art" src={entry.artwork} alt="" width="56" height="56" loading="lazy" />
                  ) : (
                    <span className="result__art" aria-hidden="true" />
                  )}

                  <span className="result__main">
                    <span className="result__title">{entry.title}</span>
                    <span className="result__artist">{entry.artist}</span>
                    <span className="result__sub">
                      {formatRelativeTime(entry.sharedAt)}
                      {entry.shareCount > 1 ? ` · shared ${entry.shareCount}x` : ''}
                    </span>
                  </span>

                  <span className="result__right">
                    {isActive ? (
                      <span className="result__check" aria-hidden="true">
                        <CheckIcon />
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="footer">
          SongRelay ·{' '}
          <a href="https://musiclink.one" target="_blank" rel="noopener noreferrer">
            Powered by MusicLink
          </a>
        </footer>
      </section>

      <aside className="card-pane card-pane--inline">
        {active ? (
          <MessagePreview
            key={active.trackId}
            track={active}
            links={readLinks(active.trackId) ?? active.links ?? {}}
            draft={messageValue}
            onDraftChange={handleDraftChange}
            pendingKeys={[]}
            resolving={false}
            error={null}
            warning={null}
            onCopy={handleCopy}
            onShare={handleShare}
            shareAvailable={canShare()}
            copied={copied}
            sheetOpen
            onClose={closeEntry}
          />
        ) : null}
      </aside>

      <div className="toast-slot" role="status" aria-live="polite">
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    </div>
  );
}
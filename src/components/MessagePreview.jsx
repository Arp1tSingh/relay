import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import PlatformPill from './PlatformPill.jsx';
import { PLATFORMS } from '../lib/composeMessage.js';

const SLOW_HINT_AFTER_MS = 4000;
const EDITOR_MAX_HEIGHT = 320;

function ShareIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M12 15V3M8 7l4-4 4 4" />
    </svg>
  );
}

export default function MessagePreview({
  track,
  links,
  draft,
  onDraftChange,
  pendingKeys,
  resolving,
  error,
  warning,
  onCopy,
  onShare,
  shareAvailable,
  copied,
  sheetOpen,
  onClose,
}) {
  const [showSlowHint, setShowSlowHint] = useState(false);
  const editorRef = useRef(null);

  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, EDITOR_MAX_HEIGHT)}px`;
  }, [draft]);

  useEffect(() => {
    if (!resolving) {
      setShowSlowHint(false);
      return undefined;
    }
    const timer = setTimeout(() => setShowSlowHint(true), SLOW_HINT_AFTER_MS);
    return () => clearTimeout(timer);
  }, [resolving]);

  if (!track) return null;

  const pendingSet = new Set(pendingKeys);

  return (
    <section className={`card${sheetOpen ? ' card--open' : ''}`} aria-label="Share message">
      <button type="button" className="sheet__close" onClick={onClose} aria-label="Close message">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div className="card__enter" key={track.trackId}>
        <div className="card__head">
          {track.artwork ? <img className="card__art" src={track.artwork} alt="" width="96" height="96" /> : null}
          <div>
            <h2 className="card__title">{track.title}</h2>
            <p className="card__artist">{track.artist}</p>
          </div>
        </div>

        <div className="pills">
          {PLATFORMS.map((platform) => (
            <PlatformPill
              key={platform.key}
              platform={platform}
              label={platform.label}
              url={links[platform.key]}
              pending={pendingSet.has(platform.key)}
            />
          ))}
        </div>

        <textarea
          ref={editorRef}
          className="editor"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          spellCheck="false"
          aria-label="Message to send"
        />

        {resolving ? (
          <div className="loading-more" aria-live="polite">
            <span className="loading-more__label">
              <span className="spinner" aria-hidden="true" />
              More links are loading
            </span>
            <span className="loading-more__bars" aria-hidden="true">
              <span className="loading-more__bar" />
              <span className="loading-more__bar" />
            </span>
          </div>
        ) : null}

        {resolving && showSlowHint ? (
          <p className="card__note">
            First-time lookups take a little longer. Copy works now; the rest will fill in.
          </p>
        ) : null}

        {error ? (
          <p className="state state--error" role="alert" style={{ marginTop: 12 }}>
            {error}
          </p>
        ) : null}

        {warning ? (
          <p className="state state--warn" style={{ marginTop: 12 }}>
            {warning}
          </p>
        ) : null}

        <div className="card__actions">
          <button type="button" className={`btn btn--primary${copied ? ' btn--copied' : ''}`} onClick={onCopy}>
            {copied ? 'Copied ✓' : 'Copy message'}
          </button>

          {shareAvailable ? (
            <button type="button" className="btn" onClick={onShare} aria-label="Share">
              <ShareIcon />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
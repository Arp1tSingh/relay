import { useEffect, useState } from 'react';
import { labelFor } from '../lib/composeMessage.js';

const SLOW_HINT_AFTER_MS = 4000;

export default function MessagePreview({
  track,
  message,
  pendingKeys,
  resolving,
  error,
  warning,
  onCopy,
  onShare,
  shareAvailable,
}) {
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    if (!resolving) {
      setShowSlowHint(false);
      return undefined;
    }
    const timer = setTimeout(() => setShowSlowHint(true), SLOW_HINT_AFTER_MS);
    return () => clearTimeout(timer);
  }, [resolving]);

  if (!track) return null;

  const stillWorking = pendingKeys.map((key) => labelFor(key));

  return (
    <section className="preview" aria-live="polite">
      <header className="preview__head">
        {track.artwork ? <img src={track.artwork} alt="" width="44" height="44" /> : null}
        <div>
          <h2>{track.title}</h2>
          <p>{track.artist}</p>
        </div>
      </header>

      <pre className="preview__message">{message}</pre>

      {stillWorking.length > 0 ? (
        <ul className="pending">
          {stillWorking.map((label) => (
            <li key={label} className="pending__chip">
              <span className="spinner" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      ) : null}

      {resolving && showSlowHint ? (
        <p className="preview__hint">
          First-time lookups take a little longer while every platform is searched. Copy works now, and the rest
          will fill in on its own.
        </p>
      ) : null}

      {error ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}

      {warning ? <p className="state state--warn">{warning}</p> : null}

      <div className="preview__actions">
        <button type="button" className="button button--primary" onClick={onCopy}>
          Copy message
        </button>
        <button type="button" className="button" onClick={onShare}>
          {shareAvailable ? 'Share' : 'Copy'}
        </button>
      </div>
    </section>
  );
}
import { useEffect, useRef, useState } from 'react';
import { pluralise } from '../lib/format.js';

const PAGE_SIZE = 5;

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <path d="M4 12.5l5.5 5.5L20 6.5" />
    </svg>
  );
}

function SkeletonRow() {
  return (
    <li className="result result--skeleton" aria-hidden="true">
      <span className="skeleton skeleton--art" />
      <span className="skeleton__lines">
        <span className="skeleton__line" style={{ width: '55%' }} />
        <span className="skeleton__line" style={{ width: '35%' }} />
      </span>
    </li>
  );
}

export default function ResultList({
  results,
  loading,
  error,
  hasQuery,
  selectedId,
  onSelect,
  visibleCount,
  onShowMore,
}) {
  const listRef = useRef(null);
  const shouldFocusRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const visible = results.slice(0, visibleCount);

  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  useEffect(() => {
    if (!shouldFocusRef.current) return;
    shouldFocusRef.current = false;
    const items = listRef.current?.querySelectorAll('[role="option"]');
    const el = items?.[activeIndex];
    el?.focus();
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const focusIndex = (index) => {
    shouldFocusRef.current = true;
    setActiveIndex(index);
  };

  const move = (from, delta) => {
    const next = from + delta;
    if (next < 0) return visible.length - 1;
    if (next >= visible.length) return 0;
    return next;
  };

  const handleKeyDown = (event, index) => {
    let target = null;

    if (event.key === 'ArrowDown') target = move(index, 1);
    else if (event.key === 'ArrowUp') target = move(index, -1);
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = visible.length - 1;
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(visible[index]);
      return;
    } else return;

    event.preventDefault();
    focusIndex(target);
  };

  if (loading && results.length === 0) {
    return (
      <ul className="results" aria-busy="true" aria-label="Search results">
        {Array.from({ length: PAGE_SIZE }, (_, index) => (
          <SkeletonRow key={index} />
        ))}
      </ul>
    );
  }

  if (error) {
    return (
      <p className="state state--error" role="alert">
        {error}
      </p>
    );
  }

  if (!hasQuery) return null;

  if (results.length === 0) {
    return (
      <p className="state">
        No songs found. Try adding the artist name, or check the spelling.
      </p>
    );
  }

  return (
    <>
      <ul className="results" role="listbox" aria-label="Search results" ref={listRef} aria-busy={loading || undefined}>
        {visible.map((track, index) => {
          const isSelected = track.trackId === selectedId;
          return (
            <li
              key={track.trackId}
              role="option"
              aria-selected={isSelected}
              tabIndex={index === activeIndex ? 0 : -1}
              className={`result${isSelected ? ' result--selected' : ''}`}
              onClick={() => {
                setActiveIndex(index);
                onSelect(track);
              }}
              onFocus={() => setActiveIndex(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {track.artwork ? (
                <img className="result__art" src={track.artwork} alt="" width="56" height="56" loading="lazy" />
              ) : (
                <span className="result__art" aria-hidden="true" />
              )}

              <span className="result__main">
                <span className="result__title">{track.title}</span>
                <span className="result__artist">{track.artist}</span>
                {(track.album || track.year) && (
                  <span className="result__sub">
                    {[track.album, track.year].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>

              <span className="result__right">
                {(track.badge || track.isSingle) && (
                  <span className="badges">
                    {track.isSingle && <span className="badge">Single</span>}
                    {track.badge && <span className={`badge${track.badge === 'Explicit' ? ' badge--explicit' : ''}`}>{track.badge}</span>}
                  </span>
                )}

                {track.durationLabel ? <span className="result__duration">{track.durationLabel}</span> : null}

                {isSelected ? (
                  <span className="result__check" aria-hidden="true">
                    <CheckIcon />
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      {results.length > visible.length ? (
        <button type="button" className="showmore" onClick={onShowMore}>
          Show more ({pluralise(results.length - visible.length, 'more result')})
        </button>
      ) : null}
    </>
  );
}
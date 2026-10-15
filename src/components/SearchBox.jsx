export default function SearchBox({ value, onChange, busy, resultCount }) {
  const hasValue = value.length > 0;

  return (
    <div className="searchbar">
      <div className="searchbar__field">
        <span className="searchbar__icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" focusable="false">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.6-3.6" />
          </svg>
        </span>

        <input
          id="song-search"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search a song, album or artist"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          aria-label="Search for a song"
          aria-describedby="search-helper"
        />

        {busy ? (
          <span className="searchbar__status">
            <span className="spinner" aria-hidden="true" />
            Searching
          </span>
        ) : null}

        {hasValue ? (
          <button type="button" className="searchbar__clear" onClick={() => onChange('')} aria-label="Clear search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" focusable="false">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : null}
      </div>

      <p id="search-helper" className="helper">
        Try: <b>song name + artist</b>
        {resultCount > 0 ? ` · ${resultCount} result${resultCount === 1 ? '' : 's'}` : ''}
      </p>
    </div>
  );
}
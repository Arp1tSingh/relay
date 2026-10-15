export default function ResultList({ results, loading, error, selectedId, onSelect, hasQuery }) {
  if (loading && results.length === 0) {
    return (
      <ul className="results" aria-busy="true">
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index} className="result result--skeleton">
            <div className="result__art skeleton" />
            <div className="result__lines">
              <div className="skeleton skeleton--line" />
              <div className="skeleton skeleton--line skeleton--short" />
            </div>
          </li>
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
    return <p className="state">No songs matched that search. Try a different spelling.</p>;
  }

  return (
    <ul className="results">
      {results.map((track) => {
        const isSelected = track.trackId === selectedId;
        return (
          <li key={track.trackId}>
            <button
              type="button"
              className={`result${isSelected ? ' result--selected' : ''}`}
              onClick={() => onSelect(track)}
              aria-pressed={isSelected}
            >
              {track.artwork ? (
                <img className="result__art" src={track.artwork} alt="" width="56" height="56" loading="lazy" />
              ) : (
                <div className="result__art result__art--empty" aria-hidden="true" />
              )}
              <span className="result__lines">
                <span className="result__title">{track.title}</span>
                <span className="result__meta">
                  {track.artist}
                  {track.album ? ` · ${track.album}` : ''}
                  {track.year ? ` · ${track.year}` : ''}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
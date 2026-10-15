export default function SearchBox({ value, onChange, busy }) {
  return (
    <div className="searchbox">
      <input
        id="song-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search a song, e.g. Blinding Lights"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        aria-label="Search for a song"
        aria-describedby="search-hint"
      />
      {busy ? <span className="searchbox__spinner" aria-hidden="true" /> : null}
      <p id="search-hint" className="visually-hidden">
        Results update as you type.
      </p>
    </div>
  );
}
export default function Brand() {
  return (
    <div className="brand">
      <span className="brand__mark" aria-hidden="true">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" focusable="false">
          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
        </svg>
      </span>
      <span className="brand__text">
        <p className="brand__name">SongRelay</p>
        <p className="brand__tag">One song, every platform</p>
      </span>
    </div>
  );
}
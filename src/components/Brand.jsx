export default function Brand() {
  return (
    <div className="brand">
      <span className="brand__mark" aria-hidden="true">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" focusable="false">
          <path d="M9 17.5a2.6 2.6 0 1 0 0-5.2c.35 0 .68.06.98.17V6.4l6.1-1.35v7.2a2.6 2.6 0 1 0 1.55 2.37V2.2L9 4.15v13.35c-.32-.11-.66-.17-1-.17z" />
        </svg>
      </span>
      <span className="brand__text">
        <p className="brand__name">Music Link Sharer</p>
        <p className="brand__tag">One song, every platform</p>
      </span>
    </div>
  );
}
export default function ThemeToggle({ theme, onToggle }) {
  const nextLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button type="button" className="theme-toggle" onClick={onToggle} aria-label={nextLabel} title={nextLabel}>
      {theme === 'dark' ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" focusable="false">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" focusable="false">
          <path d="M20.7 14.6A8.6 8.6 0 0 1 9.4 3.3a.9.9 0 0 0-1.2-1.1A10 10 0 1 0 21.8 13.7a.9.9 0 0 0-1.1-1.1z" />
        </svg>
      )}
    </button>
  );
}
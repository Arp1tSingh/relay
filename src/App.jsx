import { useEffect, useState } from 'react';
import Brand from './components/Brand.jsx';
import Link from './components/Link.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import RecentPage from './pages/RecentPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import { useRoute } from './lib/router.js';

const THEME_KEY = 'relay-theme';

function readTheme() {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export default function App() {
  const [theme, setTheme] = useState(readTheme);
  const [path, navigate] = useRoute();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage unavailable, theme still applies for this session */
    }
  }, [theme]);

  const isRecent = path.startsWith('/recent');

  return (
    <div className="app">
      <header className="topbar">
        <Brand />
        <div className="topbar__actions">
          <nav className="nav" aria-label="Main">
            <Link to="/" navigate={navigate} className={`nav__link${!isRecent ? ' nav__link--active' : ''}`}>
              Search
            </Link>
            <Link
              to="/recent"
              navigate={navigate}
              className={`nav__link${isRecent ? ' nav__link--active' : ''}`}
            >
              Recent
            </Link>
          </nav>
          <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
        </div>
      </header>

      {isRecent ? <RecentPage /> : <SearchPage />}
    </div>
  );
}
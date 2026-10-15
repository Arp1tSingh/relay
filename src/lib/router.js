import { useCallback, useEffect, useState } from 'react';

export function useRoute() {
  const [path, setPath] = useState(() =>
    typeof window === 'undefined' ? '/' : window.location.pathname,
  );

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to) => {
    if (window.location.pathname === to) return;
    window.history.pushState({}, '', to);
    setPath(to);
  }, []);

  return [path, navigate];
}
import { useEffect, useState } from 'react';

/** Hash routes (#/word/mitigate) need no server rewrites, so the app works on any static host. */
export function parseHash(hash = location.hash): string[] {
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function useRoute(): string[] {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const on = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(...parts: string[]) {
  location.hash = '/' + parts.map(encodeURIComponent).join('/');
}

export function back(fallback = '') {
  if (history.length > 1) history.back();
  else go(fallback);
}

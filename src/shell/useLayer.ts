import { useLocation } from 'react-router-dom';

/** Which layer the chrome is serving. Layer 2 lives under /spread/*. */
export function useCurrentLayer(): 'flatplan' | 'spread' {
  const { pathname } = useLocation();
  return pathname.startsWith('/spread') ? 'spread' : 'flatplan';
}

export function useIsWide(): boolean {
  return useMediaQuery('(min-width: 760px)');
}

import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

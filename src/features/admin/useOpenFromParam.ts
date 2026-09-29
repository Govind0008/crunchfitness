import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/** `?new=1` / `?add=1` links (quick actions, the command palette) open a page's create drawer. */
export function useOpenFromParam(onOpen: () => void, keys: string[] = ['new', 'add']) {
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (!keys.some((k) => params.get(k) === '1')) return;
    onOpen();
    setParams((p) => { const n = new URLSearchParams(p); keys.forEach((k) => n.delete(k)); return n; }, { replace: true });
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
}

import { useEffect, useState, useSyncExternalStore } from 'react';
import { readRuntimeAdapterStorageSnapshot } from '../../../../packages/browser/src/runtime/session/runtime-adapter-session';
import { OpsHealthEventsSource } from './ops-health-events-source';

const readConfig = () => readRuntimeAdapterStorageSnapshot({ durable: localStorage, session: sessionStorage });

export function useOpsHealthEvents(autoRefresh: boolean) {
  const [source] = useState(() => new OpsHealthEventsSource());
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  useEffect(() => {
    void source.start(readConfig());
    const onPageHide = (event: PageTransitionEvent) => {
      if (!event.persisted) source.stop();
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      source.stop();
    };
  }, [source]);
  useEffect(() => {
    source.setAutoRefresh(autoRefresh);
  }, [source, autoRefresh]);
  return { snapshot, refresh: () => source.refresh(readConfig()) };
}

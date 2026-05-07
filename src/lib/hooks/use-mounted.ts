'use client';

import { useSyncExternalStore } from 'react';

// Returns true after the component has mounted on the client. Use to gate
// access to browser-only APIs (localStorage, matchMedia, navigator) without
// triggering the react-hooks/set-state-in-effect lint rule that fires on the
// older useState+useEffect "did mount" pattern.
const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, onClient, onServer);
}

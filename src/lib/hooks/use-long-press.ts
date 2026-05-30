'use client';

import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';

// Long-press gesture for touch + mouse, built on pointer events. Returns props
// to spread onto the pressable element. The press fires after `delay` ms unless
// the pointer is released or moved more than `moveTolerance` px first (so a tap
// does nothing and a scroll never triggers it). `onContextMenu` is suppressed
// so the native long-press callout / right-click menu doesn't fight the gesture.
//
// Keyboard activation is intentionally left to the element's own onClick — a
// long press has no keyboard analogue, so keep the element a <button> and let
// Enter/Space open via click for accessibility.

interface LongPressOptions {
  delay?: number;
  moveTolerance?: number;
}

export function useLongPress(
  onLongPress: () => void,
  { delay = 450, moveTolerance = 10 }: LongPressOptions = {},
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    start.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      // Ignore secondary mouse buttons; touch/pen always report button 0.
      if (e.button !== 0) return;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        start.current = null;
        // Subtle haptic confirmation where supported (Android Chrome; iOS no-ops).
        navigator.vibrate?.(15);
        onLongPress();
      }, delay);
    },
    [onLongPress, delay],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!start.current) return;
      const dx = Math.abs(e.clientX - start.current.x);
      const dy = Math.abs(e.clientY - start.current.y);
      // Movement past the tolerance means the user is scrolling/dragging, not
      // long-pressing — abandon the gesture.
      if (dx > moveTolerance || dy > moveTolerance) cancel();
    },
    [cancel, moveTolerance],
  );

  const onContextMenu = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu,
  };
}

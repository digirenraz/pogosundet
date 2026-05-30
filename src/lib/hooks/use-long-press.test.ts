import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLongPress } from './use-long-press';

// Minimal pointer-event stub — the hook only reads button/clientX/clientY and
// (for contextmenu) preventDefault.
function ptr(x = 0, y = 0, button = 0) {
  return { button, clientX: x, clientY: y } as unknown as React.PointerEvent;
}

describe('useLongPress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires after the delay when the pointer is held still', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, { delay: 450 }));

    result.current.onPointerDown(ptr(10, 10));
    expect(onLongPress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(450);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire if released before the delay (a tap)', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, { delay: 450 }));

    result.current.onPointerDown(ptr(10, 10));
    vi.advanceTimersByTime(200);
    result.current.onPointerUp();
    vi.advanceTimersByTime(450);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('does not fire if the pointer moves past the tolerance (a scroll)', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, { delay: 450, moveTolerance: 10 }));

    result.current.onPointerDown(ptr(10, 10));
    result.current.onPointerMove(ptr(10, 40)); // dy = 30 > tolerance
    vi.advanceTimersByTime(450);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('ignores secondary mouse buttons', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, { delay: 450 }));

    result.current.onPointerDown(ptr(10, 10, 2)); // right button
    vi.advanceTimersByTime(450);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('suppresses the native context menu', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    const preventDefault = vi.fn();
    result.current.onContextMenu({ preventDefault } as unknown as React.MouseEvent);
    expect(preventDefault).toHaveBeenCalled();
  });
});

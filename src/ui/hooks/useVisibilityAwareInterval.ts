import { useEffect, useRef } from 'react';

interface VisibilityIntervalOptions {
  runImmediately?: boolean;
  runOnVisible?: boolean;
}

/**
 * A setTimeout-based interval that fully sleeps while the document is hidden.
 * It avoids background polling churn and resumes from a fresh cadence when visible.
 */
export function useVisibilityAwareInterval(
  callback: () => void,
  delayMs: number,
  enabled = true,
  options: VisibilityIntervalOptions = {},
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled || !Number.isFinite(delayMs) || delayMs <= 0) return undefined;
    let timer: number | null = null;
    let disposed = false;

    const clear = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const schedule = () => {
      clear();
      if (disposed || document.hidden) return;
      timer = window.setTimeout(() => {
        timer = null;
        if (disposed || document.hidden) return;
        callbackRef.current();
        schedule();
      }, delayMs);
    };
    const onVisibility = () => {
      if (document.hidden) clear();
      else {
        if (options.runOnVisible) callbackRef.current();
        schedule();
      }
    };

    if (options.runImmediately && !document.hidden) callbackRef.current();
    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      clear();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [delayMs, enabled, options.runImmediately, options.runOnVisible]);
}

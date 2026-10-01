/**
 * GC-Stats - use-confirm-click
 *
 * React hook for a two-click confirmation on destructive actions that have
 * no dedicated confirmation dialog.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useEffect, useRef, useState } from "react";

/**
 * Two-click confirmation for a destructive action that has no dedicated
 * confirmation dialog. First click arms it (`confirming` becomes true); a
 * second click within `timeoutMs` runs `action`, any later click resets to
 * the armed state instead.
 */
export function useConfirmClick(action: () => void, timeoutMs = 3000) {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleClick() {
    if (timer.current) clearTimeout(timer.current);

    if (confirming) {
      setConfirming(false);
      action();
      return;
    }

    setConfirming(true);
    timer.current = setTimeout(() => setConfirming(false), timeoutMs);
  }

  return { confirming, handleClick };
}

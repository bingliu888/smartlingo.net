"use client";

import { useCallback, useEffect, useState } from "react";

export const SMARTLINGO_REPEAT_AFTER_ME_KEY = "smartlingo-repeat-after-me";
const REPEAT_AFTER_ME_EVENT = "smartlingo:repeat-after-me";

export function repeatAfterMeEnabled(value: string | null) {
  return value === "on";
}

export function useRepeatAfterMePreference() {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    const read = () => setEnabledState(repeatAfterMeEnabled(window.localStorage.getItem(SMARTLINGO_REPEAT_AFTER_ME_KEY)));
    const sync = (event: StorageEvent) => {
      if (event.key === SMARTLINGO_REPEAT_AFTER_ME_KEY) read();
    };
    read();
    window.addEventListener("storage", sync);
    window.addEventListener(REPEAT_AFTER_ME_EVENT, read);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(REPEAT_AFTER_ME_EVENT, read);
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    window.localStorage.setItem(SMARTLINGO_REPEAT_AFTER_ME_KEY, next ? "on" : "off");
    window.dispatchEvent(new Event(REPEAT_AFTER_ME_EVENT));
  }, []);

  return [enabled, setEnabled] as const;
}

/**
 * Browser state that may contain tenant data must never survive a change of
 * principal. This module has no React dependency so request clients can use it.
 */
const AUTH_SESSION_EPOCH_KEY = "sv:auth:epoch";
const AUTH_CONTEXT_CHANGED_EVENT = "sv:auth-context-changed";

let memoryEpoch = 0;

function nextEpoch() {
  memoryEpoch = Math.max(memoryEpoch + 1, Date.now());
  return memoryEpoch;
}

export function getAuthSessionEpoch(): number {
  if (typeof window === "undefined") return memoryEpoch;
  try {
    const stored = Number(window.sessionStorage.getItem(AUTH_SESSION_EPOCH_KEY));
    if (Number.isFinite(stored) && stored > memoryEpoch) memoryEpoch = stored;
  } catch {
    // Storage can be disabled; the in-memory epoch still protects this page.
  }
  return memoryEpoch;
}

export function isCurrentAuthSessionEpoch(epoch: number) {
  return epoch === getAuthSessionEpoch();
}

function clearStorage(storage: Storage, predicate: (key: string) => boolean) {
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && predicate(key)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // A privacy-mode storage failure must not prevent logout.
  }
}

/** Removes tenant data and invalidates work started by the prior principal. */
export function resetAuthBoundClientState() {
  const epoch = nextEpoch();
  if (typeof window === "undefined") return epoch;

  try {
    // Project payloads can have dynamic keys, so clear the session store in full.
    window.sessionStorage.clear();
    window.sessionStorage.setItem(AUTH_SESSION_EPOCH_KEY, String(epoch));
  } catch {
    // The in-memory epoch remains available.
  }

  // Preserve non-sensitive preferences such as the application language.
  clearStorage(
    window.localStorage,
    (key) => key.startsWith("sv:mv:") || key.startsWith("mv:") || key.startsWith("mv-"),
  );

  window.dispatchEvent(new CustomEvent(AUTH_CONTEXT_CHANGED_EVENT, { detail: { epoch } }));
  return epoch;
}

export { AUTH_CONTEXT_CHANGED_EVENT };

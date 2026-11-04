import type { AppData } from "./domain.ts";

// Pending values are immutable React snapshots; clone only when actually writing.
export function createAutosaver(
  persist: (data: AppData) => Promise<void>,
  delay = 300,
) {
  let pending: {
    data: AppData;
    waiters: { resolve: () => void; reject: (error: unknown) => void }[];
  } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let saving = Promise.resolve();
  function flush() {
    clearTimeout(timer);
    timer = undefined;
    const batch = pending;
    pending = null;
    if (batch) {
      saving = persist(batch.data);
      saving.then(
        () => batch.waiters.forEach((w) => w.resolve()),
        (error) => batch.waiters.forEach((w) => w.reject(error)),
      );
    }
    return saving;
  }
  return {
    flush,
    schedule(data: AppData, immediate = false) {
      const result = new Promise<void>((resolve, reject) => {
        if (!pending) pending = { data, waiters: [] };
        pending.data = data;
        pending.waiters.push({ resolve, reject });
      });
      if (immediate) void flush().catch(() => {});
      else if (!timer)
        timer = setTimeout(() => {
          void flush().catch(() => {});
        }, delay);
      return result;
    },
  };
}

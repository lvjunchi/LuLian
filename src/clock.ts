export function startVisibleClock(
  onTick: (now: number) => void,
  stopAt?: number,
  page: {
    hidden: boolean;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
  } = document,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = () => {
    clearTimeout(timer);
    if (page.hidden) return;
    const now = Date.now();
    onTick(now);
    if (stopAt === undefined || now < stopAt)
      timer = setTimeout(
        tick,
        stopAt === undefined ? 1000 : Math.min(1000, stopAt - now),
      );
  };
  page.addEventListener("visibilitychange", tick);
  tick();
  return () => {
    clearTimeout(timer);
    page.removeEventListener("visibilitychange", tick);
  };
}

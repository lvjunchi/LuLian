import test from "node:test";
import assert from "node:assert/strict";
import { startVisibleClock } from "./clock.ts";

test("hidden pages stop ticking and foreground resumes from the actual clock", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  const page = Object.assign(new EventTarget(), { hidden: false });
  const ticks: number[] = [];
  const stop = startVisibleClock((now) => ticks.push(now), undefined, page);
  t.mock.timers.tick(1000);
  assert.deepEqual(ticks, [1000, 2000]);
  page.hidden = true;
  page.dispatchEvent(new Event("visibilitychange"));
  t.mock.timers.tick(5000);
  assert.equal(ticks.length, 2);
  page.hidden = false;
  page.dispatchEvent(new Event("visibilitychange"));
  assert.equal(ticks.at(-1), 7000);
  stop();
  t.mock.timers.tick(2000);
  assert.equal(ticks.length, 3);
});
test("rest timers stop scheduling after the deadline", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  const page = Object.assign(new EventTarget(), { hidden: false });
  const ticks: number[] = [];
  const stop = startVisibleClock((now) => ticks.push(now), 1500, page);
  t.mock.timers.tick(500);
  assert.deepEqual(ticks, [1000, 1500]);
  t.mock.timers.tick(10000);
  assert.equal(ticks.length, 2);
  stop();
});

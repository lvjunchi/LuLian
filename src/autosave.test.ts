import test from "node:test";
import assert from "node:assert/strict";
import { createAutosaver } from "./autosave.ts";
import { initialData } from "./domain.ts";
import type { AppData } from "./domain.ts";

test("continuous immutable input writes only the latest snapshot in the window", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const writes: AppData[] = [];
  const saver = createAutosaver(async (data) => {
    writes.push(structuredClone(data));
  });
  const base = initialData();
  const requests = [30, 60, 90].map((restSeconds) =>
    saver.schedule({ ...base, settings: { restSeconds } }),
  );
  assert.equal(writes.length, 0);
  t.mock.timers.tick(300);
  await Promise.all(requests);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].settings.restSeconds, 90);
});
test("a completion or background flush persists immediately without a duplicate delayed write", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const writes: AppData[] = [];
  const saver = createAutosaver(async (data) => {
    writes.push(data);
  });
  const base = initialData();
  const pending = saver.schedule(base);
  const latest = { ...base, settings: { restSeconds: 180 } };
  const important = saver.schedule(latest, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0], latest);
  await Promise.all([pending, important]);
  t.mock.timers.tick(1000);
  assert.equal(writes.length, 1);
  const next = saver.schedule(base);
  await saver.flush();
  await next;
  assert.equal(writes.length, 2);
});
test("all callers see a failed batch, and the next edit can retry", async () => {
  let fail = true;
  const saver = createAutosaver(async () => {
    if (fail) throw new Error("storage full");
  });
  const first = saver.schedule(initialData());
  const second = saver.schedule(initialData());
  const results = Promise.allSettled([first, second]);
  await assert.rejects(saver.flush(), /storage full/);
  assert.ok((await results).every((r) => r.status === "rejected"));
  fail = false;
  await saver.schedule(initialData(), true);
});

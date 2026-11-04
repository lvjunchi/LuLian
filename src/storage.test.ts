import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { loadData, saveData } from "./storage.ts";
import { initialData, newEntry, newWorkout } from "./domain.ts";
import { createAutosaver } from "./autosave.ts";

test("IndexedDB preserves an unfinished draft including partially entered cardio", async () => {
  const data = initialData();
  data.draft = newWorkout("进行中的训练", [newEntry(data.exercises[0])]);
  data.draft.exercises[0].sets[0].weight = "35";
  data.draft.cardio = [
    { id: "cardio", name: "跑步", minutes: "", distance: "" },
  ];
  await saveData(data);
  assert.deepEqual(await loadData(), data);
});
test("rapid autosaves are serialized and capture the input at save time", async () => {
  const data = initialData();
  const first = saveData(data);
  data.settings.restSeconds = 120;
  const second = saveData(data);
  data.settings.restSeconds = 300;
  await Promise.all([first, second]);
  assert.equal((await loadData()).settings.restSeconds, 120);
});
test("invalid persisted data is reported and a valid backup can restore it", async () => {
  const data = initialData();
  await saveData({ ...data, version: 2 } as unknown as typeof data);
  await assert.rejects(loadData());
  await saveData(data);
  assert.deepEqual(await loadData(), data);
});

test("a stale browser page cannot overwrite records saved by another page", async () => {
  const data = initialData();
  await saveData(data);
  const modulePath = "./storage.ts?other-page";
  const otherPage = (await import(modulePath)) as typeof import("./storage.ts");
  const stale = await otherPage.loadData();
  data.settings.restSeconds = 180;
  await saveData(data);
  stale.settings.restSeconds = 30;
  await assert.rejects(otherPage.saveData(stale), /另一页面/);
  assert.equal((await loadData()).settings.restSeconds, 180);
});

test("flushing buffered edits before restore cannot overwrite the restored library later", async () => {
  const saver = createAutosaver(saveData);
  const draft = initialData();
  draft.draft = newWorkout("待保存的旧草稿");
  const buffered = saver.schedule(draft);
  await saver.flush();
  await buffered;
  const restored = initialData();
  restored.settings.restSeconds = 300;
  await saveData(restored);
  await saver.flush();
  assert.deepEqual(await loadData(), restored);
});

test("buffered autosave still rejects conflicting writes from another page", async () => {
  const base = initialData();
  await saveData(base);
  const modulePath = "./storage.ts?other-page";
  const other = (await import(modulePath)) as typeof import("./storage.ts");
  const updated = await other.loadData();
  const saver = createAutosaver(saveData);
  const buffered = saver.schedule({ ...base, settings: { restSeconds: 30 } });
  const rejected = assert.rejects(buffered, /另一页面/);
  updated.settings.restSeconds = 180;
  await other.saveData(updated);
  await assert.rejects(saver.flush(), /另一页面/);
  await rejected;
  assert.equal((await loadData()).settings.restSeconds, 180);
});

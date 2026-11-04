import test from "node:test";
import assert from "node:assert/strict";
import {
  backupJSON,
  dayKey,
  doneCount,
  exportCSV,
  freshEntries,
  initialData,
  newEntry,
  newWorkout,
  parseBackup,
  previousEntry,
  validDate,
  volume,
  weekSummary,
  workoutError,
} from "./domain.ts";
import type { AppData, Workout } from "./domain.ts";

function fixture(): { data: AppData; workout: Workout } {
  const data = initialData();
  const workout = newWorkout("胸肩训练", [newEntry(data.exercises[0])]);
  workout.exercises[0].sets = [
    { id: "warm", weight: "20", reps: "10", kind: "warmup", done: true },
    { id: "work", weight: "50", reps: "8", kind: "normal", done: true },
    { id: "planned", weight: "55", reps: "6", kind: "normal", done: false },
  ];
  return { data, workout };
}
test("volume excludes warmups, unfinished sets, bodyweight and assistance", () => {
  const { workout } = fixture();
  assert.equal(volume(workout), 400);
  assert.equal(doneCount(workout), 2);
  workout.exercises.push({
    ...structuredClone(workout.exercises[0]),
    id: "bw",
    mode: "bodyweight",
  });
  workout.exercises.push({
    ...structuredClone(workout.exercises[0]),
    id: "assist",
    mode: "assisted",
  });
  assert.equal(volume(workout), 400);
});
test("reusing training makes independent sets and resets every completion flag", () => {
  const { workout } = fixture();
  const clone = freshEntries(workout.exercises);
  assert.ok(clone[0].sets.every((s) => !s.done));
  assert.notEqual(clone[0].id, workout.exercises[0].id);
  assert.notEqual(clone[0].sets[0].id, workout.exercises[0].sets[0].id);
  clone[0].sets[0].weight = "99";
  assert.equal(workout.exercises[0].sets[0].weight, "20");
});
test("history references the latest completed entry on or before the training date", () => {
  const { workout } = fixture();
  const older = {
    ...structuredClone(workout),
    id: "older",
    date: "2026-01-01",
  };
  const newer = {
    ...structuredClone(workout),
    id: "newer",
    date: "2026-01-03",
  };
  const planned = {
    ...structuredClone(workout),
    id: "empty",
    date: "2026-01-02",
    exercises: freshEntries(workout.exercises),
  };
  assert.equal(
    previousEntry([newer, older, planned], workout.exercises[0], "2026-01-02")
      ?.date,
    older.date,
  );
  assert.equal(
    previousEntry([older], workout.exercises[0], "2026-01-02", older.id),
    null,
  );
});
test("finish requires actual activity and valid input without rejecting zero load", () => {
  const { workout } = fixture();
  workout.exercises[0].sets.forEach((s) => {
    s.done = false;
  });
  assert.ok(workoutError(workout));
  const s = workout.exercises[0].sets[1];
  s.done = true;
  s.weight = "0";
  assert.equal(workoutError(workout), "");
  for (const value of ["-1", "", "NaN", "Infinity"]) {
    s.weight = value;
    assert.ok(workoutError(workout));
  }
  s.weight = "20";
  s.reps = "2.5";
  assert.ok(workoutError(workout));
});
test("full backup roundtrips templates, snapshots, draft, cardio and bodyweights", () => {
  const { data, workout } = fixture();
  data.workouts = [{ ...workout, endedAt: workout.startedAt + 3600000 }];
  data.templates = [
    {
      id: "template",
      name: "推",
      exercises: freshEntries(workout.exercises),
      note: "",
    },
  ];
  data.draft = newWorkout("未完成训练", workout.exercises);
  data.draft.cardio = [{ id: "c", name: "", minutes: "", distance: "" }];
  data.bodyweights = [{ id: "bw", date: dayKey(), kg: "70.5" }];
  assert.deepEqual(parseBackup(backupJSON(data)), data);
});
test("invalid backups are rejected before replacing existing data", () => {
  const { data, workout } = fixture();
  data.workouts = [{ ...workout, endedAt: workout.startedAt + 1000 }];
  const original = structuredClone(data);
  const corruptions = [
    (d: AppData) => {
      (d as { version: number }).version = 2;
    },
    (d: AppData) => {
      d.workouts[0].exercises[0].sets[1].weight = "-20";
    },
    (d: AppData) => {
      d.workouts[0].exercises[0].exerciseId = "missing";
    },
    (d: AppData) => {
      d.workouts.push(structuredClone(d.workouts[0]));
    },
    (d: AppData) => {
      d.workouts[0].endedAt = 0;
    },
    (d: AppData) => {
      d.workouts[0].date = "2026-02-30";
    },
  ];
  for (const corrupt of corruptions) {
    const copy = structuredClone(data);
    corrupt(copy);
    assert.throws(() => parseBackup(backupJSON(copy)));
  }
  assert.throws(() => parseBackup("{broken"));
  assert.throws(() => parseBackup('{"format":"other"}'));
  assert.deepEqual(data, original);
});
test("CSV keeps planned sets distinguishable and escapes spreadsheet formulas and quotes", () => {
  const { data, workout } = fixture();
  workout.name = '=HYPERLINK("bad")';
  workout.note = "第一行\n第二行";
  data.workouts = [{ ...workout, endedAt: workout.startedAt }];
  const csv = exportCSV(data);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes('""bad""'));
  assert.ok(csv.includes('"否"'));
  assert.ok(csv.includes('"第一行\n第二行"'));
});
test("editing history immediately changes derived totals without mutating templates", () => {
  const { data, workout } = fixture();
  data.templates = [
    {
      id: "t",
      name: "模板",
      exercises: freshEntries(workout.exercises),
      note: "",
    },
  ];
  workout.exercises[0].sets[1].weight = "60";
  assert.equal(volume(workout), 480);
  assert.equal(data.templates[0].exercises[0].sets[1].weight, "50");
});
test("dates reject impossible days and correctly handle leap years", () => {
  assert.ok(validDate("2024-02-29"));
  assert.equal(validDate("2026-02-29"), false);
  assert.equal(validDate("2026-13-01"), false);
  assert.equal(validDate("2026-1-1"), false);
});

test("reusing cardio does not count the previous duration or distance as actual activity", () => {
  const draft = newWorkout(
    "有氧",
    [],
    [{ id: "old", name: "跑步", minutes: "30", distance: "5" }],
  );
  assert.equal(draft.cardio[0].name, "跑步");
  assert.notEqual(draft.cardio[0].id, "old");
  assert.equal(draft.cardio[0].minutes, "");
  assert.equal(draft.cardio[0].distance, "");
  assert.ok(workoutError(draft));
});
test("weekly totals start on Monday and exclude earlier and future dates", () => {
  const { workout } = fixture();
  const workouts = ["2026-01-04", "2026-01-05", "2026-01-07", "2026-01-08"].map(
    (date, i) => ({ ...workout, id: String(i), date }),
  );
  const summary = weekSummary(workouts, new Date(2026, 0, 7));
  assert.equal(summary.weekDays[0], "2026-01-05");
  assert.equal(summary.weekDays[6], "2026-01-11");
  assert.deepEqual(
    summary.week.map((w) => w.date),
    ["2026-01-05", "2026-01-07"],
  );
});

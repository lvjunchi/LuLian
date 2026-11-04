export type Mode = "weight" | "bodyweight" | "assisted";
export type LiftSet = {
  id: string;
  weight: string;
  reps: string;
  kind: "normal" | "warmup";
  done: boolean;
};
export type Exercise = { id: string; name: string; muscle: string; mode: Mode };
export type Entry = {
  id: string;
  exerciseId: string;
  name: string;
  mode: Mode;
  sets: LiftSet[];
  note: string;
};
export type Cardio = {
  id: string;
  name: string;
  minutes: string;
  distance: string;
};
export type Workout = {
  id: string;
  name: string;
  date: string;
  startedAt: number;
  endedAt: number | null;
  exercises: Entry[];
  cardio: Cardio[];
  note: string;
};
export type Template = {
  id: string;
  name: string;
  exercises: Entry[];
  note: string;
};
export type AppData = {
  version: 1;
  exercises: Exercise[];
  templates: Template[];
  workouts: Workout[];
  draft: Workout | null;
  bodyweights: { id: string; date: string; kg: string }[];
  settings: { restSeconds: number };
  restUntil: number | null;
};

export const uid = (): string =>
  crypto.randomUUID?.() ??
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
export function dayKey(value: Date | number = new Date()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(`${value}T12:00:00`);
  return !Number.isNaN(d.getTime()) && dayKey(d) === value;
}
export const numberOK = (s: string, positive = false, integer = false) =>
  /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s.trim()) &&
  Number.isFinite(Number(s)) &&
  Number(s) >= (positive ? Number.MIN_VALUE : 0) &&
  Number(s) <= 100000 &&
  (!integer || Number.isInteger(Number(s)));
export function validSet(set: LiftSet, mode: Mode) {
  return (
    numberOK(set.reps, true, true) &&
    (mode === "bodyweight" || numberOK(set.weight))
  );
}
export function volume(w: Workout) {
  return w.exercises.reduce(
    (sum, e) =>
      sum +
      (e.mode === "weight"
        ? e.sets.reduce(
            (n, s) =>
              n +
              (s.done && s.kind === "normal" && validSet(s, e.mode)
                ? Number(s.weight) * Number(s.reps)
                : 0),
            0,
          )
        : 0),
    0,
  );
}
export const doneCount = (w: Workout) =>
  w.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.done && validSet(s, e.mode)).length,
    0,
  );
export const validCardio = (c: Cardio) =>
  c.name.trim() !== "" &&
  numberOK(c.minutes, true) &&
  (c.distance === "" || numberOK(c.distance, true));
export const hasActivity = (w: Workout) =>
  doneCount(w) > 0 || w.cardio.some(validCardio);
export function weekSummary(workouts: Workout[], today = new Date()) {
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + i);
    return dayKey(date);
  });
  return {
    weekDays,
    week: workouts.filter(
      (w) => w.date >= weekDays[0] && w.date <= dayKey(today) && hasActivity(w),
    ),
  };
}
export function workoutError(w: Workout) {
  if (!w.name.trim()) return "请填写训练名称";
  if (!validDate(w.date) || w.date > dayKey())
    return "请选择今天或之前的有效日期";
  if (
    w.exercises.some((e) => e.sets.some((s) => s.done && !validSet(s, e.mode)))
  )
    return "已完成的组需要有效的次数和重量";
  if (w.cardio.some((c) => !validCardio(c)))
    return "请填写有氧类型、有效时长和距离（距离可留空）";
  if (!hasActivity(w)) return "至少完成一组，或记录一项有氧运动";
  return "";
}
export function newSet(previous?: LiftSet): LiftSet {
  return {
    id: uid(),
    weight: previous?.weight ?? "",
    reps: previous?.reps ?? "",
    kind: previous?.kind ?? "normal",
    done: false,
  };
}
export function newEntry(exercise: Exercise): Entry {
  return {
    id: uid(),
    exerciseId: exercise.id,
    name: exercise.name,
    mode: exercise.mode,
    note: "",
    sets: [newSet(), newSet(), newSet()],
  };
}
export function freshEntries(entries: Entry[]) {
  return entries.map((e) => ({
    ...e,
    id: uid(),
    sets: e.sets.map((s) => newSet(s)),
  }));
}
export function newWorkout(
  name = "自由训练",
  entries: Entry[] = [],
  cardio: Cardio[] = [],
): Workout {
  return {
    id: uid(),
    name,
    date: dayKey(),
    startedAt: Date.now(),
    endedAt: null,
    exercises: freshEntries(entries),
    cardio: cardio.map((c) => ({
      id: uid(),
      name: c.name,
      minutes: "",
      distance: "",
    })),
    note: "",
  };
}
export function previousEntry(
  workouts: Workout[],
  entry: Entry,
  date: string,
  excludeId?: string,
) {
  for (const w of [...workouts]
    .filter((w) => w.id !== excludeId && w.date <= date)
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt,
    )) {
    const e = w.exercises.find(
      (e) =>
        e.exerciseId === entry.exerciseId &&
        e.mode === entry.mode &&
        e.sets.some((s) => s.done),
    );
    if (e) return { date: w.date, entry: e };
  }
  return null;
}
export function initialData(): AppData {
  const groups: [string, string[]][] = [
    [
      "胸部",
      [
        "杠铃卧推",
        "哑铃卧推（单只）",
        "上斜哑铃卧推（单只）",
        "器械夹胸",
        "俯卧撑",
      ],
    ],
    ["背部", ["高位下拉", "坐姿划船", "杠铃划船", "引体向上", "辅助引体向上"]],
    [
      "腿部",
      ["杠铃深蹲", "腿举", "罗马尼亚硬拉", "腿屈伸", "坐姿腿弯举", "提踵"],
    ],
    ["肩部", ["哑铃推举（单只）", "哑铃侧平举（单只）", "面拉"]],
    ["手臂", ["哑铃弯举（单只）", "绳索下压"]],
    ["核心", ["卷腹", "悬垂举腿"]],
  ];
  return {
    version: 1,
    exercises: groups.flatMap(([muscle, names]) =>
      names.map((name, i) => ({
        id: `${muscle}-${i}`,
        name,
        muscle,
        mode: (["引体向上", "俯卧撑", "卷腹", "悬垂举腿"].includes(name)
          ? "bodyweight"
          : name === "辅助引体向上"
            ? "assisted"
            : "weight") as Mode,
      })),
    ),
    templates: [],
    workouts: [],
    draft: null,
    bodyweights: [],
    settings: { restSeconds: 90 },
    restUntil: null,
  };
}

// Validate the whole file before replacing any local records.
export function validateData(input: unknown): AppData {
  const fail = (): never => {
    throw new Error("文件内容无效或版本不受支持，原数据未改动");
  };
  const obj = (v: unknown): Record<string, unknown> =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : fail();
  const str = (v: unknown, max = 2000): v is string =>
    typeof v === "string" && v.length <= max;
  const finite = (v: unknown): v is number =>
    typeof v === "number" &&
    Number.isFinite(v) &&
    v >= 0 &&
    v <= 8640000000000000;
  const mode = (v: unknown) =>
    ["weight", "bodyweight", "assisted"].includes(String(v));
  const array = (v: unknown, check: (v: Record<string, unknown>) => void) => {
    if (!Array.isArray(v) || v.length > 50000) fail();
    const ids = new Set();
    for (const item of v as unknown[]) {
      const o = obj(item);
      if (!str(o.id, 100) || !o.id || ids.has(o.id)) fail();
      ids.add(o.id);
      check(o);
    }
  };
  const entries = (v: unknown) =>
    array(v, (e) => {
      if (
        !str(e.exerciseId, 100) ||
        !str(e.name, 100) ||
        !e.name.trim() ||
        !mode(e.mode) ||
        !str(e.note)
      )
        fail();
      array(e.sets, (s) => {
        if (
          !str(s.weight, 30) ||
          !str(s.reps, 30) ||
          !["normal", "warmup"].includes(String(s.kind)) ||
          typeof s.done !== "boolean"
        )
          fail();
        if (s.done && !validSet(s as unknown as LiftSet, e.mode as Mode))
          fail();
      });
    });
  const workout = (w: Record<string, unknown>, history: boolean) => {
    if (
      !str(w.id, 100) ||
      !w.id ||
      !str(w.name, 100) ||
      !validDate(w.date) ||
      !finite(w.startedAt) ||
      !str(w.note)
    )
      fail();
    if (
      history
        ? !finite(w.endedAt) || (w.endedAt as number) < (w.startedAt as number)
        : w.endedAt !== null
    )
      fail();
    entries(w.exercises);
    array(w.cardio, (c) => {
      if (
        !str(c.name, 100) ||
        !str(c.minutes, 30) ||
        !str(c.distance, 30) ||
        (history && !validCardio(c as unknown as Cardio))
      )
        fail();
    });
    if (history && !hasActivity(w as unknown as Workout)) fail();
  };
  const d = obj(input);
  if (d.version !== 1) fail();
  array(d.exercises, (e) => {
    if (
      !str(e.name, 100) ||
      !e.name.trim() ||
      !str(e.muscle, 30) ||
      !mode(e.mode)
    )
      fail();
  });
  array(d.templates, (t) => {
    if (!str(t.name, 100) || !t.name.trim() || !str(t.note)) fail();
    entries(t.exercises);
  });
  array(d.workouts, (w) => workout(w, true));
  if (d.draft !== null) workout(obj(d.draft), false);
  array(d.bodyweights, (b) => {
    if (!validDate(b.date) || !str(b.kg, 30) || !numberOK(b.kg as string, true))
      fail();
  });
  const settings = obj(d.settings);
  if (
    typeof settings.restSeconds !== "number" ||
    !Number.isInteger(settings.restSeconds) ||
    settings.restSeconds < 0 ||
    settings.restSeconds > 3600
  )
    fail();
  if (d.restUntil !== null && !finite(d.restUntil)) fail();
  const data = d as unknown as AppData;
  if (data.draft && data.workouts.some((w) => w.id === data.draft!.id)) fail();
  const known = new Set(data.exercises.map((e) => e.id));
  const allEntries = [
    ...data.templates.flatMap((t) => t.exercises),
    ...data.workouts.flatMap((w) => w.exercises),
    ...(data.draft?.exercises ?? []),
  ];
  if (allEntries.some((e) => !known.has(e.exerciseId))) fail();
  return structuredClone(data);
}
export function backupJSON(data: AppData) {
  return JSON.stringify(
    { format: "lulian-backup", exportedAt: new Date().toISOString(), data },
    null,
    2,
  );
}
export function parseBackup(text: string) {
  if (text.length > 20 * 1024 * 1024)
    throw new Error("备份文件超过 20 MB，请检查是否选错文件");
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("无法读取 JSON，请选择鹿练导出的备份文件");
  }
  if (value?.format !== "lulian-backup") throw new Error("这不是鹿练备份文件");
  return validateData(value.data);
}
export function exportCSV(data: AppData) {
  const rows: unknown[][] = [
    [
      "日期",
      "训练",
      "类型",
      "动作",
      "负重口径",
      "组序号",
      "组类型",
      "重量kg",
      "次数",
      "完成",
      "有氧分钟",
      "距离km",
      "动作备注",
      "训练备注",
    ],
  ];
  for (const w of [...data.workouts].sort((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    for (const e of w.exercises)
      e.sets.forEach((s, i) =>
        rows.push([
          w.date,
          w.name,
          "力量",
          e.name,
          e.mode === "bodyweight"
            ? "自重"
            : e.mode === "assisted"
              ? "辅助重量"
              : "外部负重",
          i + 1,
          s.kind === "warmup" ? "热身" : "正式",
          e.mode === "bodyweight" ? "" : s.weight,
          s.reps,
          s.done ? "是" : "否",
          "",
          "",
          e.note,
          w.note,
        ]),
      );
    for (const c of w.cardio)
      rows.push([
        w.date,
        w.name,
        "有氧",
        c.name,
        "",
        "",
        "",
        "",
        "",
        "是",
        c.minutes,
        c.distance,
        "",
        w.note,
      ]);
  }
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

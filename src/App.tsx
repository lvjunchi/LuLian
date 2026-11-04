import { useEffect, useRef, useState } from "react";
import type {
  AppData,
  Cardio,
  Entry,
  Exercise,
  Template,
  Workout,
} from "./domain";
import {
  backupJSON,
  dayKey,
  doneCount,
  exportCSV,
  freshEntries,
  newEntry,
  newWorkout,
  numberOK,
  parseBackup,
  uid,
  validDate,
  workoutError,
} from "./domain";
import { loadData, saveData } from "./storage";
import {
  ExercisePicker,
  Icon,
  Modal,
  NoticeContext,
  WorkEditor,
  download,
  elapsed,
} from "./components";

import TrainingPage from "./pages/TrainingPage";
import PlanPage from "./pages/PlanPage";
import HistoryPage from "./pages/HistoryPage";
import StatisticsPage from "./pages/StatisticsPage";
import type { Editor, Tab } from "./components";

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveStatus, setSaveStatus] = useState("已保存到本机");
  const [tab, setTab] = useState<Tab>("train");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [settings, setSettings] = useState(false);
  const [picker, setPicker] = useState<{
    target: "draft" | "editor";
    replace?: string;
  } | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [detailId, setDetailId] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [bodyForm, setBodyForm] = useState(false);
  const [bodyDate, setBodyDate] = useState(dayKey());
  const [bodyKg, setBodyKg] = useState("");
  const [pendingBackup, setPendingBackup] = useState<AppData | null>(null);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [now, setNow] = useState(Date.now());
  const generation = useRef(0);
  const lastSaved = useRef<AppData | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const notify = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4200);
  };
  useEffect(() => {
    let mounted = true;
    loadData()
      .then((d) => {
        if (mounted) {
          lastSaved.current = d;
          setData(d);
        }
      })
      .catch(() => {
        if (mounted)
          setLoadError(
            "无法读取本机数据，请确认浏览器允许网站存储，关闭其他鹿练页面后重试。原数据不会被覆盖。",
          );
      });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (!data || data === lastSaved.current) return;
    const id = ++generation.current;
    setSaveStatus("正在保存…");
    saveData(data)
      .then(() => {
        lastSaved.current = data;
        if (id === generation.current) setSaveStatus("已保存到本机");
      })
      .catch((error: unknown) => {
        if (id === generation.current)
          setSaveStatus(
            error instanceof Error && error.message.includes("另一页面")
              ? `保存失败 · ${error.message}`
              : "保存失败 · 请立即导出备份",
          );
      });
  }, [data]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveStatus !== "已保存到本机") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveStatus]);
  if (!data)
    return (
      <div className="loading">
        <img src="./deer.svg" width="64" height="64" alt="鹿练" />
        <h1>鹿练</h1>
        <p>{loadError || "正在打开你的训练手记…"}</p>
        {loadError && (
          <>
            <button className="primary" onClick={() => location.reload()}>
              重新读取
            </button>
            <label className="recovery-label">
              或选择已有备份恢复
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    if (file.size > 20 * 1024 * 1024)
                      throw new Error("备份文件超过 20 MB");
                    const restored = parseBackup(await file.text());
                    if (
                      !confirm(
                        "当前数据无法读取。确定使用所选备份替换当前数据？",
                      )
                    )
                      return;
                    await saveData(restored);
                    lastSaved.current = restored;
                    setData(restored);
                    setSaveStatus("已保存到本机");
                  } catch (error) {
                    setLoadError(
                      error instanceof Error
                        ? error.message
                        : "恢复失败，请检查浏览器存储权限",
                    );
                  }
                }}
              />
            </label>
          </>
        )}
      </div>
    );
  const update = (fn: (d: AppData) => AppData) =>
    setData((d) => (d ? fn(d) : d));
  const draft = data.draft;
  const start = (
    name: string,
    entries: Entry[] = [],
    note = "",
    cardio: Cardio[] = [],
  ) => {
    if (draft) {
      setTab("train");
      notify("先继续或结束当前训练，再开始下一次");
      return;
    }
    update((d) => ({
      ...d,
      draft: { ...newWorkout(name, entries, cardio), note },
      restUntil: null,
    }));
    setTab("train");
    setDetailId("");
    window.scrollTo(0, 0);
  };
  const backup = () =>
    download(backupJSON(data), `鹿练备份-${dayKey()}-${Date.now()}.json`);
  const pickExercise = (e: Exercise, create = false) => {
    if (!picker) return;
    const w = picker.target === "draft" ? data.draft : editor?.workout;
    if (!w) return;
    const old = w.exercises.find((v) => v.id === picker.replace);
    if (
      old?.sets.some((s) => s.done) &&
      !confirm("替换动作会移除该动作已有的组记录，继续？")
    )
      return;
    const next = {
      ...w,
      exercises: picker.replace
        ? w.exercises.map((v) => (v.id === picker.replace ? newEntry(e) : v))
        : [...w.exercises, newEntry(e)],
    };
    if (picker.target === "draft")
      update((d) => ({
        ...d,
        ...(create ? { exercises: [...d.exercises, e] } : {}),
        draft: next,
      }));
    else {
      if (create) update((d) => ({ ...d, exercises: [...d.exercises, e] }));
      setEditor((v) => (v ? { ...v, workout: next } : v));
    }
    setPicker(null);
  };
  const saveTemplate = (w: Workout, templateId = uid()) => {
    if (!w.exercises.length) {
      notify("训练模板需要至少一个力量动作");
      return;
    }
    const t: Template = {
      id: templateId,
      name: w.name.trim(),
      exercises: freshEntries(w.exercises),
      note: w.note,
    };
    update((d) => ({
      ...d,
      templates: d.templates.some((v) => v.id === t.id)
        ? d.templates.map((v) => (v.id === t.id ? t : v))
        : [...d.templates, t],
    }));
    notify("模板已保存");
  };
  const submitEditor = () => {
    if (!editor) return;
    const w = editor.workout;
    if (!w.name.trim()) {
      notify("请填写名称");
      return;
    }
    if (editor.kind === "template") {
      if (!w.exercises.length) {
        notify("请至少添加一个动作");
        return;
      }
      saveTemplate(w, editor.templateId);
    } else {
      const error = workoutError(w);
      if (error) {
        notify(error);
        return;
      }
      if (!numberOK(editor.minutes) || Number(editor.minutes) > 1440) {
        notify("训练时长应在 0–1440 分钟之间");
        return;
      }
      const startAt = new Date(
        `${w.date}T${new Date(w.startedAt).toTimeString().slice(0, 8)}`,
      ).getTime();
      const saved = {
        ...w,
        name: w.name.trim(),
        startedAt: startAt,
        endedAt: startAt + Number(editor.minutes) * 60000,
      };
      update((d) => ({
        ...d,
        workouts:
          editor.kind === "history"
            ? d.workouts.map((v) => (v.id === w.id ? saved : v))
            : [...d.workouts, saved],
      }));
      setDetailId(saved.id);
      notify(editor.kind === "history" ? "历史记录已更新" : "补记已保存");
    }
    setEditor(null);
  };
  const finish = () => {
    if (!draft) return;
    const error = workoutError(draft);
    if (error) {
      notify(error);
      return;
    }
    const unfinished = draft.exercises.reduce(
      (n, e) => n + e.sets.filter((s) => !s.done).length,
      0,
    );
    if (
      !confirm(
        `本次已完成 ${doneCount(draft)} 组${draft.cardio.length ? `、${draft.cardio.length} 项有氧` : ""}。${unfinished ? `还有 ${unfinished} 组未完成，会保留记录但不计入统计。` : ""}结束并保存？`,
      )
    )
      return;
    const ended = { ...draft, name: draft.name.trim(), endedAt: Date.now() };
    update((d) => ({
      ...d,
      workouts: [...d.workouts, ended],
      draft: null,
      restUntil: null,
    }));
    setTab("history");
    setDetailId(ended.id);
    notify("训练完成，每一组都算数。");
    window.scrollTo(0, 0);
  };
  const pageTitle = {
    train: "今天，也为自己练一练",
    plan: "让每次出发更轻松",
    history: "每一次坚持，都有迹可循",
    chart: "慢慢来，你一直在进步",
  }[tab];
  return (
    <NoticeContext.Provider value={toast}>
      <div className="app-shell">
        <header className="app-header">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setTab("train");
            }}
          >
            <img src="./deer.svg" alt="" />
            <span>
              鹿练<small>记下每一组</small>
            </span>
          </a>
          <button
            className="icon-btn settings-btn"
            aria-label="设置与备份"
            onClick={() => setSettings(true)}
          >
            <Icon name="settings" />
          </button>
        </header>
        <main>
          <div className="page-intro">
            <span className="eyebrow">
              {new Date().toLocaleDateString("zh-CN", {
                month: "long",
                day: "numeric",
                weekday: "long",
              })}{" "}
              · 鹿角虫
            </span>
            <h1>{pageTitle}</h1>
          </div>
          {saveStatus.includes("失败") && (
            <div className="save-warning" role="alert">
              {saveStatus}
              <button onClick={backup}>导出备份</button>
              <button
                onClick={() => {
                  saveData(data)
                    .then(() => setSaveStatus("已保存到本机"))
                    .catch(() =>
                      notify("仍无法保存，请先备份并检查浏览器存储权限"),
                    );
                }}
              >
                重试保存
              </button>
            </div>
          )}
          {tab === "train" && (
            <TrainingPage
              data={data}
              now={now}
              update={update}
              start={start}
              finish={finish}
              notify={notify}
              setPicker={setPicker}
              setTab={setTab}
              setDetailId={setDetailId}
            />
          )}
          {tab === "plan" && (
            <PlanPage
              data={data}
              update={update}
              start={start}
              setEditor={setEditor}
            />
          )}
          {tab === "history" && (
            <HistoryPage
              data={data}
              detailId={detailId}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              setDetailId={setDetailId}
              start={start}
              saveTemplate={saveTemplate}
              setEditor={setEditor}
              update={update}
            />
          )}
          {tab === "chart" && (
            <StatisticsPage
              data={data}
              update={update}
              setDetailId={setDetailId}
              setTab={setTab}
              setSelectedDay={setSelectedDay}
              setBodyDate={setBodyDate}
              setBodyKg={setBodyKg}
              setBodyForm={setBodyForm}
            />
          )}
          <footer className="page-footer">
            <span className={saveStatus.includes("失败") ? "danger-text" : ""}>
              ● {saveStatus}
            </span>
            <span>鹿练 · 为自己积累</span>
          </footer>
        </main>
        {draft && data.restUntil !== null && (
          <div className="rest-bar" role="status">
            <Icon name="clock" />
            <div>
              <small>
                {data.restUntil > now ? "组间休息" : "休息结束，准备好再继续"}
              </small>
              <strong>
                {elapsed(Math.ceil(Math.max(0, data.restUntil - now) / 1000))}
              </strong>
            </div>
            <button
              onClick={() =>
                update((d) => ({
                  ...d,
                  restUntil: Math.max(Date.now(), d.restUntil ?? 0) + 30000,
                }))
              }
            >
              ＋30秒
            </button>
            <button onClick={() => update((d) => ({ ...d, restUntil: null }))}>
              {data.restUntil > now ? "跳过" : "关闭"}
            </button>
          </div>
        )}
        <nav className="bottom-nav" aria-label="主导航">
          {(
            [
              ["train", "训练"],
              ["plan", "计划"],
              ["history", "历史"],
              ["chart", "统计"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => {
                setTab(id);
                if (id === "history") setDetailId("");
                window.scrollTo(0, 0);
              }}
            >
              <Icon name={id} />
              <span>{label}</span>
              {id === "train" && draft && <i />}
            </button>
          ))}
        </nav>
        {toast && (
          <div className="toast" role="alert">
            {toast}
          </div>
        )}
        {settings && (
          <Modal title="设置与数据" onClose={() => setSettings(false)}>
            <div className="sheet-body settings-body">
              <div className="profile">
                <img src="./deer.svg" alt="" />
                <div>
                  <h3>鹿角虫的鹿练</h3>
                  <p>记下每一组，看见每一步。</p>
                </div>
                <span className="pill">v0.1</span>
              </div>
              <label>
                默认组间休息
                <select
                  value={data.settings.restSeconds}
                  onChange={(e) =>
                    update((d) => ({
                      ...d,
                      settings: { restSeconds: Number(e.target.value) },
                    }))
                  }
                >
                  {[0, 30, 60, 90, 120, 180, 300].map((s) => (
                    <option value={s} key={s}>
                      {s ? `${s} 秒` : "不自动计时"}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted small">
                计时按结束时间恢复。切换应用、锁屏后不保证声音或通知，返回页面查看剩余时间。
              </p>
              <div className="settings-section">
                <h3>数据备份</h3>
                <p>
                  数据保存在当前浏览器、当前网站地址下，不会自动同步。清理网站数据或更换地址前，请下载备份。
                </p>
                <button className="primary full" onClick={backup}>
                  <Icon name="download" size={18} />
                  下载完整 JSON 备份
                </button>
                <button
                  className="outline full"
                  onClick={() => fileInput.current?.click()}
                >
                  从备份恢复
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try {
                      if (file.size > 20 * 1024 * 1024)
                        throw new Error("备份文件超过 20 MB");
                      const restored = parseBackup(await file.text());
                      setBackupDownloaded(false);
                      setPendingBackup(restored);
                    } catch (error) {
                      notify(
                        error instanceof Error
                          ? error.message
                          : "备份读取失败，原数据未改动",
                      );
                    }
                  }}
                />
              </div>
              <div className="settings-section">
                <h3>导出分析数据</h3>
                <p>
                  CSV
                  包含训练中的逐组数据、完成状态和有氧记录；体重、模板和草稿保留在完整
                  JSON 备份中。CSV 不用于恢复。
                </p>
                <button
                  className="outline full"
                  onClick={() =>
                    download(
                      exportCSV(data),
                      `鹿练训练明细-${dayKey()}.csv`,
                      "text/csv;charset=utf-8",
                    )
                  }
                >
                  导出训练 CSV
                </button>
              </div>
              <div className="settings-section">
                <h3>记录口径</h3>
                <p>
                  重量统一为公斤。哑铃动作默认记录单只重量，杠铃记录总重量；自重和辅助重量独立统计。热身组不计入正式容量。
                </p>
              </div>
            </div>
          </Modal>
        )}
        {editor && (
          <Modal
            title={
              editor.kind === "template"
                ? "编辑训练模板"
                : editor.kind === "history"
                  ? "编辑历史训练"
                  : "补记训练"
            }
            wide
            onClose={() => {
              if (confirm("关闭编辑？这次尚未保存的修改将丢弃。"))
                setEditor(null);
            }}
          >
            <div className="sheet-body editor-body">
              <WorkEditor
                workout={editor.workout}
                history={data.workouts}
                template={editor.kind === "template"}
                onChange={(w) =>
                  setEditor((v) => (v ? { ...v, workout: w } : v))
                }
                onPick={(replace) => setPicker({ target: "editor", replace })}
                restSeconds={0}
                onRest={() => {}}
                notify={notify}
              />
              {editor.kind !== "template" && (
                <label className="duration-label">
                  训练时长（分钟）
                  <input
                    inputMode="decimal"
                    maxLength={6}
                    value={editor.minutes}
                    onChange={(e) =>
                      setEditor((v) =>
                        v ? { ...v, minutes: e.target.value } : v,
                      )
                    }
                  />
                </label>
              )}
              <button className="primary full" onClick={submitEditor}>
                保存{editor.kind === "template" ? "模板" : "训练记录"}
              </button>
            </div>
          </Modal>
        )}
        {picker && (
          <ExercisePicker
            exercises={data.exercises}
            onChoose={(e) => pickExercise(e)}
            onCreate={(e) => pickExercise(e, true)}
            onClose={() => setPicker(null)}
          />
        )}
        {bodyForm && (
          <Modal title="记录体重" onClose={() => setBodyForm(false)}>
            <form
              className="sheet-body"
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  !validDate(bodyDate) ||
                  bodyDate > dayKey() ||
                  !numberOK(bodyKg, true) ||
                  Number(bodyKg) > 1000
                ) {
                  notify("请填写有效日期与体重（0–1000 kg）");
                  return;
                }
                update((d) => ({
                  ...d,
                  bodyweights: [
                    ...d.bodyweights.filter((b) => b.date !== bodyDate),
                    { id: uid(), date: bodyDate, kg: bodyKg },
                  ],
                }));
                setBodyForm(false);
                notify("体重已保存，同一天保留一条记录");
              }}
            >
              <label>
                日期
                <input
                  type="date"
                  value={bodyDate}
                  max={dayKey()}
                  onChange={(e) => setBodyDate(e.target.value)}
                  required
                />
              </label>
              <label>
                体重（kg）
                <input
                  inputMode="decimal"
                  value={bodyKg}
                  maxLength={8}
                  onChange={(e) => setBodyKg(e.target.value)}
                  required
                />
              </label>
              <button className="primary full" type="submit">
                保存体重
              </button>
            </form>
          </Modal>
        )}
        {pendingBackup && (
          <Modal
            title="恢复备份"
            onClose={() => {
              if (!restoring) setPendingBackup(null);
            }}
          >
            <div className="sheet-body">
              <p>
                文件包含 <strong>{pendingBackup.workouts.length}</strong>{" "}
                次训练、<strong>{pendingBackup.templates.length}</strong>{" "}
                个模板、<strong>{pendingBackup.bodyweights.length}</strong>{" "}
                条体重记录{pendingBackup.draft ? "和一份训练草稿" : ""}。
              </p>
              <p>
                恢复将整体替换当前数据。请先下载当前备份，确认文件已保存后再继续。
              </p>
              <button
                className="outline full"
                disabled={restoring}
                onClick={() => {
                  backup();
                  setBackupDownloaded(true);
                }}
              >
                下载当前数据备份
              </button>
              <button
                className="primary full"
                disabled={restoring || !backupDownloaded}
                onClick={async () => {
                  setRestoring(true);
                  try {
                    await saveData(pendingBackup);
                    lastSaved.current = pendingBackup;
                    setData(pendingBackup);
                    setSaveStatus("已保存到本机");
                    setPendingBackup(null);
                    setDetailId("");
                    setSettings(false);
                    notify("备份已恢复");
                  } catch {
                    notify("恢复保存失败，原数据未改动");
                  } finally {
                    setRestoring(false);
                  }
                }}
              >
                {restoring ? "正在恢复…" : "已保存当前备份，开始恢复"}
              </button>
              <button
                className="text-btn full"
                disabled={restoring}
                onClick={() => setPendingBackup(null)}
              >
                取消
              </button>
            </div>
          </Modal>
        )}
      </div>
    </NoticeContext.Provider>
  );
}

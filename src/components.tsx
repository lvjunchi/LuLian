import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Entry, Exercise, LiftSet, Mode, Workout } from "./domain";
import {
  adjustNumber,
  dayKey,
  newSet,
  previousEntry,
  validSet,
  uid,
} from "./domain";

export type Tab = "train" | "plan" | "history" | "chart";
export type Editor = {
  kind: "template" | "history" | "backfill";
  workout: Workout;
  templateId?: string;
  minutes: string;
};

const paths = {
  train: "M6 8v8m12-8v8M3 10v4m18-4v4M6 12h12",
  plan: "M8 4H5v17h14V4h-3M9 3h6v4H9zM8 12h8m-8 5h5",
  history:
    "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2zM7 14h2m3 0h2m3 0h1M7 17h2m3 0h2",
  chart: "M4 3v17h17M8 15l4-5 4 2 5-7",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
  plus: "M12 5v14M5 12h14",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "M19 12H5m6-6-6 6 6 6",
  clock: "M12 8v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  leaf: "M19 4C7 2 3 8 5 15s14 7 14-11M5 20l9-10",
};
export function Icon({
  name,
  size = 22,
}: {
  name: keyof typeof paths;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export const fmt = (n: number) =>
  new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(n);
export const shortDate = (date: string) => date.slice(5).replace("-", "/");
export const elapsed = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.max(0, seconds) % 60).padStart(2, "0")}`;
export const NoticeContext = createContext("");
export function download(
  text: string,
  filename: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const notice = useContext(NoticeContext);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "sheet wide" : "sheet"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-head">
        <h2>{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="关闭">
          <Icon name="close" />
        </button>
      </div>
      {children}
      {notice && (
        <div className="dialog-notice" role="alert">
          {notice}
        </div>
      )}
    </dialog>
  );
}
export function Empty({
  icon = "leaf",
  title,
  text,
  children,
}: {
  icon?: keyof typeof paths;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={32} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
function SetNumber({
  label,
  value,
  step,
  minimum = 0,
  onChange,
  notify,
}: {
  label: string;
  value: string;
  step: number;
  minimum?: number;
  onChange: (value: string) => void;
  notify: (message: string) => void;
}) {
  const adjust = (delta: number) => {
    const next = adjustNumber(value, delta, minimum);
    if (next === null) notify("请先输入有效数字，再使用微调");
    else onChange(next);
  };
  return (
    <div className="set-number">
      <input
        aria-label={label}
        inputMode={minimum ? "numeric" : "decimal"}
        autoComplete="off"
        type="text"
        maxLength={minimum ? 5 : 8}
        value={value}
        placeholder="—"
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="number-steps">
        <button
          type="button"
          aria-label={`${label}减少${step}`}
          onClick={() => adjust(-step)}
        >
          −
        </button>
        <button
          type="button"
          aria-label={`${label}增加${step}`}
          onClick={() => adjust(step)}
        >
          ＋
        </button>
      </div>
    </div>
  );
}
export function WorkEditor({
  workout: w,
  onChange,
  history,
  template = false,
  onPick,
  restSeconds,
  onRest,
  notify,
}: {
  workout: Workout;
  onChange: (w: Workout) => void;
  history: Workout[];
  template?: boolean;
  onPick: (replace?: string) => void;
  restSeconds: number;
  onRest: () => void;
  notify: (s: string) => void;
}) {
  const [weightStep, setWeightStep] = useState(2.5);
  const changeEntry = (id: string, fn: (e: Entry) => Entry) =>
    onChange({
      ...w,
      exercises: w.exercises.map((e) => (e.id === id ? fn(e) : e)),
    });
  const changeSet = (id: string, sid: string, values: Partial<LiftSet>) =>
    changeEntry(id, (e) => ({
      ...e,
      sets: e.sets.map((s) => (s.id === sid ? { ...s, ...values } : s)),
    }));
  return (
    <div className="work-editor">
      <div className="card workout-meta">
        <label>
          训练名称
          <input
            value={w.name}
            maxLength={100}
            onChange={(e) => onChange({ ...w, name: e.target.value })}
            placeholder="例如：胸肩三头"
          />
        </label>
        {!template && (
          <label>
            训练日期
            <input
              type="date"
              value={w.date}
              max={dayKey()}
              onChange={(e) => onChange({ ...w, date: e.target.value })}
            />
          </label>
        )}
      </div>
      <div className="record-tools">
        <label>
          重量微调步长
          <select
            value={weightStep}
            onChange={(e) => setWeightStep(Number(e.target.value))}
          >
            {[0.5, 1, 2.5, 5].map((step) => (
              <option key={step} value={step}>
                {step} kg
              </option>
            ))}
          </select>
        </label>
        <span>次数每次微调 1 次</span>
      </div>
      {w.exercises.map((entry, index) => {
        const previous = previousEntry(history, entry, w.date, w.id);
        return (
          <section className="card exercise" key={entry.id}>
            <div className="exercise-title">
              <span className="exercise-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{entry.name}</h3>
                <small>
                  {entry.mode === "bodyweight"
                    ? "自重 · 记录次数"
                    : entry.mode === "assisted"
                      ? "辅助重量 kg · 越小辅助越少"
                      : "外部负重 kg"}
                </small>
              </div>
            </div>
            <div className="exercise-tools">
              <button onClick={() => onPick(entry.id)}>替换</button>
              <button
                aria-label={`上移动作${entry.name}`}
                disabled={index === 0}
                onClick={() => {
                  const entries = [...w.exercises];
                  [entries[index - 1], entries[index]] = [
                    entries[index],
                    entries[index - 1],
                  ];
                  onChange({ ...w, exercises: entries });
                }}
              >
                ↑ 上移
              </button>
              <button
                disabled={index === w.exercises.length - 1}
                onClick={() => {
                  const entries = [...w.exercises];
                  [entries[index], entries[index + 1]] = [
                    entries[index + 1],
                    entries[index],
                  ];
                  onChange({ ...w, exercises: entries });
                }}
              >
                ↓ 下移
              </button>
              <button
                className="danger-text"
                onClick={() => {
                  if (
                    !entry.sets.some((s) => s.done) ||
                    confirm(`移除「${entry.name}」及其已完成记录？`)
                  )
                    onChange({
                      ...w,
                      exercises: w.exercises.filter((e) => e.id !== entry.id),
                    });
                }}
              >
                移除
              </button>
            </div>
            {!template && (
              <div className="previous">
                <span>
                  {previous
                    ? `上次 ${shortDate(previous.date)} · ${previous.entry.sets
                        .filter((s) => s.done)
                        .map(
                          (s) =>
                            `${s.kind === "warmup" ? "热身 " : ""}${entry.mode === "bodyweight" ? "" : `${s.weight}×`}${s.reps}`,
                        )
                        .join(" / ")}`
                    : "第一次记录这个动作，从今天开始积累"}
                </span>
                {previous && (
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          "带入上次已完成的组？将替换当前动作各组，完成状态会重置。",
                        )
                      )
                        changeEntry(entry.id, (e) => ({
                          ...e,
                          sets: previous.entry.sets
                            .filter((s) => s.done)
                            .map((s) => newSet(s)),
                        }));
                    }}
                  >
                    带入上次
                  </button>
                )}
              </div>
            )}
            <div className="set-head">
              <span>组 / 类型</span>
              <span>{entry.mode === "assisted" ? "辅助 kg" : "重量 kg"}</span>
              <span>次数</span>
              <span>{template ? "目标" : "完成"}</span>
            </div>
            {entry.sets.map((set, i) => (
              <div
                className={`set-row ${set.done ? "completed" : ""}`}
                key={set.id}
              >
                <div className="set-index">
                  <button
                    className={`set-kind ${set.kind}`}
                    title="点击切换热身组或正式组"
                    aria-label={`第${i + 1}组，${set.kind === "warmup" ? "热身组" : "正式组"}，点击切换`}
                    onClick={() =>
                      changeSet(entry.id, set.id, {
                        kind: set.kind === "warmup" ? "normal" : "warmup",
                      })
                    }
                  >
                    {set.kind === "warmup" ? "热身" : i + 1}
                  </button>
                  <button
                    className="remove-set"
                    aria-label={`删除第${i + 1}组`}
                    onClick={() => {
                      if (!set.done || confirm("删除这个已完成的组？"))
                        changeEntry(entry.id, (e) => ({
                          ...e,
                          sets: e.sets.filter((s) => s.id !== set.id),
                        }));
                    }}
                  >
                    删除
                  </button>
                </div>
                {entry.mode === "bodyweight" ? (
                  <span className="bodyweight-label">自重</span>
                ) : (
                  <SetNumber
                    label={`${entry.name}第${i + 1}组重量`}
                    value={set.weight}
                    step={weightStep}
                    notify={notify}
                    onChange={(weight) =>
                      changeSet(entry.id, set.id, { weight, done: false })
                    }
                  />
                )}
                <SetNumber
                  label={`${entry.name}第${i + 1}组次数`}
                  value={set.reps}
                  step={1}
                  minimum={1}
                  notify={notify}
                  onChange={(reps) =>
                    changeSet(entry.id, set.id, { reps, done: false })
                  }
                />
                <div className="set-tools">
                  {!template ? (
                    <button
                      className={`check-btn ${set.done ? "checked" : ""}`}
                      aria-label={`第${i + 1}组${set.done ? "取消完成" : "标记完成"}`}
                      aria-pressed={set.done}
                      onClick={() => {
                        if (!set.done && !validSet(set, entry.mode)) {
                          notify("请填写有效重量和次数，次数须为正整数");
                          return;
                        }
                        changeSet(entry.id, set.id, { done: !set.done });
                        if (!set.done && restSeconds > 0) onRest();
                      }}
                    >
                      <Icon name="check" size={22} />
                    </button>
                  ) : (
                    <span className="set-target">待练</span>
                  )}
                  <button
                    className="copy-set"
                    disabled={i === 0}
                    aria-label={`第${i + 1}组复制上一组数据`}
                    onClick={() => {
                      if (
                        set.done &&
                        !confirm(
                          "复制上一组会覆盖本组数据，并取消完成状态。继续？",
                        )
                      )
                        return;
                      const previous = entry.sets[i - 1];
                      if (previous)
                        changeSet(entry.id, set.id, {
                          weight: previous.weight,
                          reps: previous.reps,
                          done: false,
                        });
                    }}
                  >
                    复制
                  </button>
                </div>
              </div>
            ))}
            <button
              className="add-set"
              onClick={() =>
                changeEntry(entry.id, (e) => ({
                  ...e,
                  sets: [...e.sets, newSet(e.sets.at(-1))],
                }))
              }
            >
              <Icon name="plus" size={16} />
              添加一组 · 复制上一组数据
            </button>
            <p className="set-hint">
              复制会沿用上一组数字 · 点击组号切换热身 / 正式
            </p>
            <input
              className="note-input"
              value={entry.note}
              maxLength={2000}
              placeholder="动作备注，例如座椅高度、动作感受…"
              aria-label={`${entry.name}备注`}
              onChange={(e) =>
                changeEntry(entry.id, (v) => ({ ...v, note: e.target.value }))
              }
            />
          </section>
        );
      })}
      <button className="outline full add-exercise" onClick={() => onPick()}>
        <Icon name="plus" size={20} />
        添加动作
      </button>
      {!template && (
        <section className="card cardio">
          <div className="section-head">
            <h3>有氧记录</h3>
            <button
              className="text-btn"
              onClick={() =>
                onChange({
                  ...w,
                  cardio: [
                    ...w.cardio,
                    { id: uid(), name: "跑步", minutes: "", distance: "" },
                  ],
                })
              }
            >
              ＋ 添加
            </button>
          </div>
          {w.cardio.length === 0 && (
            <p className="muted small">偶尔跑跑步、骑骑车，也记在这里。</p>
          )}
          {w.cardio.map((c) => (
            <div className="cardio-item" key={c.id}>
              <label>
                运动类型
                <input
                  maxLength={100}
                  value={c.name}
                  onChange={(e) =>
                    onChange({
                      ...w,
                      cardio: w.cardio.map((v) =>
                        v.id === c.id ? { ...v, name: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
              <div className="form-row">
                <label>
                  时长（分钟）
                  <input
                    inputMode="decimal"
                    maxLength={8}
                    value={c.minutes}
                    onChange={(e) =>
                      onChange({
                        ...w,
                        cardio: w.cardio.map((v) =>
                          v.id === c.id ? { ...v, minutes: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  距离（km，可选）
                  <input
                    inputMode="decimal"
                    maxLength={8}
                    value={c.distance}
                    onChange={(e) =>
                      onChange({
                        ...w,
                        cardio: w.cardio.map((v) =>
                          v.id === c.id
                            ? { ...v, distance: e.target.value }
                            : v,
                        ),
                      })
                    }
                  />
                </label>
              </div>
              <button
                className="text-btn danger-text"
                onClick={() =>
                  onChange({
                    ...w,
                    cardio: w.cardio.filter((v) => v.id !== c.id),
                  })
                }
              >
                移除此项
              </button>
            </div>
          ))}
        </section>
      )}
      <label className="card block-label">
        {template ? "模板备注" : "训练感受"}
        <textarea
          maxLength={2000}
          value={w.note}
          placeholder="记下今天的状态，留给下次的自己。"
          rows={2}
          onChange={(e) => onChange({ ...w, note: e.target.value })}
        />
      </label>
      <p className="footnote">
        {template
          ? "模板中的组只作为目标，新训练需要逐组勾选完成。"
          : "预填数据不会自动算作完成。热身组保留记录，不计入正式训练容量。"}
      </p>
    </div>
  );
}
export function ExercisePicker({
  exercises,
  onChoose,
  onCreate,
  onClose,
}: {
  exercises: Exercise[];
  onChoose: (e: Exercise) => void;
  onCreate: (e: Exercise) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState("全部");
  const [custom, setCustom] = useState(false);
  const [mode, setMode] = useState<Mode>("weight");
  const [group, setGroup] = useState("其他");
  return (
    <Modal title="选择动作" onClose={onClose}>
      <div className="sheet-body">
        <input
          className="search"
          aria-label="搜索动作"
          placeholder="搜索动作名称…"
          value={search}
          maxLength={100}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="chips">
          {["全部", ...new Set(exercises.map((e) => e.muscle))].map((m) => (
            <button
              className={muscle === m ? "chip active" : "chip"}
              onClick={() => setMuscle(m)}
              key={m}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="exercise-list">
          {exercises
            .filter(
              (e) =>
                e.name.includes(search.trim()) &&
                (muscle === "全部" || muscle === e.muscle),
            )
            .map((e) => (
              <button
                className="list-button"
                key={e.id}
                onClick={() => onChoose(e)}
              >
                <span>
                  <strong>{e.name}</strong>
                  <small>
                    {e.muscle} ·{" "}
                    {e.mode === "weight"
                      ? "外部负重"
                      : e.mode === "bodyweight"
                        ? "自重"
                        : "辅助重量"}
                  </small>
                </span>
                <Icon name="plus" size={19} />
              </button>
            ))}
        </div>
        <button className="outline full" onClick={() => setCustom(!custom)}>
          找不到动作？自定义一个
        </button>
        {custom && (
          <form
            className="custom-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!search.trim()) return;
              const same = exercises.find(
                (e) => e.name === search.trim() && e.mode === mode,
              );
              if (same) onChoose(same);
              else
                onCreate({
                  id: uid(),
                  name: search.trim(),
                  muscle: group,
                  mode,
                });
            }}
          >
            <label>
              动作名称
              <input
                required
                value={search}
                maxLength={100}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="form-row">
              <label>
                肌群
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                >
                  {["胸部", "背部", "腿部", "肩部", "手臂", "核心", "其他"].map(
                    (m) => (
                      <option key={m}>{m}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                记录口径
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as Mode)}
                >
                  <option value="weight">外部负重</option>
                  <option value="bodyweight">自重次数</option>
                  <option value="assisted">辅助重量</option>
                </select>
              </label>
            </div>
            <p className="muted small">
              哑铃默认按单只重量记录，建议在名称中注明。改变口径时请新建动作。
            </p>
            <button className="primary full" type="submit">
              创建并添加
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
export function Calendar({
  workouts,
  selected,
  onSelect,
}: {
  workouts: Workout[];
  selected: string;
  onSelect: (d: string) => void;
}) {
  const [month, setMonth] = useState(dayKey().slice(0, 7));
  const [year, m] = month.split("-").map(Number);
  const offset = (new Date(year, m - 1, 1).getDay() + 6) % 7;
  const count = new Date(year, m, 0).getDate();
  const days = new Set(workouts.map((w) => w.date));
  const move = (delta: number) =>
    setMonth(dayKey(new Date(year, m - 1 + delta, 1)).slice(0, 7));
  return (
    <div className="card calendar">
      <div className="section-head">
        <button
          className="icon-btn"
          aria-label="上个月"
          onClick={() => move(-1)}
        >
          ‹
        </button>
        <strong>
          {year} 年 {m} 月
        </strong>
        <button
          className="icon-btn"
          aria-label="下个月"
          onClick={() => move(1)}
        >
          ›
        </button>
      </div>
      <div className="calendar-grid">
        {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
          <span className="weekday" key={d}>
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button
              key={date}
              aria-label={`${date}${days.has(date) ? " 有训练" : ""}`}
              className={`${selected === date ? "selected" : ""} ${date === dayKey() ? "today" : ""}`}
              onClick={() => onSelect(selected === date ? "" : date)}
            >
              {i + 1}
              {days.has(date) && <i />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
export function Trend({
  points,
  unit,
  onPoint,
}: {
  points: { id: string; date: string; value: number }[];
  unit: string;
  onPoint?: (id: string) => void;
}) {
  if (!points.length)
    return <p className="chart-empty">完成训练后，这里会留下你的进步曲线。</p>;
  const values = points.map((p) => p.value);
  const min = Math.min(...values),
    max = Math.max(...values);
  const range = max - min || Math.max(max * 0.1, 1);
  const coords = points.map((p, i) => ({
    ...p,
    x: points.length === 1 ? 160 : 30 + (i / (points.length - 1)) * 270,
    y: 120 - ((p.value - min) / range) * 85,
  }));
  return (
    <div className="trend">
      <svg
        viewBox="0 0 330 155"
        role="img"
        aria-label={`${unit}趋势，共${points.length}条记录；详细数值见下方记录列表`}
      >
        <path
          d="M30 35h270M30 78h270M30 120h270"
          stroke="#e4ece6"
          strokeDasharray="3 4"
        />
        <polyline
          fill="none"
          stroke="#29735b"
          strokeWidth="2.5"
          points={coords.map((p) => `${p.x},${p.y}`).join(" ")}
        />
        {coords.map((p, i) => (
          <circle
            key={`${p.id}-${i}`}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="#29735b"
            onClick={() => onPoint?.(p.id)}
            style={{ cursor: onPoint ? "pointer" : "default" }}
          />
        ))}
        <text x="30" y="145">
          {shortDate(points[0].date)}
        </text>
        <text x="300" y="145" textAnchor="end">
          {shortDate(points.at(-1)!.date)}
        </text>
      </svg>
      <span className="chart-range">
        {fmt(min)}–{fmt(max)} {unit}
      </span>
    </div>
  );
}

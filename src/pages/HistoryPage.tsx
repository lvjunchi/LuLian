import type { AppData, Cardio, Entry, Workout } from "../domain";
import { dayKey, doneCount, volume, newWorkout } from "../domain";
import { Calendar, Empty, Icon, fmt, shortDate } from "../components";
import type { Editor } from "../components";

type Props = {
  data: AppData;
  detailId: string;
  selectedDay: string;
  setSelectedDay: (day: string) => void;
  setDetailId: (id: string) => void;
  start: (
    name: string,
    entries?: Entry[],
    note?: string,
    cardio?: Cardio[],
  ) => void;
  saveTemplate: (w: Workout) => void;
  setEditor: (editor: Editor) => void;
  update: (fn: (data: AppData) => AppData) => void;
};
export default function HistoryPage({
  data,
  detailId,
  selectedDay,
  setSelectedDay,
  setDetailId,
  start,
  saveTemplate,
  setEditor,
  update,
}: Props) {
  const detail = data.workouts.find((w) => w.id === detailId);
  const sorted = [...data.workouts].sort(
    (a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt,
  );
  return (
    <>
      {detail ? (
        <>
          <button
            className="text-btn back-link"
            onClick={() => setDetailId("")}
          >
            <Icon name="back" size={17} />
            返回训练历史
          </button>
          <section className="card detail-summary">
            <span className="eyebrow">{detail.date} · 训练手记</span>
            <h2>{detail.name}</h2>
            <div className="detail-numbers">
              <div>
                <strong>{doneCount(detail)}</strong>
                <small>完成组数</small>
              </div>
              <div>
                <strong>{fmt(volume(detail))}</strong>
                <small>正式容量 kg·次</small>
              </div>
              <div>
                <strong>
                  {fmt(
                    ((detail.endedAt ?? detail.startedAt) - detail.startedAt) /
                      60000,
                  )}
                </strong>
                <small>分钟</small>
              </div>
            </div>
            <div className="button-row">
              <button
                className="primary compact"
                onClick={() =>
                  start(
                    detail.name,
                    detail.exercises,
                    detail.note,
                    detail.cardio,
                  )
                }
              >
                再练一次
              </button>
              <button
                className="outline compact"
                onClick={() => {
                  saveTemplate(detail);
                }}
              >
                存为模板
              </button>
              <button
                className="text-btn"
                onClick={() =>
                  setEditor({
                    kind: "history",
                    workout: structuredClone(detail),
                    minutes: String(
                      Math.round(
                        ((detail.endedAt ?? detail.startedAt) -
                          detail.startedAt) /
                          60000,
                      ),
                    ),
                  })
                }
              >
                编辑
              </button>
            </div>
            {detail.note && <p className="detail-note">{detail.note}</p>}
          </section>
          {detail.exercises.map((e) => (
            <section className="card history-exercise" key={e.id}>
              <h3>{e.name}</h3>
              <p className="muted small">
                {e.mode === "bodyweight"
                  ? "自重次数"
                  : e.mode === "assisted"
                    ? "辅助重量 kg"
                    : "外部负重 kg"}
              </p>
              {e.sets.map((s, i) => (
                <div
                  className={`history-set ${s.done ? "" : "unfinished"}`}
                  key={s.id}
                >
                  <span>{s.kind === "warmup" ? "热身" : `第 ${i + 1} 组`}</span>
                  <strong>
                    {e.mode === "bodyweight" ? "自重" : `${s.weight || "—"} kg`}{" "}
                    × {s.reps || "—"} 次
                  </strong>
                  <span>
                    {s.done ? <Icon name="check" size={17} /> : "未完成"}
                  </span>
                </div>
              ))}
              {e.note && <p className="detail-note">{e.note}</p>}
            </section>
          ))}
          {detail.cardio.map((c) => (
            <div className="card cardio-summary" key={c.id}>
              <h3>{c.name}</h3>
              <span>
                {c.minutes} 分钟
                {c.distance ? ` · ${c.distance} km` : ""}
              </span>
            </div>
          ))}
          <p className="footnote">
            容量仅统计外部负重动作中已完成的正式组，哑铃按记录的单只重量计算。
          </p>
          <button
            className="text-btn danger-text full"
            onClick={() => {
              if (confirm("永久删除这次训练？建议先在设置中导出备份。")) {
                update((d) => ({
                  ...d,
                  workouts: d.workouts.filter((w) => w.id !== detail.id),
                }));
                setDetailId("");
              }
            }}
          >
            删除这次训练
          </button>
        </>
      ) : (
        <>
          <Calendar
            workouts={data.workouts}
            selected={selectedDay}
            onSelect={setSelectedDay}
          />
          <div className="section-head">
            <h2>
              {selectedDay ? `${shortDate(selectedDay)} 的记录` : "全部训练"}{" "}
              <span className="count">
                {
                  data.workouts.filter(
                    (w) => !selectedDay || w.date === selectedDay,
                  ).length
                }
              </span>
            </h2>
            <button
              className="text-btn"
              onClick={() =>
                setEditor({
                  kind: "backfill",
                  workout: {
                    ...newWorkout("补记训练"),
                    date: selectedDay || dayKey(),
                  },
                  minutes: "60",
                })
              }
            >
              ＋ 补记训练
            </button>
          </div>
          {selectedDay && (
            <button className="text-btn" onClick={() => setSelectedDay("")}>
              显示全部日期
            </button>
          )}
          {sorted
            .filter((w) => !selectedDay || w.date === selectedDay)
            .map((w) => (
              <button
                className="card history-card"
                key={w.id}
                onClick={() => setDetailId(w.id)}
              >
                <span className="date-badge">
                  <strong>{w.date.slice(8)}</strong>
                  <small>{Number(w.date.slice(5, 7))} 月</small>
                </span>
                <div>
                  <h3>{w.name}</h3>
                  <p>
                    {w.date} · {doneCount(w)} 组 · {fmt(volume(w))} kg·次
                  </p>
                  <small>
                    {w.exercises.map((e) => e.name).join(" / ") ||
                      w.cardio.map((c) => c.name).join(" / ")}
                  </small>
                </div>
                <Icon name="arrow" size={18} />
              </button>
            ))}
          {!sorted.some((w) => !selectedDay || w.date === selectedDay) && (
            <div className="card">
              <Empty
                icon="history"
                title={selectedDay ? "这一天还没有训练记录" : "坚持会留下痕迹"}
                text="完成训练后会自动出现在这里，也可以补记之前的训练。"
              />
            </div>
          )}
        </>
      )}
    </>
  );
}

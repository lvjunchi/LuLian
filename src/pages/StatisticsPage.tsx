import { useState } from "react";
import type { AppData } from "../domain";
import { dayKey, volume, weekSummary } from "../domain";
import { Empty, Icon, Trend, fmt } from "../components";
import type { Tab } from "../components";

type Props = {
  data: AppData;
  update: (fn: (data: AppData) => AppData) => void;
  setDetailId: (id: string) => void;
  setTab: (tab: Tab) => void;
  setSelectedDay: (day: string) => void;
  setBodyDate: (day: string) => void;
  setBodyKg: (kg: string) => void;
  setBodyForm: (open: boolean) => void;
};
export default function StatisticsPage({
  data,
  update,
  setDetailId,
  setTab,
  setSelectedDay,
  setBodyDate,
  setBodyKg,
  setBodyForm,
}: Props) {
  const [statExercise, setStatExercise] = useState("");
  const [metric, setMetric] = useState<"weight" | "volume">("weight");
  const sorted = [...data.workouts].sort(
    (a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt,
  );
  const { week, weekDays } = weekSummary(data.workouts);
  const statsExercises = data.exercises.filter((e) =>
    data.workouts.some((w) =>
      w.exercises.some(
        (v) =>
          v.exerciseId === e.id &&
          v.sets.some((s) => s.done && s.kind === "normal"),
      ),
    ),
  );
  const selectedExercise =
    statsExercises.find((e) => e.id === statExercise) ?? statsExercises[0];
  const points = selectedExercise
    ? [...sorted].reverse().flatMap((w) => {
        const sets = w.exercises
          .filter(
            (e) =>
              e.exerciseId === selectedExercise.id &&
              e.mode === selectedExercise.mode,
          )
          .flatMap((e) => e.sets.filter((s) => s.done && s.kind === "normal"));
        if (!sets.length) return [];
        const value =
          selectedExercise.mode === "weight"
            ? metric === "volume"
              ? sets.reduce((n, s) => n + Number(s.weight) * Number(s.reps), 0)
              : Math.max(...sets.map((s) => Number(s.weight)))
            : selectedExercise.mode === "bodyweight"
              ? Math.max(...sets.map((s) => Number(s.reps)))
              : Math.min(...sets.map((s) => Number(s.weight)));
        return [{ id: w.id, date: w.date, value }];
      })
    : [];
  const bodyPoints = [...data.bodyweights]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((b) => ({ id: b.id, date: b.date, value: Number(b.kg) }));

  return (
    <>
      <section className="card week-card">
        <div className="section-head">
          <h2>这一周的坚持</h2>
          <span className="pill">周一至周日</span>
        </div>
        <div className="week-total">
          <strong>{week.length}</strong>
          <span>
            次训练 · {fmt(week.reduce((n, w) => n + volume(w), 0))}{" "}
            kg·次正式容量
          </span>
        </div>
        <div className="week-days">
          {weekDays.map((d, i) => (
            <button
              key={d}
              disabled={!week.some((w) => w.date === d)}
              className={`${week.some((w) => w.date === d) ? "trained" : ""} ${d === dayKey() ? "today" : ""}`}
              onClick={() => {
                setSelectedDay(d);
                setDetailId("");
                setTab("history");
              }}
            >
              <span>{["一", "二", "三", "四", "五", "六", "日"][i]}</span>
              <i>{week.filter((w) => w.date === d).length || "·"}</i>
            </button>
          ))}
        </div>
      </section>
      <section className="card stat-card">
        <h2>动作进步</h2>
        {statsExercises.length ? (
          <>
            <label className="sr-only" htmlFor="stat-exercise">
              选择统计动作
            </label>
            <select
              id="stat-exercise"
              value={selectedExercise?.id}
              onChange={(e) => setStatExercise(e.target.value)}
            >
              {statsExercises.map((e) => (
                <option value={e.id} key={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            {selectedExercise?.mode === "weight" && (
              <div className="segmented">
                <button
                  className={metric === "weight" ? "active" : ""}
                  onClick={() => setMetric("weight")}
                >
                  单组最大重量
                </button>
                <button
                  className={metric === "volume" ? "active" : ""}
                  onClick={() => setMetric("volume")}
                >
                  正式组容量
                </button>
              </div>
            )}
            <p className="muted small">
              {selectedExercise?.mode === "assisted"
                ? "正式组最小辅助重量，辅助越少通常越接近独立完成。"
                : selectedExercise?.mode === "bodyweight"
                  ? "每次训练正式组的单组最多次数。"
                  : metric === "volume"
                    ? "已完成正式组的重量 × 次数之和。哑铃按单只重量计算。"
                    : "已完成正式组中的最大重量，需结合次数判断进步。"}
            </p>
            <Trend
              points={points}
              unit={
                selectedExercise?.mode === "bodyweight"
                  ? "次"
                  : metric === "volume" && selectedExercise?.mode === "weight"
                    ? "kg·次"
                    : "kg"
              }
              onPoint={(id) => {
                setDetailId(id);
                setTab("history");
              }}
            />
            <div className="data-rows">
              {[...points].reverse().map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setDetailId(p.id);
                    setTab("history");
                  }}
                >
                  <span>{p.date}</span>
                  <strong>
                    {fmt(p.value)}{" "}
                    {selectedExercise?.mode === "bodyweight"
                      ? "次"
                      : metric === "volume" &&
                          selectedExercise?.mode === "weight"
                        ? "kg·次"
                        : "kg"}
                  </strong>
                  <Icon name="arrow" size={16} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <Empty
            icon="chart"
            title="让数字见证变化"
            text="完成动作的正式组后，这里就能查看趋势，并返回原始训练。"
          />
        )}
      </section>
      <section className="card stat-card">
        <div className="section-head">
          <h2>体重手记</h2>
          <button
            className="text-btn"
            onClick={() => {
              setBodyDate(dayKey());
              setBodyKg(
                data.bodyweights.find((b) => b.date === dayKey())?.kg ?? "",
              );
              setBodyForm(true);
            }}
          >
            ＋ 记录
          </button>
        </div>
        {bodyPoints.length ? (
          <>
            <div className="bodyweight-number">
              <strong>{fmt(bodyPoints.at(-1)!.value)}</strong>
              <span>kg · {bodyPoints.at(-1)!.date}</span>
            </div>
            <Trend points={bodyPoints} unit="kg" />
            <div className="data-rows">
              {[...data.bodyweights]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((b) => (
                  <div key={b.id}>
                    <button
                      onClick={() => {
                        setBodyDate(b.date);
                        setBodyKg(b.kg);
                        setBodyForm(true);
                      }}
                    >
                      <span>{b.date}</span>
                      <strong>{b.kg} kg</strong>
                      <span>编辑</span>
                    </button>
                    <button
                      className="delete-weight"
                      aria-label={`删除${b.date}体重`}
                      onClick={() => {
                        if (confirm(`删除 ${b.date} 的体重记录？`))
                          update((d) => ({
                            ...d,
                            bodyweights: d.bodyweights.filter(
                              (v) => v.id !== b.id,
                            ),
                          }));
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <p className="muted">偶尔记下体重，关注长期的变化。</p>
        )}
      </section>
    </>
  );
}

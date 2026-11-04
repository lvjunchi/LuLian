import type { AppData, Entry } from "../domain";
import { doneCount, volume, weekSummary } from "../domain";
import { Empty, Icon, WorkEditor, elapsed, fmt } from "../components";
import type { Tab } from "../components";

type Props = {
  data: AppData;
  now: number;
  update: (fn: (data: AppData) => AppData) => void;
  start: (name: string, entries?: Entry[], note?: string) => void;
  finish: () => void;
  notify: (s: string) => void;
  setPicker: (p: { target: "draft" | "editor"; replace?: string }) => void;
  setTab: (tab: Tab) => void;
  setDetailId: (id: string) => void;
};
export default function TrainingPage({
  data,
  now,
  update,
  start,
  finish,
  notify,
  setPicker,
  setTab,
  setDetailId,
}: Props) {
  const draft = data.draft;
  const sorted = [...data.workouts].sort(
    (a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt,
  );
  const { week } = weekSummary(data.workouts);
  return (
    <>
      {draft ? (
        <>
          <div className="active-summary">
            <span className="live-dot" />
            训练进行中
            <span>
              <Icon name="clock" size={15} />
              {elapsed(Math.floor((now - draft.startedAt) / 1000))}
            </span>
            <strong>{doneCount(draft)} 组已完成</strong>
          </div>
          <WorkEditor
            workout={draft}
            history={data.workouts}
            onChange={(w) => update((d) => ({ ...d, draft: w }))}
            onPick={(replace) => setPicker({ target: "draft", replace })}
            restSeconds={data.settings.restSeconds}
            onRest={() =>
              update((d) => ({
                ...d,
                restUntil: Date.now() + d.settings.restSeconds * 1000,
              }))
            }
            notify={notify}
          />
          <div className="finish-actions">
            <button className="primary full" onClick={finish}>
              <Icon name="check" />
              结束并保存训练
            </button>
            <button
              className="text-btn danger-text"
              onClick={() => {
                if (confirm("放弃这次训练？草稿和已勾选的组都会删除。"))
                  update((d) => ({
                    ...d,
                    draft: null,
                    restUntil: null,
                  }));
              }}
            >
              放弃本次训练
            </button>
          </div>
        </>
      ) : (
        <>
          <section className="hero">
            <div className="hero-copy">
              <span className="hero-tag">
                <Icon name="leaf" size={15} />
                你的训练，你的节奏
              </span>
              <h2>
                今天的进步，
                <br />
                从这一组开始。
              </h2>
              <p>
                记住每一份努力，
                <br />
                下次，超越昨天的自己。
              </p>
              <button className="light-btn" onClick={() => start("自由训练")}>
                开始自由训练
                <Icon name="arrow" size={19} />
              </button>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="art-ring" />
              <img src="./deer.svg" alt="" />
              <span className="art-spark one">＋</span>
              <span className="art-spark two">✦</span>
              <span className="art-caption">ONE SET AT A TIME</span>
            </div>
          </section>
          <div className="mini-stats">
            <div>
              <span>本周训练</span>
              <strong>
                {week.length}
                <small>次</small>
              </strong>
            </div>
            <div>
              <span>正式容量</span>
              <strong>
                {fmt(week.reduce((n, w) => n + volume(w), 0))}
                <small>kg·次</small>
              </strong>
            </div>
            <div>
              <span>累计训练</span>
              <strong>
                {data.workouts.length}
                <small>次</small>
              </strong>
            </div>
          </div>
          <div className="section-head">
            <h2>我的训练模板</h2>
            <button className="text-btn" onClick={() => setTab("plan")}>
              管理模板 →
            </button>
          </div>
          {data.templates.length ? (
            <div className="template-grid">
              {data.templates.map((t) => (
                <button
                  className="card template-card"
                  key={t.id}
                  onClick={() => start(t.name, t.exercises, t.note)}
                >
                  <span className="template-icon">
                    <Icon name="train" />
                  </span>
                  <strong>{t.name}</strong>
                  <small>
                    {t.exercises.length} 个动作 ·{" "}
                    {t.exercises.reduce((n, e) => n + e.sets.length, 0)} 组目标
                  </small>
                  <Icon name="arrow" size={19} />
                </button>
              ))}
            </div>
          ) : (
            <div className="card template-empty">
              <div className="soft-icon">
                <Icon name="plan" />
              </div>
              <div>
                <h3>把熟悉的训练，存成模板</h3>
                <p>下次打开就能练，少一些重复输入。</p>
              </div>
              <button className="text-btn" onClick={() => setTab("plan")}>
                去创建 →
              </button>
            </div>
          )}
          <div className="section-head">
            <h2>最近一次训练</h2>
            <button
              className="text-btn"
              onClick={() => {
                setDetailId("");
                setTab("history");
              }}
            >
              全部记录 →
            </button>
          </div>
          {sorted[0] ? (
            <button
              className="card recent-card"
              onClick={() => {
                setDetailId(sorted[0].id);
                setTab("history");
              }}
            >
              <span className="date-badge">
                <strong>{sorted[0].date.slice(8)}</strong>
                <small>{Number(sorted[0].date.slice(5, 7))} 月</small>
              </span>
              <div>
                <h3>{sorted[0].name}</h3>
                <p>
                  {doneCount(sorted[0])} 组完成 · {fmt(volume(sorted[0]))} kg·次
                </p>
              </div>
              <Icon name="arrow" />
            </button>
          ) : (
            <div className="card">
              <Empty
                title="你的第一篇训练手记"
                text="开始一次训练，鹿练会记住你的每一组。"
              />
            </div>
          )}
          <p className="home-note">
            <Icon name="leaf" size={15} />
            不必每次都刷新纪录，坚持本身就是进步。
          </p>
        </>
      )}
    </>
  );
}

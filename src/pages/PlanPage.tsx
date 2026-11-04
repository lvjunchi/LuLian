import type { AppData, Entry } from "../domain";
import { newEntry, newWorkout } from "../domain";
import { Empty, Icon } from "../components";
import type { Editor } from "../components";

type Props = {
  data: AppData;
  update: (fn: (data: AppData) => AppData) => void;
  start: (name: string, entries?: Entry[], note?: string) => void;
  setEditor: (editor: Editor) => void;
};
export default function PlanPage({ data, update, start, setEditor }: Props) {
  return (
    <>
      <div className="section-head">
        <h2>
          我的模板 <span className="count">{data.templates.length}</span>
        </h2>
        <button
          className="primary compact"
          onClick={() =>
            setEditor({
              kind: "template",
              workout: newWorkout("新训练模板"),
              minutes: "0",
            })
          }
        >
          <Icon name="plus" size={17} />
          新建
        </button>
      </div>
      {data.templates.length ? (
        data.templates.map((t) => (
          <section className="card plan-card" key={t.id}>
            <div className="section-head">
              <h3>{t.name}</h3>
              <span className="pill">{t.exercises.length} 个动作</span>
            </div>
            <p>{t.exercises.map((e) => e.name).join(" / ")}</p>
            {t.note && <p className="muted small">{t.note}</p>}
            <div className="plan-actions">
              <button
                className="primary compact"
                onClick={() => start(t.name, t.exercises, t.note)}
              >
                开始训练
                <Icon name="arrow" size={16} />
              </button>
              <button
                className="text-btn"
                onClick={() =>
                  setEditor({
                    kind: "template",
                    templateId: t.id,
                    workout: {
                      ...newWorkout(t.name),
                      exercises: structuredClone(t.exercises),
                      note: t.note,
                    },
                    minutes: "0",
                  })
                }
              >
                编辑
              </button>
              <button
                className="text-btn danger-text"
                onClick={() => {
                  if (confirm(`删除模板「${t.name}」？历史训练不会受影响。`))
                    update((d) => ({
                      ...d,
                      templates: d.templates.filter((v) => v.id !== t.id),
                    }));
                }}
              >
                删除
              </button>
            </div>
          </section>
        ))
      ) : (
        <div className="card">
          <Empty
            icon="plan"
            title="从一套熟悉的训练开始"
            text="自定义动作与目标组数，训练时再记录实际完成的数据。"
          />
        </div>
      )}
      <div className="section-head">
        <h2>也可以从这里开始</h2>
      </div>
      <p className="muted small">以下仅为可编辑的起点，不会生成训练历史。</p>
      <div className="starter-grid">
        {[
          {
            name: "推 · 胸肩三头",
            names: [
              "杠铃卧推",
              "上斜哑铃卧推（单只）",
              "哑铃侧平举（单只）",
              "绳索下压",
            ],
          },
          {
            name: "拉 · 背部二头",
            names: ["高位下拉", "坐姿划船", "面拉", "哑铃弯举（单只）"],
          },
          {
            name: "腿 · 下肢训练",
            names: ["杠铃深蹲", "罗马尼亚硬拉", "腿屈伸", "坐姿腿弯举"],
          },
        ].map((s, i) => (
          <button
            className="card starter"
            key={s.name}
            onClick={() =>
              setEditor({
                kind: "template",
                workout: newWorkout(
                  s.name,
                  s.names.flatMap((name) => {
                    const e = data.exercises.find((e) => e.name === name);
                    return e ? [newEntry(e)] : [];
                  }),
                ),
                minutes: "0",
              })
            }
          >
            <span>0{i + 1}</span>
            <strong>{s.name}</strong>
            <small>4 个动作 · 可自由调整</small>
            <Icon name="plus" size={18} />
          </button>
        ))}
      </div>
    </>
  );
}

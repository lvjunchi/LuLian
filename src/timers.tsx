import { useEffect, useState } from "react";
import { elapsed, Icon } from "./components";
import { startVisibleClock } from "./clock";

function useVisibleClock(stopAt?: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => startVisibleClock(setNow, stopAt), [stopAt]);
  return now;
}
export function WorkoutTimer({ startedAt }: { startedAt: number }) {
  const now = useVisibleClock();
  return (
    <span>
      <Icon name="clock" size={15} />
      {elapsed(Math.floor((now - startedAt) / 1000))}
    </span>
  );
}
export function RestTimer({
  until,
  onExtend,
  onClose,
}: {
  until: number;
  onExtend: () => void;
  onClose: () => void;
}) {
  const now = useVisibleClock(until);
  const remaining = Math.ceil(Math.max(0, until - now) / 1000);
  return (
    <div className="rest-bar">
      <Icon name="clock" />
      <div>
        <small aria-live="polite">
          {remaining ? "组间休息" : "休息结束，准备好再继续"}
        </small>
        <strong aria-live="off">{elapsed(remaining)}</strong>
      </div>
      <button onClick={onExtend}>＋30秒</button>
      <button onClick={onClose}>{remaining ? "跳过" : "关闭"}</button>
    </div>
  );
}

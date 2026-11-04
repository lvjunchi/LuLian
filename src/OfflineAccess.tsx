import { useEffect, useRef, useState } from "react";

export default function OfflineAccess({
  draftActive,
  beforeUpdate,
}: {
  draftActive: boolean;
  beforeUpdate: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<
    "preparing" | "ready" | "failed" | "unsupported"
  >("preparing");
  const [online, setOnline] = useState(navigator.onLine);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const applying = useRef(false);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (!("serviceWorker" in navigator)) {
      setPhase("unsupported");
      return;
    }
    let mounted = true;
    let registration: ServiceWorkerRegistration | undefined;
    const cleanups: (() => void)[] = [];
    const observe = () => {
      const worker = registration?.installing;
      if (!worker) return;
      const changed = () => {
        if (!mounted) return;
        if (worker.state === "activated") setPhase("ready");
        if (worker.state === "installed" && navigator.serviceWorker.controller)
          setWaiting(worker);
        if (worker.state === "redundant" && !registration?.active)
          setPhase("failed");
      };
      worker.addEventListener("statechange", changed);
      cleanups.push(() => worker.removeEventListener("statechange", changed));
      changed();
    };
    const refresh = () => {
      setOnline(navigator.onLine);
      if (!document.hidden && navigator.onLine)
        void registration?.update().catch(() => {});
    };
    const controllerChanged = () => {
      if (applying.current) location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      controllerChanged,
    );
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    document.addEventListener("visibilitychange", refresh);
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: "none" })
      .then((value) => {
        if (!mounted) return;
        registration = value;
        if (value.active) setPhase("ready");
        if (value.waiting) setWaiting(value.waiting);
        value.addEventListener("updatefound", observe);
        cleanups.push(() => value.removeEventListener("updatefound", observe));
        observe();
      })
      .catch(() => {
        if (mounted) setPhase("failed");
      });
    return () => {
      mounted = false;
      cleanups.forEach((clean) => clean());
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        controllerChanged,
      );
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  if (!import.meta.env.PROD) return null;
  const label =
    phase === "ready"
      ? online
        ? "可离线使用"
        : "离线中 · 记录保存在本机"
      : phase === "unsupported"
        ? "当前浏览器仅支持联网打开"
        : phase === "failed"
          ? "离线准备未完成，请联网后重新打开"
          : "正在准备离线使用…";
  return (
    <div className="offline-status" role="status">
      <span>● {label}</span>
      {waiting && (
        <div className="update-notice">
          <span>
            {draftActive ? "新版本已备好，结束训练后可更新" : "有新版本可用"}
          </span>
          <button
            disabled={draftActive || updating}
            onClick={async () => {
              setUpdating(true);
              setError("");
              try {
                await beforeUpdate();
                applying.current = true;
                waiting.postMessage({ type: "ACTIVATE_UPDATE" });
              } catch {
                setUpdating(false);
                setError("保存未成功，请先导出备份再更新");
              }
            }}
          >
            {updating ? "正在更新…" : "更新网页"}
          </button>
        </div>
      )}
      {error && <span className="danger-text">{error}</span>}
    </div>
  );
}

import type { AppData } from "./domain";
import { initialData, validateData } from "./domain.ts";

let db: Promise<IDBDatabase> | undefined;
let revision = 0;
function database() {
  return (db ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("lulian", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("app");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("请关闭其他鹿练页面后重试"));
  }));
}
export async function loadData() {
  const connection = await database();
  return new Promise<AppData>((resolve, reject) => {
    const request = connection
      .transaction("app")
      .objectStore("app")
      .get("data");
    request.onsuccess = () => {
      try {
        revision = request.result?.revision ?? 0;
        resolve(
          request.result ? validateData(request.result.data) : initialData(),
        );
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
let queue = Promise.resolve();
export function saveData(data: AppData) {
  const snapshot = structuredClone(data);
  const next = queue
    .catch(() => {})
    .then(async () => {
      const connection = await database();
      await new Promise<void>((resolve, reject) => {
        const transaction = connection.transaction("app", "readwrite");
        const store = transaction.objectStore("app");
        const current = store.get("data");
        let conflict: Error | undefined;
        let nextRevision = revision;
        current.onsuccess = () => {
          if ((current.result?.revision ?? 0) !== revision) {
            conflict = new Error(
              "另一页面已更新数据，请先备份当前内容，再重新打开",
            );
            transaction.abort();
            return;
          }
          nextRevision = revision + 1;
          store.put({ data: snapshot, revision: nextRevision }, "data");
        };
        transaction.oncomplete = () => {
          revision = nextRevision;
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () =>
          reject(conflict ?? transaction.error ?? new Error("保存已中止"));
      });
    });
  queue = next;
  return next;
}

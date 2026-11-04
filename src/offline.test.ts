import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function worker(failInstall = false) {
  const scope = "https://example.test/LuLian/";
  const listeners: Record<string, (event: Record<string, unknown>) => void> =
    {};
  const stores = new Map<string, Map<string, Response>>();
  let claimed = 0,
    skipped = 0;
  const cacheApi = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        async addAll(requests: Request[]) {
          if (failInstall) throw new Error("offline during installation");
          for (const request of requests)
            store.set(request.url, new Response(request.url));
        },
        async match(input: Request | string) {
          return store
            .get(typeof input === "string" ? input : input.url)
            ?.clone();
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
  };
  runInNewContext(readFileSync(new URL("./sw.js", import.meta.url), "utf8"), {
    BUILD_ID: "v1",
    PRECACHE: ["./index.html", "./deer.svg", "./assets/app.js"],
    URL,
    Request,
    caches: cacheApi,
    fetch: async () => {
      throw new Error("network is offline");
    },
    self: {
      registration: { scope },
      clients: {
        claim: async () => {
          claimed++;
        },
      },
      skipWaiting: async () => {
        skipped++;
      },
      addEventListener: (
        type: string,
        listener: (event: Record<string, unknown>) => void,
      ) => {
        listeners[type] = listener;
      },
    },
  });
  return {
    scope,
    stores,
    claimed: () => claimed,
    skipped: () => skipped,
    async dispatch(type: string, values: Record<string, unknown> = {}) {
      let task: Promise<unknown> | undefined;
      listeners[type]({
        ...values,
        waitUntil: (value: Promise<unknown>) => {
          task = value;
        },
        respondWith: (value: Promise<unknown>) => {
          task = value;
        },
      });
      return task ? await task : undefined;
    },
  };
}
test("initial installation caches the repository subpath and serves shell and assets without a network", async () => {
  const w = worker();
  await w.dispatch("install");
  await w.dispatch("activate");
  assert.equal(w.claimed(), 1);
  const shell = (await w.dispatch("fetch", {
    request: { method: "GET", mode: "navigate", url: w.scope },
  })) as Response;
  assert.equal(await shell.text(), w.scope + "index.html");
  const asset = (await w.dispatch("fetch", {
    request: new Request(w.scope + "assets/app.js"),
  })) as Response;
  assert.equal(await asset.text(), w.scope + "assets/app.js");
});
test("cache cleanup affects only this app scope and activation needs an explicit update message", async () => {
  const w = worker();
  w.stores.set("lulian:/LuLian/:v0", new Map());
  w.stores.set("lulian:/Other/:v0", new Map());
  await w.dispatch("install");
  assert.equal(w.skipped(), 0);
  await w.dispatch("activate");
  assert.equal(w.stores.has("lulian:/LuLian/:v0"), false);
  assert.equal(w.stores.has("lulian:/Other/:v0"), true);
  await w.dispatch("message", { data: { type: "ACTIVATE_UPDATE" } });
  assert.equal(w.skipped(), 1);
});
test("failed installation cannot replace the old usable cache", async () => {
  const w = worker(true);
  w.stores.set("lulian:/LuLian/:v0", new Map());
  await assert.rejects(w.dispatch("install"), /offline during installation/);
  assert.equal(w.stores.has("lulian:/LuLian/:v0"), true);
  assert.equal(w.stores.has("lulian:/LuLian/:v1"), false);
  assert.equal(w.claimed(), 0);
});
test("other applications, non-GET requests and uncached API calls are left to the browser", async () => {
  const w = worker();
  for (const request of [
    new Request("https://example.test/Other/"),
    new Request(w.scope, { method: "POST" }),
    new Request(w.scope + "api/data"),
  ]) {
    assert.equal(await w.dispatch("fetch", { request }), undefined);
  }
});

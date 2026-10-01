// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { afterEach, describe, expect, it, vi } from "vitest";

import { OFFLINE_CACHE_PREFIX } from "@/lib/offline-pages";

const SOURCE = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
const ORIGIN = "https://scores.example";
const CACHE_NAME = `${OFFLINE_CACHE_PREFIX}v1`;
const NAVIGATION_TIMEOUT_MS = 5_000;

/** The parts of a Request the worker reads. Node cannot build a navigate-mode Request. */
interface FakeRequest {
  url: string;
  method: string;
  mode: string;
  headers: Headers;
}

interface WorkerEvent {
  request?: FakeRequest;
  data?: unknown;
  respondWith: (response: Promise<Response>) => void;
  waitUntil: (work: Promise<unknown>) => void;
}

type FetchFake = (input: FakeRequest | string) => Promise<Response>;

interface LoadedWorker {
  listeners: Map<string, (event: WorkerEvent) => void>;
  stores: Map<string, Map<string, Response>>;
  fetched: string[];
  claim: ReturnType<typeof vi.fn>;
  setFetch: (fake: FetchFake) => void;
}

interface Dispatched {
  handled: boolean;
  response: Response | undefined;
  /** Waits for the work the worker extended the event with, such as keeping a page. */
  settle: () => Promise<void>;
}

async function failingFetch(): Promise<Response> {
  throw new TypeError("Failed to fetch");
}

/** Runs public/sw.js against in-memory caches and a swappable fetch. */
function loadWorker(): LoadedWorker {
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const stores = new Map<string, Map<string, Response>>();
  const fetched: string[] = [];
  const claim = vi.fn(async () => {});
  let currentFetch: FetchFake = failingFetch;

  const caches = {
    open: async (name: string) => {
      const store = stores.get(name) ?? new Map<string, Response>();
      stores.set(name, store);
      return {
        put: async (key: string, response: Response) => {
          store.set(key, response);
        },
        match: async (key: string) => store.get(key)?.clone(),
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };

  vm.runInNewContext(SOURCE, {
    self: {
      location: new URL(`${ORIGIN}/sw.js`),
      addEventListener: (type: string, listener: (event: WorkerEvent) => void) => {
        listeners.set(type, listener);
      },
      skipWaiting: async () => {},
      clients: { claim },
    },
    caches,
    console,
    Response,
    URL,
    fetch: (input: FakeRequest | string) => {
      fetched.push(typeof input === "string" ? input : input.url);
      return currentFetch(input);
    },
    // Read the globals at call time, so fake timers apply.
    setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
  });

  return {
    listeners,
    stores,
    fetched,
    claim,
    setFetch: (fake) => {
      currentFetch = fake;
    },
  };
}

async function dispatch(
  worker: LoadedWorker,
  type: string,
  fields: Pick<WorkerEvent, "request" | "data">,
): Promise<Dispatched> {
  const captured: { response?: Promise<Response> } = {};
  const work: Promise<unknown>[] = [];
  const listener = worker.listeners.get(type);
  if (listener === undefined) throw new Error(`The worker has no ${type} listener.`);

  listener({
    ...fields,
    respondWith: (response) => {
      captured.response = response;
    },
    waitUntil: (promise) => {
      work.push(promise);
    },
  });

  return {
    handled: captured.response !== undefined,
    response: captured.response === undefined ? undefined : await captured.response,
    settle: async () => {
      let settled = 0;
      while (settled < work.length) {
        const batch = work.slice(settled);
        settled = work.length;
        await Promise.all(batch);
      }
    },
  };
}

function request(url: string, method: string, mode: string, headers: Headers): FakeRequest {
  return { url, method, mode, headers };
}

function navigation(pathname: string): FakeRequest {
  return request(`${ORIGIN}${pathname}`, "GET", "navigate", new Headers());
}

function appFile(pathname: string): FakeRequest {
  return request(`${ORIGIN}${pathname}`, "GET", "no-cors", new Headers());
}

function html(body: string): Response {
  return new Response(body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the scoring service worker", () => {
  it("names its caches with the prefix the app clears at sign-in", () => {
    expect(SOURCE).toContain(`const CACHE_PREFIX = "${OFFLINE_CACHE_PREFIX}";`);
  });

  it("keeps a scoring page from the network and serves it when the network fails", async () => {
    const worker = loadWorker();
    worker.setFetch(async () => html("<p>Match 2</p>"));

    const online = await dispatch(worker, "fetch", { request: navigation("/score/m2") });
    expect(await online.response?.text()).toBe("<p>Match 2</p>");
    await online.settle();

    worker.setFetch(failingFetch);
    const offline = await dispatch(worker, "fetch", { request: navigation("/score/m2?from=list") });
    expect(await offline.response?.text()).toBe("<p>Match 2</p>");
  });

  it("answers a page this phone never kept with the offline notice", async () => {
    const worker = loadWorker();

    const offline = await dispatch(worker, "fetch", { request: navigation("/score/m9") });

    expect(offline.response?.status).toBe(503);
    expect(await offline.response?.text()).toContain("has not been opened on this phone yet");
  });

  it("never keeps a redirect, such as one to the sign-in page", async () => {
    const worker = loadWorker();
    worker.setFetch(async () => {
      const response = html("<p>Sign in</p>");
      Object.defineProperty(response, "redirected", { value: true });
      return response;
    });
    await (await dispatch(worker, "fetch", { request: navigation("/score/m2") })).settle();

    worker.setFetch(failingFetch);
    const offline = await dispatch(worker, "fetch", { request: navigation("/score/m2") });

    expect(offline.response?.status).toBe(503);
  });

  it("serves the kept page when the network is too slow", async () => {
    vi.useFakeTimers();
    const worker = loadWorker();
    worker.setFetch(async () => html("<p>Kept copy</p>"));
    await (await dispatch(worker, "fetch", { request: navigation("/score/m2") })).settle();

    worker.setFetch(() => new Promise<Response>(() => {}));
    const slow = dispatch(worker, "fetch", { request: navigation("/score/m2") });
    await vi.advanceTimersByTimeAsync(NAVIGATION_TIMEOUT_MS);

    expect(await (await slow).response?.text()).toBe("<p>Kept copy</p>");
  });

  it("leaves every other request to the browser", async () => {
    const worker = loadWorker();
    const others = [
      request(`${ORIGIN}/api/matches/m2/score`, "POST", "cors", new Headers()),
      request(`${ORIGIN}/api/matches/m2/score`, "GET", "cors", new Headers()),
      request(`${ORIGIN}/admin`, "GET", "navigate", new Headers()),
      request(`${ORIGIN}/score/m2?_rsc=abc`, "GET", "cors", new Headers({ RSC: "1" })),
      request("https://fonts.googleapis.com/css2?family=Inter", "GET", "no-cors", new Headers()),
    ];

    for (const other of others) {
      expect((await dispatch(worker, "fetch", { request: other })).handled).toBe(false);
    }
  });

  it("serves app files from the network first, and from the cache without one", async () => {
    const worker = loadWorker();
    worker.setFetch(async () => new Response("chunk", { status: 200 }));
    await (await dispatch(worker, "fetch", { request: appFile("/_next/static/chunks/app.js") })).settle();

    worker.setFetch(failingFetch);
    const offline = await dispatch(worker, "fetch", { request: appFile("/_next/static/chunks/app.js") });
    expect(await offline.response?.text()).toBe("chunk");

    await expect(
      dispatch(worker, "fetch", { request: appFile("/_next/static/chunks/other.js") }),
    ).rejects.toThrow("Failed to fetch");
  });

  it("keeps the app files a kept page refers to, so the page can start with no signal", async () => {
    const worker = loadWorker();
    worker.setFetch(async (input) => {
      const url = typeof input === "string" ? input : input.url;
      return url.includes("/_next/")
        ? new Response(`file ${url}`)
        : html(
            '<script src="/_next/static/chunks/main.js"></script>' +
              '<script>self.__next_f.push([1,"[\\"/_next/static/chunks/page.js\\"]"])</script>',
          );
    });
    await (await dispatch(worker, "fetch", { request: navigation("/score/m2") })).settle();

    worker.setFetch(failingFetch);
    for (const pathname of ["/_next/static/chunks/main.js", "/_next/static/chunks/page.js"]) {
      const offline = await dispatch(worker, "fetch", { request: appFile(pathname) });
      expect(await offline.response?.text()).toBe(`file ${ORIGIN}${pathname}`);
    }
  });

  it("finds a kept app file whether or not its brackets are escaped", async () => {
    const worker = loadWorker();
    worker.setFetch(async (input) => {
      const url = typeof input === "string" ? input : input.url;
      return url.includes("/_next/")
        ? new Response("dev runtime")
        : html('<script src="/_next/static/chunks/[turbopack]_runtime.js"></script>');
    });
    await (await dispatch(worker, "fetch", { request: navigation("/score/m2") })).settle();

    worker.setFetch(failingFetch);
    const offline = await dispatch(worker, "fetch", {
      request: appFile("/_next/static/chunks/%5Bturbopack%5D_runtime.js"),
    });

    expect(await offline.response?.text()).toBe("dev runtime");
  });

  it("keeps the scoring pages and app files a page asks for, and nothing else", async () => {
    const worker = loadWorker();
    worker.setFetch(async (input) =>
      String(input).includes("/_next/") ? new Response("file") : html("<p>Matches</p>"),
    );

    const message = await dispatch(worker, "message", {
      data: {
        type: "cache-urls",
        urls: [
          `${ORIGIN}/score`,
          `${ORIGIN}/_next/static/chunks/app.js`,
          `${ORIGIN}/api/matches`,
          "https://fonts.googleapis.com/css2?family=Inter",
        ],
      },
    });
    await message.settle();

    expect(worker.fetched).toEqual([`${ORIGIN}/score`, `${ORIGIN}/_next/static/chunks/app.js`]);
    expect([...(worker.stores.get(CACHE_NAME)?.keys() ?? [])]).toEqual([
      `${ORIGIN}/score`,
      `${ORIGIN}/_next/static/chunks/app.js`,
    ]);
  });

  it("drops older scoring caches on activation and takes control of open pages", async () => {
    const worker = loadWorker();
    worker.stores.set(`${OFFLINE_CACHE_PREFIX}v0`, new Map());
    worker.stores.set("another-app", new Map());

    await (await dispatch(worker, "activate", {})).settle();

    expect([...worker.stores.keys()]).toEqual(["another-app"]);
    expect(worker.claim).toHaveBeenCalledTimes(1);
  });
});

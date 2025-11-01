// File: src/components/ProviderSnapshot.tsx
// Cleaner version with robust retry logic and parser-friendly string concatenation.

import { useEffect, useMemo, useState } from "react";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GetJSONOptions {
  retries?: number;
  backoff?: number;
}

async function getJSON(url: string, { retries = 3, backoff = 400 }: GetJSONOptions = {}) {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt <= retries) {
    try {
      const r = await fetch(url, { mode: "cors", cache: "no-store" });
      if (!r.ok) {
        // Retry on 429/5xx
        if (r.status === 429 || (r.status >= 500 && r.status < 600)) {
          throw new Error(r.status + " " + r.statusText);
        }
        // Non-retryable
        throw new Error(r.status + " " + r.statusText);
      }
      return (await r.json()) as any;
    } catch (e) {
      lastErr = e;
      attempt += 1;
      if (attempt > retries) break;
      await sleep(backoff * Math.pow(2, attempt - 1));
    }
  }
  throw lastErr ?? new Error("Load failed");
}

type Bucket = { key: string; count: number };
type DebugLogEntry = { name: string; url: string; count?: number; error?: string };

interface ProviderSnapshotProps {
  apiBase?: string;
  discoverPages?: number;
  perPage?: number;
  seedProviders?: string[];
  concurrent?: number;
  showTop?: number;
  debug?: boolean;
  autoStart?: boolean;
  delayMs?: number;
  retries?: number;
}

export default function ProviderSnapshot({
  apiBase = "https://lib-btaageoapi-dev-app-01.oit.umn.edu/api/v1",
  discoverPages = 4,
  perPage = 100,
  seedProviders = [],
  concurrent = 3,
  showTop = 25,
  debug = false,
  autoStart = true,
  delayMs = 150,
  retries = 3,
}: ProviderSnapshotProps) {
  const [phase, setPhase] = useState<"idle" | "discover" | "count" | "ready" | "error">("idle");
  const [providers, setProviders] = useState<string[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const [running, setRunning] = useState(false);

  const base = apiBase.replace(/\/$/, "");

  useEffect(() => {
    if (autoStart && !running && phase === "idle") {
      void runSnapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const runSnapshot = async () => {
    try {
      setRunning(true);
      setError(null);
      setBuckets([]);
      setDebugLogs([]);

      let names: string[] =
        seedProviders && seedProviders.length ? [...new Set(seedProviders)] : [];
      if (!names.length) {
        setPhase("discover");
        const seen = new Set<string>();
        for (let page = 1; page <= discoverPages; page++) {
          const u = new URL(`${base}/search`);
          u.searchParams.set("q", "*:*");
          u.searchParams.set("page", String(page));
          u.searchParams.set("per_page", String(perPage));
          const data = await getJSON(u.toString(), { retries });
          const docs = (data?.data ?? []) as Array<Record<string, any>>;
          for (const rec of docs) {
            const prov = rec?.attributes?.schema_provider_s;
            if (typeof prov === "string" && prov) seen.add(prov);
          }
          if (docs.length < perPage) break;
        }
        names = Array.from(seen).sort();
        setProviders(names);
      } else {
        setProviders(names);
      }

      setPhase("count");
      let i = 0;
      const results: Bucket[] = [];
      const logs: DebugLogEntry[] = [];
      const worker = async () => {
        while (i < names.length) {
          const name = names[i++];
          const u = new URL(`${base}/search`);
          u.searchParams.set("q", "*:*");
          u.searchParams.set("per_page", "1");
          u.searchParams.append("fq[provider_agg][]", name);
          const urlStr = u.toString();
          try {
            const data = await getJSON(urlStr, { retries });
            const count = Number(data?.meta?.totalCount ?? 0);
            if (debug && logs.length < 20) logs.push({ name, url: urlStr, count });
            if (count > 0) results.push({ key: name, count });
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            if (debug && logs.length < 20) logs.push({ name, url: urlStr, error: message });
          }
          if (delayMs > 0) await sleep(delayMs);
        }
      };

      const workers = Array.from({ length: Math.max(1, concurrent) }, () => worker());
      await Promise.all(workers);
      results.sort((a, b) => b.count - a.count);
      setBuckets(results);
      if (debug) setDebugLogs(logs);
      setPhase("ready");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setPhase("error");
    } finally {
      setRunning(false);
    }
  };

  const totalShown = useMemo(
    () => buckets.reduce((acc, bucket) => acc + bucket.count, 0),
    [buckets],
  );
  const topN = useMemo(() => buckets.slice(0, showTop), [buckets, showTop]);
  const max = topN[0]?.count ?? 1;

  return (
    <div className="rounded-2xl border p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h3 className="text-lg font-semibold">Provider snapshot</h3>
          <p className="text-sm opacity-70">
            Distinct providers: {buckets.length || providers.length || "?"} · Top {showTop} total:{" "}
            {totalShown.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!running && (
            <button
              className="px-3 py-1.5 rounded-lg border text-sm"
              onClick={() => {
                void runSnapshot();
              }}
            >
              Run snapshot
            </button>
          )}
          {running && (
            <button className="px-3 py-1.5 rounded-lg border text-sm" onClick={() => setRunning(false)}>
              Stop
            </button>
          )}
        </div>
      </div>

      {phase === "idle" && (
        <p className="text-sm">
          Click <strong>Run snapshot</strong> to discover providers and compute counts.
        </p>
      )}
      {phase === "discover" && <p className="text-sm">Discovering providers...</p>}
      {phase === "count" && <p className="text-sm">Counting items per provider...</p>}

      {phase === "ready" && (
        <ul className="space-y-2">
          {topN.map((bucket) => (
            <li key={bucket.key} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5 truncate" title={bucket.key}>
                {bucket.key}
              </div>
              <div className="col-span-6">
                <div className="h-2 w-full bg-gray-200 rounded">
                  <div
                    className="h-2 rounded"
                    style={{ width: `${Math.min(100, (bucket.count / max) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="col-span-1 text-right tabular-nums">
                {bucket.count.toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}

      {debug && (
        <details className="mt-2">
          <summary className="text-sm cursor-pointer">Debug (first few requests)</summary>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(debugLogs, null, 2)}</pre>
        </details>
      )}

      {phase === "error" && <p className="text-sm text-red-600">Error: {error}</p>}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";

import { buildApiUrl } from "../api/http";

type CheckState = {
  endpoint: string;
  ok: boolean;
  status: number | null;
  durationMs: number;
  body: unknown;
  error: string | null;
};

const ENDPOINTS = ["/healthz", "/readyz"] as const;

async function runCheck(endpoint: (typeof ENDPOINTS)[number]): Promise<CheckState> {
  const started = performance.now();
  try {
    const response = await fetch(buildApiUrl(endpoint), {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    const contentType = response.headers.get("content-type") ?? "";
    let parsedBody: unknown = null;

    if (contentType.includes("application/json")) {
      parsedBody = await response.json();
    } else {
      parsedBody = await response.text();
    }

    return {
      endpoint,
      ok: response.ok,
      status: response.status,
      durationMs: Math.round(performance.now() - started),
      body: parsedBody,
      error: null,
    };
  } catch (error) {
    return {
      endpoint,
      ok: false,
      status: null,
      durationMs: Math.round(performance.now() - started),
      body: null,
      error: error instanceof Error ? error.message : "Unknown network error",
    };
  }
}

function HealthPage() {
  const [checks, setChecks] = useState<CheckState[]>([]);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runChecks = useCallback(async () => {
    setIsLoading(true);
    const results = await Promise.all(ENDPOINTS.map((endpoint) => runCheck(endpoint)));
    setChecks(results);
    setLastCheckedAt(new Date().toLocaleTimeString());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void runChecks();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [runChecks]);

  const allHealthy = checks.length > 0 && checks.every((check) => check.ok);

  return (
    <main className="shell">
      <section className="panel health-panel">
        <div className="health-header">
          <div>
            <h1>Backend Health</h1>
            <p className="status">
              {checks.length === 0
                ? "Running checks..."
                : allHealthy
                  ? "All backend checks passed"
                  : "One or more backend checks failed"}
            </p>
            {lastCheckedAt && <p className="health-meta">Last checked: {lastCheckedAt}</p>}
          </div>
          <button type="button" onClick={() => void runChecks()} disabled={isLoading}>
            {isLoading ? "Checking..." : "Run checks"}
          </button>
        </div>

        <div className="health-grid">
          {checks.map((check) => (
            <article key={check.endpoint} className="health-card">
              <h2>{check.endpoint}</h2>
              <p className={check.ok ? "health-ok" : "health-fail"}>{check.ok ? "Healthy" : "Failed"}</p>
              <p>Status: {check.status ?? "No response"}</p>
              <p>Duration: {check.durationMs} ms</p>
              {check.error ? <p>Error: {check.error}</p> : null}
              <pre>{JSON.stringify(check.body, null, 2)}</pre>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default HealthPage;

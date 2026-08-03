"use client";

import { useEffect, useState } from "react";
import { API_BASE, apiGet } from "@/lib/api";

type Health = {
  status: string;
  service: string;
  timestamp: string;
};

export function ApiStatus() {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [payload, setPayload] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiGet<Health>("/health")
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        setState("ok");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to reach API");
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return <p className="text-sm text-zinc-500">Checking {API_BASE}…</p>;
  }

  if (state === "error") {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-medium text-red-600 dark:text-red-400">Offline</p>
        <p className="text-zinc-500">{error}</p>
        <p className="text-xs text-zinc-400">
          Start Postgres + API:{" "}
          <code>docker compose up -d && pnpm --filter api dev</code>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium text-teal-700 dark:text-teal-400">
        {payload?.status?.toUpperCase()} · {payload?.service}
      </p>
      <p className="font-mono text-xs text-zinc-500">{payload?.timestamp}</p>
    </div>
  );
}

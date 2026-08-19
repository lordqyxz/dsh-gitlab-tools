// Data hook: poll the live token/progress stats of one dev session via the
// host proxy route (which reads the DSH session event log; token never leaves
// the server).

import { useCallback, useEffect, useState } from "react";
import type { SessionStats } from "./types";

export function useSessionStats(sessionId: string | undefined, enabled = true, intervalMs = 3000) {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!sessionId) return;
    fetch(`/gitlab-tools/session/stats?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json: SessionStats & { ok?: boolean; message?: string }) => {
        if (json && json.ok === true) {
          setStats(json);
          setError(null);
        } else {
          setError((json && json.message) || "读取会话统计失败");
        }
      })
      .catch((e) => setError(String((e && e.message) || e)));
  }, [sessionId]);

  useEffect(() => {
    if (!enabled || !sessionId) return;
    refresh();
    const timer = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, sessionId, intervalMs, refresh]);

  return { stats, error, refresh };
}

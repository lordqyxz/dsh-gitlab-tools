// Data hook: settings (refresh interval) + issue list, with polling and a save
// fan-out. `active` pauses everything while the surface is hidden and resumes
// on becoming visible. All network goes through the host proxy; no token in the
// browser.

import { useCallback, useEffect, useRef, useState } from "react";
import { refreshSignal } from "./state";
import type { IssuesResp, PanelState, ProjectDir, SettingsResp } from "./types";

export function usePanel(active = true) {
  const [settings, setSettings] = useState<{ defaultProject: string; refreshMs: number; projectDirs: ProjectDir[] } | null>(null);
  const [state, setState] = useState<PanelState>({ loading: true, data: null, error: null });

  const loadIssues = useCallback((project?: string) => {
    setState((prev) => ({ loading: true, data: prev.data, error: null }));
    const q = project ? `?project=${encodeURIComponent(project)}` : "";
    fetch(`/gitlab-tools/issues${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json: IssuesResp) => {
        setState({
          loading: false,
          data: json,
          error: json.ok ? null : json.message || "查询失败",
        });
      })
      .catch((e) => {
        setState({ loading: false, data: null, error: String((e && e.message) || e) });
      });
  }, []);

  const loadSettings = useCallback(() => {
    fetch("/gitlab-tools/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((json: SettingsResp) => {
        if (!json || json.ok !== true) return;
        setSettings((prev) => {
          const next = {
            defaultProject: json.defaultProject ?? "",
            refreshMs: json.refreshMs ?? 120000,
            projectDirs: json.projectDirs ?? [],
          };
          if (
            prev &&
            prev.defaultProject === next.defaultProject &&
            prev.refreshMs === next.refreshMs &&
            JSON.stringify(prev.projectDirs) === JSON.stringify(next.projectDirs)
          ) {
            return prev; // same reference → React bails out, no re-render loop
          }
          return next;
        });
      })
      .catch(() => {
        /* settings are optional; surface still renders from defaults */
      });
  }, []);

  // Mirror the current refreshMs into a ref so the recursive poll reads a fresh
  // value on every tick — a settings change takes effect without a remount.
  const refreshMsRef = useRef(120000);
  refreshMsRef.current = settings?.refreshMs ?? 120000;

  useEffect(() => {
    if (!active) return; // hidden surface: no fetch, no poll
    loadSettings();
    loadIssues();
    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(() => {
        loadSettings();
        loadIssues();
        schedule();
      }, refreshMsRef.current);
    };
    schedule();
    const dispose = refreshSignal.subscribe(() => {
      loadSettings();
      loadIssues();
    });
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      dispose();
    };
  }, [active, loadIssues, loadSettings]);

  return { settings, state, loadIssues };
}

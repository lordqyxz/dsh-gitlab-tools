// Data hook: settings (refresh interval) + issue list, with polling and a save
// fan-out. `active` pauses everything while the surface is hidden and resumes
// on becoming visible. All network goes through the host proxy; no token in the
// browser.
//
// The list respects the active PanelFilters: by default scope is
// "assigned_to_me" (仅看我), and a debounced search reloads from the server.

import { useCallback, useEffect, useRef, useState } from "react";
import { refreshSignal } from "./state";
import type { IssuesResp, PanelFilters, PanelState, ProjectDir, SettingsResp } from "./types";

const DEFAULT_FILTERS: PanelFilters = { search: "", scope: "assigned_to_me" };

function issueQuery(filters: PanelFilters, project?: string): string {
  const q = new URLSearchParams();
  if (project) q.set("project", project);
  if (filters.scope === "assigned_to_me") q.set("scope", "assigned_to_me");
  const s = filters.search.trim();
  if (s) q.set("search", s);
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

export function usePanel(active = true) {
  const [settings, setSettings] = useState<{ defaultProject: string; refreshMs: number; projectDirs: ProjectDir[] } | null>(null);
  const [state, setState] = useState<PanelState>({ loading: true, data: null, error: null });
  const [filters, setFiltersState] = useState<PanelFilters>(DEFAULT_FILTERS);

  // Keep the latest filters/refreshMs in refs so the poll loop and the debounced
  // filter effect always read fresh values without re-registering themselves.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const loadIssues = useCallback((project?: string, f?: PanelFilters) => {
    const eff = f ?? filtersRef.current;
    setState((prev) => ({ loading: true, data: prev.data, error: null }));
    fetch(`/gitlab-tools/issues${issueQuery(eff, project)}`, { cache: "no-store" })
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

  /** Merge a partial filter update into state; the change effect reloads. */
  const setFilters = useCallback((patch: Partial<PanelFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
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

  // Reload whenever the filters change, debounced while typing (search hits the
  // server). Skipped on first mount — the poll effect does the initial load.
  const firstFilterRun = useRef(true);
  useEffect(() => {
    if (firstFilterRun.current) {
      firstFilterRun.current = false;
      return;
    }
    if (!active) return; // hidden surface: no fetch
    const delay = filters.search ? 350 : 0;
    const t = window.setTimeout(() => loadIssues(undefined, filters), delay);
    return () => window.clearTimeout(t);
  }, [active, filters, loadIssues]);

  useEffect(() => {
    if (!active) return; // hidden surface: no fetch, no poll
    loadSettings();
    loadIssues(undefined, filtersRef.current);
    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(() => {
        loadSettings();
        loadIssues(undefined, filtersRef.current);
        schedule();
      }, refreshMsRef.current);
    };
    schedule();
    const dispose = refreshSignal.subscribe(() => {
      loadSettings();
      loadIssues(undefined, filtersRef.current);
    });
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      dispose();
    };
  }, [active, loadIssues, loadSettings]);

  return { settings, state, loadIssues, filters, setFilters };
}
